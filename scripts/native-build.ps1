<#
.SYNOPSIS
  Compila el backend de steward a imagen nativa (GraalVM) y, con -Run, lo levanta con las restricciones del VPS.

.DESCRIPTION
  Construye la imagen Docker steward-native con backend/Dockerfile.native (build con GraalVM CE 25 y runtime
  Debian 13, como nolost-vps) y copia el binario a backend/build/native/nativeCompile/steward.

  Con -Run levanta el contenedor local-steward-native en la red de local-postgres, limitado como el VPS:
  1 CPU y 160 MB (design D12). Correr desde PowerShell nativo y sin redirigir stderr (2>&1).

.EXAMPLE
  .\scripts\native-build.ps1
  .\scripts\native-build.ps1 -Run
  .\scripts\native-build.ps1 -Run -SkipBuild -Profile contract -DbName steward_test
#>
param(
    [switch]$Run,
    [switch]$SkipBuild,
    [int]$MemoryMb = 160,
    [string]$Cpus = "1",
    [int]$HostPort = 18099,
    [string]$Profile = "dev",
    [string]$DbName = "steward",
    [string]$EnvFile = "",
    [string]$Network = "infra_local-network"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo "backend"
$image = "steward-native"
$container = "local-steward-native"

# docker escribe progreso por stderr: en PowerShell 5.1 no se redirige; se mira solo el codigo de salida.
function Invoke-Docker([string]$What, [string[]]$Arguments) {
    Write-Host "[..] $What" -ForegroundColor Cyan
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker @Arguments
    $code = $LASTEXITCODE
    $ErrorActionPreference = $previous
    if ($code -ne 0) { throw "$What fallo (codigo $code)" }
}

if (-not $SkipBuild) {
    $env:DOCKER_BUILDKIT = "1"
    $started = Get-Date
    Invoke-Docker "Compilando la imagen nativa (varios minutos)" @("build", "-f", (Join-Path $backend "Dockerfile.native"), "-t", $image, $backend)
    Write-Host ("[OK] Imagen {0} en {1:n0} s" -f $image, ((Get-Date) - $started).TotalSeconds) -ForegroundColor Green

    # El binario tambien queda en el repo: es lo que deploy.ps1 sube al VPS (design D13).
    $outDir = Join-Path $backend "build\native\nativeCompile"
    New-Item -ItemType Directory -Force $outDir | Out-Null
    $tmp = "steward-native-extract"
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker rm -f $tmp *> $null
    $ErrorActionPreference = $previous
    Invoke-Docker "Extrayendo el binario" @("create", "--name", $tmp, $image)
    try {
        Invoke-Docker "Copiando a backend/build/native/nativeCompile/steward" @("cp", "${tmp}:/app/steward", (Join-Path $outDir "steward"))
    } finally {
        $ErrorActionPreference = "Continue"
        & docker rm -f $tmp *> $null
        $ErrorActionPreference = $previous
    }
}

if ($Run) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker rm -f $container *> $null
    $ErrorActionPreference = $previous

    $runArgs = @(
        "run", "-d", "--name", $container, "--network", $Network,
        "--cpus", $Cpus, "--memory", "${MemoryMb}m", "--memory-swap", "${MemoryMb}m",
        "-p", "${HostPort}:8099",
        "-e", "DB_HOST=postgres", "-e", "DB_PORT=5432", "-e", "DB_NAME=$DbName",
        "-e", "DB_USERNAME=postgres", "-e", "DB_PASSWORD=postgres",
        "-e", "STEWARD_PUBLIC_URL=http://steward.test"
    )
    if ($EnvFile) {
        if (-not (Test-Path $EnvFile)) { throw "No existe $EnvFile" }
        $runArgs += @("--env-file", $EnvFile)
    }
    $runArgs += @($image, "--spring.profiles.active=$Profile")

    $started = Get-Date
    Invoke-Docker "Levantando $container (1 CPU, $MemoryMb MB)" $runArgs
    $up = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:$HostPort/actuator/health"
            if ($r.StatusCode -eq 200) { $up = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $up) {
        $ErrorActionPreference = "Continue"
        & docker logs --tail 40 $container
        throw "$container no respondio UP en 30 s"
    }
    # El arranque real lo dice el log de Spring ("Started StewardApplication in N seconds").
    $ErrorActionPreference = "Continue"
    $startedLine = & docker logs $container 2>&1 | Select-String "Started StewardApplication" | Select-Object -Last 1
    $ErrorActionPreference = $previous
    Write-Host ("[OK] UP en http://localhost:{0} (el script lo vio a los {1:n1} s)" -f $HostPort, ((Get-Date) - $started).TotalSeconds) -ForegroundColor Green
    if ($startedLine) { Write-Host "     $($startedLine.Line.Trim())" }
}
