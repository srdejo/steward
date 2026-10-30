# Proposal

## Why

Con la Etapa 8, Presupuesto Hogar está completo en modo conectado: hogar, plan del mes con opciones, registros, cuentas, créditos, cierre y plan anual, todo real y verificado en `steward.test`. Pero nadie lo usa todavía:
- en el VPS el backend sigue reservado (`BackendEnabled = $false`) y `https://steward.srdejo.com.co` muestra "Próximamente";
- el binario nativo nunca se ha compilado ni medido contra el presupuesto de memoria del VPS;
- `develop` no ha pasado a `main`.

Esta es la parte de producción de la Etapa 9 del ROADMAP. Daniel eligió llevar la app a uso real primero; passkeys, biometría al abrir y "Ocultar montos" pasan a una etapa posterior (la 12, tras el diezmo como gasto y la app móvil conectada).

Criterio de cierre: `https://steward.srdejo.com.co/actuator/health` responde `{"status":"UP"}` con el backend dentro del presupuesto de memoria del VPS, y los dos miembros del hogar entran con Google desde sus teléfonos y usan la app.

## What Changes

- **Binario nativo verificado** (la lista "Antes de encender el VPS" de `DEPLOYMENT.md`):
  - compilarlo con `scripts/native-build.ps1`;
  - pasar todo el contrato contra el binario;
  - medir menos de 120 MB de RSS y menos de 2 s de arranque con los límites del VPS.

  Si falta reflexión, se agregan *hints*. Las cifras van a `DECISIONS.md`.
- **Encender el backend en el VPS**, paso a paso y con la confirmación de Daniel antes de cada acción que toca producción:
  1. `setup-vps.sh` (unit nativa y vhost);
  2. `.env`;
  3. `BackendEnabled = $true`;
  4. `systemctl enable`;
  5. `deploy.ps1 -Projects steward`;
  6. la salud por HTTPS;
  7. la medición real en `PORTS.md`.
- **Google real**: el origen `https://steward.srdejo.com.co` en el cliente OAuth de beauty (lo hace Daniel en la consola de Google, con los pasos que quedan en `DEPLOYMENT.md`). El acceso de desarrollo sigue apagado en producción.
- **Uso real**: los dos miembros entran con Google desde sus teléfonos e instalan la PWA. El hogar de producción empieza desde cero: los datos de `steward.test` no se migran.
- **`develop` a `main`**, con confirmación:
  - tag `v1.0.2` en `main` antes del merge;
  - rama `release/1.0.x` desde ese tag, para corregir la v1 de App Store;
  - PR de `develop` a `main`.
- **Spec `steward-mobile-app`**: la v1 se corrige desde `release/1.0.x`, no desde `main`. La app reescrita sigue solo en TestFlight.
- **Spec `steward-backend-plataforma`**: el backend queda encendido en el VPS como binario nativo medido, y "Próximamente" deja de publicarse.
- **ROADMAP**: la Etapa 9 queda en producción. Siguen la Etapa 10 (diezmo como gasto presupuestado), la 11 (app móvil conectada) y la 12 (passkeys, biometría y "Ocultar montos").

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-backend-plataforma`:
  - "Despliegue nativo al VPS preparado" pasa a "encendido";
  - "Publicación local con la web" ya no habla de "Próximamente";
  - nuevo: "Binario nativo medido".
- `steward-mobile-app`: "Distribución solo por TestFlight", con la v1 desde `release/1.0.x`.

## Impact

- **`backend/`**:
  - *hints* de reflexión si el binario los pide;
  - `docs/DECISIONS.md` con las cifras medidas.
- **`docs/`**:
  - `DEPLOYMENT.md` (Google real, encendido hecho, rama de la v1);
  - `ROADMAP.md` (Etapa 9 y las Etapas 10 a 12).
- **Workspace `infra/`**:
  - `deploy.ps1` (`BackendEnabled = $true`);
  - `PORTS.md` (8099 desplegado).

  Es otro repo y lleva su propio commit.
- **Fuera de los repos**, con confirmación:
  - el VPS (`setup-vps.sh`, `.env`, `systemctl`, deploy);
  - GitHub (tag `v1.0.2`, rama `release/1.0.x`, PR a `main`);
  - la consola de Google (la hace Daniel).
- **Sin cambios** en la PWA, el dominio ni la app Expo.
