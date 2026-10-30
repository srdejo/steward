# Despliegue de Steward (Presupuesto Hogar)

Steward pasa de ser una app Expo de un solo usuario, con todo guardado en el teléfono, a una app de hogar en la nube (diseño "Presupuesto Hogar v3" y su `HANDOFF.md`). El repo queda en tres capas:

| Carpeta | Qué es | Cómo se publica |
|---|---|---|
| `backend/` | API Spring Boot 4.1 reactiva (Java 25), lista para imagen nativa | local: JVM con `infra/local-deploy.ps1`; VPS: binario nativo con `infra/deploy.ps1` (reservado) |
| `frontend/` | PWA Angular 22 | igual que el backend: web en el mismo dominio |
| `mobile/` | App Expo (`main`: v1 de App Store; `develop`: diseño nuevo en TestFlight) | EAS, desde `mobile/` |

Si `backend/` (sin `gradlew.bat`) o `frontend/` (sin `package.json`) no existen, los deploys omiten esa capa con aviso y la web muestra la página "Próximamente" (`infra/vps/steward/placeholder/`).

## Dominios, puerto y base

| | Local | VPS (`nolost-vps`) |
|---|---|---|
| Web | `http://steward.test` | `https://steward.srdejo.com.co` |
| API | `/api/` y `/actuator/health` del mismo dominio | igual, proxy de nginx a `127.0.0.1:8099` |
| Puerto | 8099 en `local-java` | 8099, solo loopback |
| Base | `steward` en `local-postgres` (y `steward_test` para los tests) | rol y base `steward` en el Postgres compartido |

Web y API van en un solo origen: así la sesión y, más adelante, las passkeys (RP ID `steward.srdejo.com.co`) funcionan sin CORS.

## Google

Steward **no tiene OAuth client propio: usa el de beauty**, el mismo client "Aplicación web" y la misma cuenta de Google.

- `GOOGLE_CLIENT_ID` tiene el mismo valor en `~/apps/beauty/.env` y `~/apps/steward/.env` del VPS, y en `infra/local-secrets/steward.env` local. **No** es el de perla-ai, que usan las otras apps en local.
- Origen autorizado de JavaScript de ese client: `https://steward.srdejo.com.co`. Google **no acepta** `http://steward.test` (solo dominios públicos o `localhost`); en local se entra con el acceso de desarrollo (abajo).
- Google Identity Services solo usa el client id: no hay client secret.
- La sesión de steward es independiente de la de beauty: cada una firma con su propio `JWT_SECRET`, que **no se comparte**.
- Cambiar el nombre o el logo de la pantalla de consentimiento, o rotar el client, afecta a las dos apps.

### Autorizar el origen de producción (una vez, lo hace Daniel)

