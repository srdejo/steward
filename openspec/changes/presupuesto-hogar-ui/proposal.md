# Proposal

## Why

El diseño "Presupuesto Hogar v3" (22 pantallas del canvas, con su `HANDOFF.md`) está cerrado, pero solo existe como HTML estático. La infra ya está lista (cambio `incorporar-steward`) y no hay backend todavía, que además no cabe en el VPS por ahora. Construir la UI completa contra datos de prueba deja usar y validar el producto de verdad: navegar, registrar un pago, cerrar un mes. Así los ajustes de diseño salen antes de escribir el backend. Para que el backend se conecte después sin rehacer pantallas, la UI habla con puertos (interfaces), no con datos fijos.

## What Changes

- **PWA Angular nueva** en `frontend/` con las 22 pantallas. En móvil usa barra inferior (Hoy · Planear · Cuentas); en web, menú lateral. Comparar y Plan anual están pensadas para web y en móvil se desplazan en horizontal.
- **App Expo reescrita** en `mobile/` con el diseño nuevo y las mismas pantallas y flujos. **BREAKING** para la app: reemplaza la UI y el modelo de la v1 local. Se trabaja en una rama, con la versión 1.1.0, y se distribuye **solo por TestFlight** (pruebas internas): no pasa a revisión de App Store ni sale a la tienda.
- **Paquete de dominio compartido** (`packages/domain`, TypeScript puro), usado por la PWA y por la app:
  - tipos del modelo del handoff;
  - cálculos (te queda libre, vs. plan, diezmo, aporte implícito, cuadre, cierre);
  - formato COP;
  - los puertos de datos y un adaptador de prueba en memoria con los datos de ejemplo del handoff.
- **Modo demo**:
  - el acceso con Google, Face ID o correo entra a una sesión de prueba;
  - los cambios se guardan en el dispositivo y se pueden restablecer desde Ajustes;
  - un aviso visible indica que los datos son de prueba.
- **Despliegue**: `steward.test` pasa de "Próximamente" a la PWA. En el VPS nada cambia: con el backend reservado, `steward.srdejo.com.co` sigue mostrando "Próximamente".

## Capabilities

### New Capabilities
- `steward-ui-shell`: navegación, layout responsive móvil/web, tokens visuales, formato de montos, modo demo y persistencia de datos de prueba.
- `steward-acceso-onboarding`: Acceso, Activar Face ID, Onboarding 1 a 5 e Invitación recibida.
- `steward-hoy`: pantalla Hoy, + Aporte, Marcar pago y Registrar gasto, con sus reglas (diezmo al recibir, aporte implícito, "Ya lo pagó X").
- `steward-planear`: Planear inicio, mes en borrador con escenarios, Mes sin plan, Comparar, Plan anual y Cierre de mes.
- `steward-cuentas`: Cuentas y créditos, Cuadrar todas y Detalle de crédito con simulador.
- `steward-ajustes`: Ajustes del hogar (miembros, ingresos y diezmo, categorías, seguridad y privacidad).
- `steward-mobile-app`: la app Expo con el diseño nuevo, en paridad con la PWA, distribuida solo por TestFlight y sin tocar los datos de la v1.

### Modified Capabilities
- (ninguna; `steward-deploy` ya cubre que el frontend reemplace la página "Próximamente" en local y no en el VPS con el backend reservado)

## Impact

- **Repo steward**:
  - nuevos `frontend/` (Angular 22, Tailwind 4, Vitest, service worker) y `packages/domain/`;
  - `mobile/` reescrito (expo-router), con Expo subido al SDK que usa el workspace;
  - sin workspaces npm: cada app importa el dominio como `@steward/domain` por `paths` (D1);
  - `mobile/eas.json` con perfiles `testflight` de build y submit; `app.json` en 1.1.0 solo en la rama;
  - rama `feature/presupuesto-hogar`, para que `main` siga pudiendo publicar la v1.
- **Workspace**: ninguno en `infra/` (las capas opcionales ya detectan `frontend/package.json`). Se actualizan el `ROADMAP.md` de steward y el portafolio.
- **Fuera de alcance**: el backend y sus llamadas HTTP reales, el login real con Google, passkeys y enlace mágico, notificaciones, la migración de los datos locales de la v1 la revisión y publicación en App Store, y cualquier distribución por Google Play.
