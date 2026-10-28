# Proposal

## Why

La UI de Presupuesto Hogar está completa, pero solo con datos de prueba en el dispositivo. Para cumplir el objetivo del ROADMAP (dos miembros comparten un plan del mes) hace falta un hogar en la nube. Esta es la Etapa 2: el primer backend de steward, con acceso con Google, hogar e invitaciones. Además, el VPS no tiene memoria para otra JVM (`optimizar-recursos-plataforma-comun`), así que el backend nace listo para compilarse a **imagen nativa con GraalVM** al desplegar.

## What Changes

- **Backend nuevo** en `backend/`, sobre el arquetipo reactivo del workspace:
  - Java 25 (GraalVM aún no soporta 26), Spring Boot 4.1, WebFlux + R2DBC y Flyway;
  - un módulo hexagonal (`domain`, `application`, `infrastructure`), como denti-caja.
- **Imagen nativa (GraalVM), solo para desplegar**:
  - el día a día y el despliegue local son en JVM;
  - el backend queda listo para nativo: la batería de contrato pasa en el modo AOT de Spring;
  - `Dockerfile.native` y `native-build.ps1` quedan escritos.
  
  La primera compilación nativa, con su medición, se hace justo antes de encender el VPS (Etapa 9), porque compilar en nativo pide mucha memoria al PC.
- **Acceso**:
  - login con Google: ID token de Google Identity Services verificado contra las llaves de Google, con **el mismo OAuth client (cuenta de Google) de beauty**, sin client propio;
  - sesión con un JWT propio firmado con HMAC;
  - `GET /api/sesion` y cerrar sesión.
- **Hogar e invitaciones**:
  - crear y nombrar el hogar, editar el nombre propio y ver los miembros;
  - invitar por correo (vía `contact`), con un token de un solo uso que vence en 7 días;
  - reenviar, copiar el enlace, consultar una invitación, aceptarla y salir del hogar.
  
  Un usuario pertenece a un solo hogar.
- **Código común propio**: seguridad, errores y correo se escriben en steward detrás de puertos, tomando denti-caja como referencia. Una tarea final deja anotado reemplazarlos por los starters de `srdejo-platform` cuando publique su 0.1.0.
- **PWA en modo conectado**:
  - adaptador HTTP para sesión y hogar (acceso, onboarding pasos 1 y 5, invitación recibida, miembros en Ajustes);
  - los demás módulos siguen con el adaptador de prueba y con el aviso "Datos de prueba";
  - un build de solo demo sigue existiendo.
- **Despliegue local**: `local-deploy.ps1 -Project steward` levanta backend (JVM) y web juntos en `steward.test`.
- **Producción en `nolost-vps` (lista, no encendida)**: en `infra/` quedan la unit nativa y el modo `Native` de `deploy.ps1`, probados con `-WhatIf`, y `docs/DEPLOYMENT.md` documenta el despliegue nativo:
  - binario sin JDK, con versiones en `releases/`, health por loopback y rollback automático;
  - unit con tope de 160 MB;
  - el `.env` y los pasos para encenderlo.
  
  En el VPS nada cambia todavía: el backend sigue reservado (`BackendEnabled = $false`). Encenderlo se decide aparte (Etapa 9).

## Capabilities

### New Capabilities
- `steward-backend-plataforma`: base del backend (arquetipo, configuración, migraciones, formato de errores, salud), su compilación a imagen nativa y su despliegue local.
- `steward-auth`: login con Google, emisión y validación de la sesión, sesión actual y cierre.
- `steward-hogar`: hogar, miembros e invitaciones en el backend: crear, nombrar, invitar, reenviar, aceptar y salir, con sus reglas.

### Modified Capabilities
- `steward-acceso-onboarding`: en modo conectado, Acceso entra con Google real y Face ID y correo quedan como "Próximamente". El paso 1 del onboarding crea el hogar en el backend, el paso 5 envía invitaciones reales y Unirme exige iniciar sesión con Google.
- `steward-ui-shell`: el modo demo pasa a convivir con un modo conectado, en el que los módulos todavía sin backend siguen con datos de prueba y su aviso.

## Impact

- **Repo steward**:
  - `backend/` nuevo (Gradle, `build.gradle` con `org.graalvm.buildtools.native`), `backend/Dockerfile.native` (compilación con GraalVM y ejecución sobre el Debian 13 del VPS) y `scripts/native-build.ps1`;
  - en `frontend/`, el adaptador HTTP, el botón de Google (GIS) y la configuración del modo de datos;
  - `docs/DEPLOYMENT.md` y `docs/ROADMAP.md`.
- **`packages/domain`**: sin cambios de reglas. Los puertos son el contrato entre la PWA y la API.
- **Workspace** (`infra/`):
  - el programa `steward` de `local-java` recibe `GOOGLE_CLIENT_ID` (el de beauty), `JWT_SECRET` y `CONTACT_API_URL`;
  - `http://steward.test` se agrega como origen autorizado del OAuth client de beauty en Google Cloud Console (lo hace Daniel);
  - el modo `local-deploy.ps1 -Project steward -Native` (D12) queda diseñado como ensayo previo al despliegue y se construye en la Etapa 9, junto con la primera compilación nativa.
- **Correo:** solo a través de `contact`; el backend no envía correos por su cuenta.
- **Dependencias nuevas**:
  - GraalVM, en una imagen Docker para compilar;
  - Spring Security OAuth2 Resource Server (JWT).
- **Fuera de alcance**:
  - la app Expo (otra etapa);
  - el acceso por correo (enlace mágico) y las passkeys/Face ID (Etapa 9);
  - ingresos, diezmo, plan y movimientos en el backend (Etapas 3 y 4);
  - desplegar en el VPS y medir el presupuesto en producción (Etapa 9);
  - un usuario en varios hogares.
