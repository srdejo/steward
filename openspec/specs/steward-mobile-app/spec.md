# steward-mobile-app Specification

## Purpose

Define la app Expo de `mobile/` reescrita con el diseño de Presupuesto Hogar: paridad con la PWA, el mismo dominio compartido y la distribución por TestFlight sin afectar la v1 publicada.

## Requirements

### Requirement: Paridad con la PWA
La app SHALL implementar las mismas pantallas y flujos que la PWA en su layout móvil, con la misma navegación (barra inferior Hoy · Planear · Cuentas) y los mismos requisitos de `steward-ui-shell`, `steward-acceso-onboarding`, `steward-hoy`, `steward-planear`, `steward-cuentas`, `steward-tarjetas` y `steward-ajustes`. Cuentas MUST tener las pestañas Cuentas · Tarjetas · Créditos, y "¿Cómo baja el saldo?" se elige en una hoja. Comparar MUST desplazarse en horizontal. El plan anual MUST mostrarse como la lista de los 12 meses de `steward-planear` ("Plan anual", vista con menos de 1024 px), sin tabla con desplazamiento horizontal. Los cálculos y los datos de prueba MUST salir del mismo paquete de dominio que usa la PWA, de modo que un mismo registro dé las mismas cifras en las dos.

#### Scenario: Mismas cifras
- **WHEN** en la app y en la PWA, desde los datos iniciales, se marca pagada la Tarjeta Mastercard por $1.500.000 desde Davivienda
- **THEN** las dos muestran el mismo "Te queda libre", el mismo Pagado y el mismo Vs. plan

#### Scenario: Mismo año en la app y la PWA
- **WHEN** en la app y en la PWA, desde los datos iniciales, se replica octubre de 2026 en 2027 y se agrega "Revisión carro" de $400.000 solo en mayo
- **THEN** las dos muestran el mismo libre del año, y mayo deja libre lo mismo en las dos: $400.000 menos que febrero

#### Scenario: Mismas tarjetas y créditos
- **WHEN** en la app y en la PWA, desde los datos iniciales, se abre Cuentas › Tarjetas y luego Créditos
- **THEN** las dos muestran "Por pagar este ciclo $2.620.000", las mismas próximas fechas, "Deben en créditos $17.625.000" y "Pagan al mes $875.000"

### Requirement: Persistencia propia sin tocar la v1
La app SHALL guardar los datos de prueba en el dispositivo con una clave de almacenamiento distinta de la que usa la v1. Instalada sobre la v1, MUST NOT leer, modificar ni borrar los datos locales de la v1.

#### Scenario: Instalación sobre la v1
- **WHEN** la app nueva se instala en un dispositivo con datos de la v1 y luego se reinstala la v1
- **THEN** la v1 muestra sus datos intactos

### Requirement: Distribución solo por TestFlight
La app reescrita SHALL distribuirse solo por TestFlight, al grupo de pruebas internas, con la versión 2.2.0 en el `app.json` de `main`. MUST NOT enviarse a revisión de App Store ni publicarse en la tienda, y MUST NOT distribuirse por Google Play. El build SHALL salir del perfil `testflight` de `eas.json` (distribución de tienda y número de build remoto con autoincremento), y el envío, del perfil de submit `testflight`. La v1 (1.0.2) MUST seguir pudiendo generarse desde la rama `release/1.0.x` con su perfil `production`.

#### Scenario: Build en TestFlight
- **WHEN** desde la rama se ejecuta `eas build --profile testflight --platform ios --auto-submit-with-profile testflight`
- **THEN** el build 2.2.0 aparece en TestFlight para los testers internos, ninguna versión se envía a revisión en App Store Connect y la tienda sigue mostrando la 1.0.2

#### Scenario: La v1 sigue publicable
- **WHEN** se revisa `release/1.0.x`, la rama que sale del tag `v1.0.2`
- **THEN** `app.json`, en la raíz de esa rama, sigue en 1.0.2 y `eas.json` conserva el perfil `production` y su submit sin cambios
