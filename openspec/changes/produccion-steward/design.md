# Design

## Context

Estado al empezar (ver proposal.md, "Why"):

- **Backend.** Completo para la PWA (Etapas 2 a 8). Se trabaja en JVM; `gradlew check` corre el contrato también en modo AOT de Spring (155 tests), la misma preparación que usa la imagen nativa. El binario nativo nunca se ha compilado entero: el 2026-10-28 un intento dejó el PC sin memoria (D11 de `backend-acceso-hogar`).
- **Herramientas listas desde la Etapa 2:**
  - `scripts/native-build.ps1` (compilar en contenedor con `-J-Xmx5g`; `-Run` con 1 CPU y 160 MB; `-Profile contract`);
  - la unit nativa `steward.service`, el vhost y `setup-vps.sh` en `infra/vps/steward/`;
  - `deploy.ps1` con el modo nativo, el rollback y `BackendEnabled = $false`.
- **Google.** El cliente OAuth de beauty ya está en el `.env` del VPS (`GOOGLE_CLIENT_ID`, 2026-10-26). Falta autorizar el origen `https://steward.srdejo.com.co` en ese cliente.
- **Ramas.** `develop` tiene la app nueva; `main`, la v1 (1.0.2) de App Store, que la spec `steward-mobile-app` exige poder seguir publicando.

Decisiones de Daniel al proponer:
- producción primero; passkeys, biometría y "Ocultar montos" van a una Etapa 10;
- cada paso que toca producción o GitHub espera su confirmación.

## Goals / Non-Goals

**Goals:**
- Que el backend corra en el VPS como binario nativo, dentro del presupuesto de memoria, con la PWA en el mismo origen.
- Que los dos miembros del hogar la usen con Google desde sus teléfonos.
- Que `main` tenga la app nueva sin perder la posibilidad de corregir la v1.

**Non-Goals:**
- Passkeys, biometría al abrir y "Ocultar montos" (Etapa 10).
- Migrar los datos de `steward.test` a producción: el hogar real empieza desde cero.
- Publicar la app Expo reescrita en App Store (sigue solo en TestFlight).
- El apagado por inactividad (activación por socket) de `optimizar-recursos-plataforma-comun`: queda como mejora.

## Decisions

### D1. Orden y puntos de confirmación

| # | Paso | Dónde | ¿Confirma Daniel antes? |
|---|---|---|---|
| 1 | Compilar el binario nativo | PC (Docker) | no; solo avisar que ocupa de 4 a 8 GB de RAM |
| 2 | Contrato contra el binario y medición | PC | no |
| 3 | Pasos de Google en la consola | Google Cloud | **lo hace Daniel** |
| 4 | `setup-vps.sh` (unit, vhost) y `.env` | VPS, sudo | **sí**; el sudo lo corre Daniel |
| 5 | `BackendEnabled = $true` (commit en `infra/`) | workspace | **sí** |
| 6 | `systemctl enable steward` y `deploy.ps1 -Projects steward` | VPS | **sí** |
| 7 | Salud por HTTPS, medición real, `PORTS.md` | VPS | no (lectura) |
| 8 | Recorrido con los dos teléfonos | producción | Daniel |
| 9 | Tag `v1.0.2`, rama `release/1.0.x`, PR `develop` → `main` | GitHub | **sí** |

Si el paso 2 falla (falta reflexión o se pasa del presupuesto), no se sigue: se corrige con *hints* (`RuntimeHintsRegistrar` en `infrastructure/configuration`) y se repite. Si el presupuesto no se puede cumplir, se pausa y se decide con Daniel, por ejemplo aceptar otra cifra o ajustar `-Xmx`.

### D2. Contrato contra el binario

Los tests de contrato ya admiten `-Dcontract.baseUrl` (Etapa 2). Contra el binario corren todos los paquetes `contract.*` sobre `steward_test`. Los que abren conexión JDBC directa a la base (borrado en cascada, migraciones) usan `DB_URL` local, que sigue siendo la misma base que usa el binario.

### D3. Medición

Con el contenedor de `native-build.ps1 -Run`, que ya lleva `--cpus=1 --memory=160m`:
- **arranque:** el tiempo hasta `Started` en el log, o hasta la primera respuesta UP de `actuator/health`;
- **RSS:** `docker stats --no-stream` en reposo, después de `POST /api/auth/dev` (con el perfil `contract`) y `GET /api/hogar`.

Las cifras van a `backend/docs/DECISIONS.md` con la fecha y la versión de GraalVM.

### D4. Google real

En el cliente OAuth de beauty (Google Cloud → Credenciales) se agrega el origen de JavaScript autorizado `https://steward.srdejo.com.co`. Google Identity Services con el botón no usa URI de redirección, así que no hace falta agregar una. Queda documentado en `DEPLOYMENT.md`. El acceso de desarrollo sigue apagado: el perfil `prod` no tiene `STEWARD_DEV_LOGIN`.

### D5. Ramas y la v1

1. Tag `v1.0.2` en el `main` actual (lo que está en App Store).
2. Rama `release/1.0.x` desde ese tag. Las correcciones de la v1 salen de ahí, con el perfil `production` de EAS.
3. PR de `develop` a `main`. El historial de `main` ya es ancestro de `develop` (cada etapa se pasó por fast-forward), así que el PR no tiene conflictos.
4. Se actualizan `AGENTS.md` (sección `mobile/`) y `DEPLOYMENT.md` (App móvil).

## Risks / Trade-offs

- **[La compilación nativa satura el PC]** → se corre con Docker abierto y nada más pesado, con el tope de `-J-Xmx5g` (D11 de `backend-acceso-hogar`). Se avisa antes de empezar.
- **[Reflexión que solo falla en nativo]** → el contrato completo contra el binario la detecta antes de encender (D1, paso 2).
- **[Usuarios reales con datos reales]** → antes de cada deploy con migraciones, `deploy.ps1 -Action Backup`. El rollback de binario ya existe.
- **[El hogar de producción empieza vacío]** → es lo esperado. El onboarding ya está probado.

## Migration Plan

Es el plan mismo (D1). Rollback:
- `deploy.ps1 -Projects steward -Action Rollback` vuelve al binario anterior;
- `BackendEnabled = $false` y un deploy devuelven "Próximamente".

## Open Questions

Ninguna. La cifra del presupuesto se decide con Daniel solo si el binario no la cumple (D1).
