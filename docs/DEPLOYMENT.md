# Despliegue de Steward (Presupuesto Hogar)

Steward pasa de ser una app Expo de un solo usuario, con todo guardado en el teléfono, a una app de hogar en la nube (diseño "Presupuesto Hogar v3" y su `HANDOFF.md`). El repo queda en tres capas:

| Carpeta | Qué es | Cómo se publica |
|---|---|---|
| `backend/` | API Spring Boot (por construir) | `infra/local-deploy.ps1` y `infra/deploy.ps1` del workspace |
| `frontend/` | PWA Angular (por construir) | igual que el backend: web en el mismo dominio |
| `mobile/` | App Expo v1 (App Store) | EAS, desde `mobile/` |

Mientras `backend/` (sin `gradlew.bat`) o `frontend/` (sin `package.json`) no existan, los deploys omiten esa capa con aviso y la web muestra la página "Próximamente" (`infra/vps/steward/placeholder/`).

## Dominios, puerto y base

| | Local | VPS (`nolost-vps`) |
|---|---|---|
| Web | `http://steward.test` | `https://steward.srdejo.com.co` |
| API | `/api/` y `/actuator/health` del mismo dominio | igual, proxy de nginx a `127.0.0.1:8099` |
| Puerto | 8099 en `local-java` | 8099, solo loopback |
| Base | `steward` en `local-postgres` | rol y base `steward` en el Postgres compartido |

Web y API van en un solo origen: así la cookie de sesión y las passkeys (RP ID `steward.srdejo.com.co`) funcionan sin CORS.

## Local

```powershell
.\infra\local-deploy.ps1 -Project steward    # desde PowerShell nativo, sin 2>&1
docker exec local-java supervisorctl tail -f steward
```

Requiere `127.0.0.1 steward.test` en el archivo `hosts` (lo trae `infra/hosts.snippet.txt`). Si el volumen de Postgres ya existía antes de este cambio, la base se crea a mano una vez:

```powershell
docker exec local-postgres psql -U postgres -c "CREATE DATABASE steward"
```

`infra/local-secrets/steward.env` es opcional; solo hace falta para probar con un Google Client ID real.

**Google**: steward usa el mismo OAuth client que beauty. El origen `https://steward.srdejo.com.co` ya está autorizado en Google Cloud Console. Para entrar con Google en local hay que agregar también `http://steward.test` como origen autorizado de JavaScript, y conectar el client ID al programa `steward` de `local-deploy.ps1` cuando exista el backend (como recaudo y subscription-hub).

## VPS

Configuración en `infra/vps/steward/` del workspace: vhost, `steward.service` y `setup-vps.sh`.

### Primera instalación

1. DNS: registro `A steward.srdejo.com.co` hacia el VPS. Comprobarlo con `nslookup steward.srdejo.com.co`.
2. Crear `~/apps/steward/.env` (permisos 600):
   ```
   DB_URL=r2dbc:postgresql://127.0.0.1:5432/steward   # o jdbc:..., según lo que use el backend
   DB_USERNAME=steward
   DB_PASSWORD=<generada>
   JWT_SECRET=<generada, 64+ caracteres>
   GOOGLE_CLIENT_ID=<el mismo OAuth client de beauty>   # en el VPS ya esta puesto (2026-10-26)
   CONTACT_URL=http://127.0.0.1:3000
   DB_POOL_MAX=3
   ```
3. Subir los archivos de `infra/vps/steward/` y correr una sola vez:
   ```bash
   scp infra/vps/steward/steward.service nolost-vps:~/steward.service
   scp infra/vps/steward/nginx/steward.srdejo.com.co.conf nolost-vps:~/steward.nginx.conf
   scp infra/vps/steward/setup-vps.sh nolost-vps:~/steward-setup.sh
   ssh -t nolost-vps "sudo bash ~/steward-setup.sh"
   ```
   El script crea el rol y la base, instala la unit **sin habilitarla**, la regla de sudoers, el vhost y el certificado (si el DNS ya resuelve). Al final borra lo que se subió.
4. `.\infra\deploy.ps1 -Projects steward`: publica la página "Próximamente".

### Backend reservado

En `infra/deploy.ps1` la entrada `steward` tiene `BackendEnabled = $false`. Con eso, `deploy.ps1` no sube el JAR, no toca el servicio y publica la página "Próximamente" aunque ya exista el frontend: sin API, la web no funciona. El VPS no tiene memoria para otra JVM (ver `openspec/changes/optimizar-recursos-plataforma-comun` del workspace).

Para encenderlo, cuando el backend cumpla el presupuesto de memoria:

1. `BackendEnabled = $true` en `infra/deploy.ps1`.
2. `ssh -t nolost-vps "sudo systemctl enable steward"`.
3. Si el backend usa Hikari (JDBC), agregar `steward` a `UNITS` de `infra/vps/db-pool/setup-vps.sh` y a `ALL_APPS` de `infra/vps/jvm/setup-vps.sh`.
4. `.\infra\deploy.ps1 -Projects steward`: publica el JAR y la web, y reinicia el servicio. Desde ahí, antes de cada deploy con migraciones: `.\infra\deploy.ps1 -Projects steward -Action Backup`. Comprobarlo con `https://steward.srdejo.com.co/actuator/health` → `{"status":"UP"}`.
5. Actualizar `infra/PORTS.md`: 8099 pasa de reservado a desplegado.

## App móvil (EAS)

```bash
cd mobile
npm install
npx expo start
eas build --platform ios --profile production
eas submit --platform ios
```

El `projectId` de EAS (`app.json` → `extra.eas.projectId`) y la numeración remota de versiones (`appVersionSource: remote`) no dependen de la carpeta. Mover la app a `mobile/` no cambia nada en EAS ni en App Store.

## Ajustes al HANDOFF para la plataforma común

El `HANDOFF.md` del diseño propone un despliegue propio. En este workspace se ajusta así:

| Handoff | Workspace | Motivo |
|---|---|---|
| Cloud Run / Fly.io + Neon | `nolost-vps` + Postgres compartido | Sin gasto nuevo; misma operación que el resto de apps |
| Java 21 + Spring Boot 3 | JDK 26 + Spring Boot 4.1 del arquetipo | El VPS y `local-java` corren JDK 26; `srdejo-platform` apunta a ese arquetipo |
| Enlace mágico (proveedor sin definir) | Correo por `contact` en `127.0.0.1:3000` | Como perla-ai y denti-caja |
| GraalVM en CI | Lo decide el piloto nativo de `optimizar-recursos-plataforma-comun` | Es la condición para encender el backend |

Queda abierto para el cambio que construya el backend: JdbcTemplate (lo que pide el handoff) o WebFlux + R2DBC (el arquetipo del workspace). Cualquiera sirve para el despliegue mientras sea un `bootJar` de un solo módulo en `backend/build/libs`.