1. Entrar a [Google Cloud Console](https://console.cloud.google.com/) con la cuenta de beauty y elegir el proyecto de beauty.
2. **APIs y servicios → Credenciales → IDs de clientes de OAuth 2.0**, abrir el client "Aplicación web" cuyo id es el `GOOGLE_CLIENT_ID` del `.env` de beauty.
3. En **Orígenes autorizados de JavaScript**, **Agregar URI**: `https://steward.srdejo.com.co` (sin barra final). No hace falta tocar los **URI de redireccionamiento**: el botón de Google Identity Services no los usa.
4. **Guardar**. Google avisa que puede tardar de 5 minutos a unas horas en aplicarse.
5. Si la pantalla de consentimiento está en modo **Prueba**, agregar los dos correos del hogar en **Usuarios de prueba**; si está **En producción**, no hace falta.

Para comprobarlo: en `https://steward.srdejo.com.co`, el botón "Continuar con Google" abre la ventana de cuentas sin el error `origin_mismatch`.

## Correo

Todos los correos (las invitaciones) salen por la API **`contact`** del workspace (`POST /api/send`, solo loopback). El backend no tiene SMTP ni credenciales de correo. Con `STEWARD_MAIL_MODO=log`, que es lo que usa el perfil `dev`, el enlace de invitación se escribe en el log en vez de enviarse.

## Local

```powershell
.\infra\local-deploy.ps1 -Project steward    # desde PowerShell nativo, sin redirigir stderr (2>&1 ni *>)
docker exec local-java supervisorctl tail -f steward
```

- **Backend:** corre en la JVM (`bootJar`) dentro de `local-java`. Los secretos están en `infra/local-secrets/steward.env`, ignorado por Git; si no existe, `local-deploy.ps1` lo crea con un `JWT_SECRET` nuevo y `GOOGLE_CLIENT_ID` vacío:

  ```
  GOOGLE_CLIENT_ID=<opcional en local; el de beauty: ssh nolost-vps "grep GOOGLE_CLIENT_ID ~/apps/beauty/.env">
  JWT_SECRET=<propio de steward>
  # STEWARD_MAIL_MODO=contact     (por defecto, log: el enlace queda en el log del backend)
  ```

- **Acceso de desarrollo:** como Google no acepta `steward.test`, en local Acceso muestra **"Entrar como…"** (correo y nombre), y con eso se prueba con varias personas en ventanas o perfiles distintos. Lo enciende `STEWARD_DEV_LOGIN=true`, que `local-deploy.ps1` pone solo en local. En el VPS (perfil `prod`, sin esa variable) está apagado y `POST /api/auth/dev` responde 404.
- **PWA:** se publica en modo **conectado**. Sesión, hogar, miembros e invitaciones vienen del backend; el resto sigue con datos de prueba, con su aviso. Ver `frontend/README.md`.
- **Requisitos:** `127.0.0.1 steward.test` en el archivo `hosts` (lo trae `infra/hosts.snippet.txt`). Si el volumen de Postgres ya existía antes de este cambio, las bases se crean a mano una vez:

  ```powershell
  docker exec local-postgres psql -U postgres -c "CREATE DATABASE steward"
  docker exec local-postgres psql -U postgres -c "CREATE DATABASE steward_test"
  ```

- **Service worker:** no se registra en `http://steward.test`, porque los navegadores solo lo permiten en HTTPS o en `localhost`. Funciona en producción.

### Imagen nativa: solo para desplegar

El día a día es en JVM. Compilar en nativo pide de 4 a 8 GB de RAM: el 2026-10-28 dejó el PC sin memoria y tumbó Docker. La red de seguridad diaria es `.\gradlew.bat aotTest` en `backend/`, que corre la batería de contrato con la app en modo AOT de Spring, la misma preparación que usa la imagen nativa. Corre con `check`.

## VPS

Configuración en `infra/vps/steward/` del workspace: vhost, `steward.service` y `setup-vps.sh`.

### Backend reservado

En `infra/deploy.ps1` la entrada `steward` tiene `BackendEnabled = $false`. Con eso, `deploy.ps1 -Projects steward` no sube el binario, no toca el servicio y publica la página "Próximamente" aunque ya exista el frontend: la PWA conectada necesita la API. **Encenderlo es una decisión aparte** (Etapa 9 del ROADMAP), porque publica la PWA a usuarios reales con módulos todavía en datos de prueba.

Para ver los pasos sin tocar el VPS:

```powershell
.\infra\deploy.ps1 -Projects steward -WhatIf                                              # lo que hace hoy: "Próximamente"
.\infra\deploy.ps1 -Projects steward -Action Backend -WhatIf -SimularBackendEncendido      # los pasos nativos
```

### Cómo corre: binario nativo, sin JDK

- Un binario Linux compilado con GraalVM en el PC (`scripts/native-build.ps1`, en un contenedor). El VPS no compila.
- No usa `~/opt/jdk-26` ni los drop-ins `java26/`, `jvm/` (`JAVA_TOOL_OPTIONS`, caché AOT) ni `db-pool/` (Hikari): el pool es R2DBC y se limita con `DB_POOL_MAX=3`.
- Flyway corre dentro del binario al arrancar.

En `~/apps/steward/`:

| Archivo | Qué es |
|---|---|
| `releases/steward-<fecha>-<commit>` | cada binario subido; se dejan los últimos 3 |
| `steward` | enlace al binario activo (lo que arranca la unit) |
| `steward.prev` | enlace al anterior, para volver atrás |
| `.env` | variables (600); tabla abajo |
| `frontend/` | la PWA, servida por nginx |

La unit `steward.service` ejecuta `~/apps/steward/steward -Xmx64m --spring.profiles.active=prod` en `127.0.0.1:8099`. Tiene `MemoryHigh=128M` y `MemoryMax=160M`, el presupuesto de `optimizar-recursos-plataforma-comun`, y el mismo hardening de las demás apps.

`.env` de producción:

| Variable | Valor |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME` | `127.0.0.1`, `5432`, `steward` |
| `DB_USERNAME`, `DB_PASSWORD` | rol `steward` (lo crea `setup-vps.sh`) |
| `DB_POOL_MAX` | `3` |
| `JWT_SECRET` | propio de steward, 64+ caracteres |
| `GOOGLE_CLIENT_ID` | el de beauty (ya puesto el 2026-10-26) |
| `CONTACT_API_URL` | `http://127.0.0.1:3000` (reemplaza a `CONTACT_URL`) |
| `STEWARD_PUBLIC_URL` | `https://steward.srdejo.com.co` |

### Qué hace `deploy.ps1 -Projects steward` con el backend encendido

1. Si la versión trae migraciones, antes: `.\infra\deploy.ps1 -Projects steward -Action Backup` (verificar el `.sql.gz`).
2. Compila el binario con `scripts/native-build.ps1` y la PWA con `ng build -c production` (modo conectado).
3. Sube el binario a `releases/`, le da permisos de ejecución y mueve los enlaces: `steward.prev` pasa a ser el activo de antes y `steward`, el nuevo.
4. Reinicia el servicio y espera `GET http://127.0.0.1:8099/actuator/health` por SSH, hasta 30 s.
5. **Si no responde UP**, vuelve solo a `steward.prev` y termina en error, **sin publicar la web nueva**.
6. Si responde, publica la PWA y deja los últimos 3 binarios.

A mano: `.\infra\deploy.ps1 -Projects steward -Action Rollback` vuelve al binario anterior. Una migración aditiva no se deshace.

### Antes de encender el VPS

Es la primera compilación nativa real; se hace solo para desplegar.

1. **Compilar** con Docker abierto y nada más pesado: `.\scripts\native-build.ps1`. Compila con un tope de `-J-Xmx5g`; imágenes y versiones en `backend/docs/DECISIONS.md`.
2. **Contrato contra el binario:**
   ```powershell
   .\scripts\native-build.ps1 -Run -SkipBuild -Profile contract -DbName steward_test
   cd backend; .\gradlew.bat test --tests "co.com.srdejo.steward.contract.*" "-Dcontract.baseUrl=http://localhost:18099"
   ```
   Todos deben pasar. Si falta reflexión, se agrega un *hint* en `infrastructure/configuration`.
3. **Medir** con los límites del VPS: el contenedor de `-Run` ya corre con 1 CPU y 160 MB. Tiene que quedar en menos de 120 MB de RSS en reposo, tras un login y un `GET /api/hogar`, y arrancar en menos de 2 s. Las cifras van a `DECISIONS.md`.
4. **Opcional:** ensayar `steward.test` sobre el binario. El modo `local-deploy -Native` está descrito en el design D12 del cambio `backend-acceso-hogar` y se construye en ese momento.

### Encender por primera vez (cuando se decida)

1. Subir la unit nativa y el vhost, y correr `setup-vps.sh` (Daniel, con sudo):
   ```bash
   scp infra/vps/steward/steward.service nolost-vps:~/steward.service
   scp infra/vps/steward/nginx/steward.srdejo.com.co.conf nolost-vps:~/steward.nginx.conf
   scp infra/vps/steward/setup-vps.sh nolost-vps:~/steward-setup.sh
   ssh -t nolost-vps "sudo bash ~/steward-setup.sh"
   ```
   La CSP del vhost ya permite Google Identity Services (`accounts.google.com/gsi/`) y Google Fonts.
2. Completar `~/apps/steward/.env` con la tabla de arriba.
3. `BackendEnabled = $true` en `infra/deploy.ps1`.
4. `ssh -t nolost-vps "sudo systemctl enable steward"`.
5. `.\infra\deploy.ps1 -Projects steward`, y comprobar `https://steward.srdejo.com.co/actuator/health` → `{"status":"UP"}`.
6. Medir con `infra/vps/resources/measure.sh` y anotar la memoria real en `infra/PORTS.md` (8099 pasa de reservado a desplegado).

Más adelante, como arranca en menos de 2 s, puede usar el apagado por inactividad (activación por socket) de `optimizar-recursos-plataforma-comun`.

## App móvil (EAS)

```bash
cd mobile
npm install
npx expo start
eas build --profile testflight --platform ios --auto-submit-with-profile testflight   # develop: solo TestFlight
eas build --platform ios --profile production && eas submit --platform ios           # main: la v1
```

El `projectId` de EAS (`app.json` → `extra.eas.projectId`) y la numeración remota de versiones (`appVersionSource: remote`) no dependen de la carpeta.

## Ajustes al HANDOFF para la plataforma común

El `HANDOFF.md` del diseño propone un despliegue propio. En este workspace se ajusta así:

| Handoff | Workspace | Motivo |
|---|---|---|
| Cloud Run / Fly.io + Neon | `nolost-vps` + Postgres compartido | Sin gasto nuevo; misma operación que el resto de apps |
| Java 21 + Spring Boot 3 + JdbcTemplate | Java 25 + Spring Boot 4.1, WebFlux + R2DBC (arquetipo reactivo) | El arquetipo del workspace; Java 25 porque GraalVM aún no soporta 26 |
| Enlace mágico (proveedor sin definir) | Correo por `contact` en `127.0.0.1:3000` (por ahora solo invitaciones) | Como perla-ai y denti-caja |
| GraalVM en CI | GraalVM en un contenedor del PC, solo para desplegar | El VPS no compila; el día a día es JVM con `aotTest` |
