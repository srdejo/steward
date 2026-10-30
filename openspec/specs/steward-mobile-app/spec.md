# steward-mobile-app Specification

## Purpose

Define la app Expo de `mobile/` reescrita con el diseño de Presupuesto Hogar: paridad con la PWA, el mismo dominio compartido y la distribución por TestFlight sin afectar la v1 publicada.

## Requirements

### Requirement: Paridad con la PWA
La app SHALL implementar las mismas pantallas y flujos que la PWA en su layout móvil, con la misma navegación (barra inferior Hoy · Planear · Cuentas) y los mismos requisitos de `steward-ui-shell`, `steward-acceso-onboarding`, `steward-hoy`, `steward-planear`, `steward-cuentas` y `steward-ajustes`. Comparar y Plan anual MUST desplazarse en horizontal. Los cálculos y los datos de prueba MUST salir del mismo paquete de dominio que usa la PWA, de modo que un mismo registro dé las mismas cifras en las dos.

#### Scenario: Mismas cifras
- **WHEN** en la app y en la PWA, desde los datos iniciales, se marca pagada la Tarjeta Mastercard por $1.500.000 desde Davivienda
- **THEN** las dos muestran el mismo "Te queda libre", el mismo Pagado y el mismo Vs. plan

### Requirement: Persistencia propia sin tocar la v1
La app SHALL guardar los datos de prueba en el dispositivo con una clave de almacenamiento distinta de la que usa la v1. Instalada sobre la v1, MUST NOT leer, modificar ni borrar los datos locales de la v1.

#### Scenario: Instalación sobre la v1
- **WHEN** la app nueva se instala en un dispositivo con datos de la v1 y luego se reinstala la v1
- **THEN** la v1 muestra sus datos intactos

### Requirement: Distribución solo por TestFlight
La app reescrita SHALL distribuirse solo por TestFlight, al grupo de pruebas internas, con la versión 1.1.0 en el `app.json` de la rama. MUST NOT enviarse a revisión de App Store ni publicarse en la tienda, y MUST NOT distribuirse por Google Play. El build SHALL salir del perfil `testflight` de `eas.json` (distribución de tienda y número de build remoto con autoincremento), y el envío, del perfil de submit `testflight`. La rama `main` MUST seguir pudiendo generar la v1 con la versión 1.0.2 y su perfil `production`.

#### Scenario: Build en TestFlight
- **WHEN** desde la rama se ejecuta `eas build --profile testflight --platform ios --auto-submit-with-profile testflight`
- **THEN** el build 1.1.0 aparece en TestFlight para los testers internos, ninguna versión se envía a revisión en App Store Connect y la tienda sigue mostrando la 1.0.2

#### Scenario: La v1 sigue publicable
- **WHEN** se revisa `release/1.0.x`, la rama que sale del tag `v1.0.2`
- **THEN** `mobile/app.json` sigue en 1.0.2 y `mobile/eas.json` conserva el perfil `production` y su submit sin cambios
