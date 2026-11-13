## MODIFIED Requirements

### Requirement: Paridad con la PWA
La app SHALL implementar las mismas pantallas y flujos que la PWA en su layout móvil, con la misma navegación (barra inferior Hoy · Planear · Cuentas) y los mismos requisitos de `steward-ui-shell`, `steward-acceso-onboarding`, `steward-hoy`, `steward-planear`, `steward-cuentas` y `steward-ajustes`. Comparar MUST desplazarse en horizontal. El plan anual MUST mostrarse como la lista de los 12 meses de `steward-planear` ("Plan anual", vista con menos de 1024 px), sin tabla con desplazamiento horizontal. Los cálculos y los datos de prueba MUST salir del mismo paquete de dominio que usa la PWA, de modo que un mismo registro dé las mismas cifras en las dos.

#### Scenario: Mismas cifras
- **WHEN** en la app y en la PWA, desde los datos iniciales, se marca pagada la Tarjeta Mastercard por $1.500.000 desde Davivienda
- **THEN** las dos muestran el mismo "Te queda libre", el mismo Pagado y el mismo Vs. plan

#### Scenario: Mismo año en la app y la PWA
- **WHEN** en la app y en la PWA, desde los datos iniciales, se replica octubre de 2026 en 2027 y se agrega "Revisión carro" de $400.000 solo en mayo
- **THEN** las dos muestran el mismo libre del año, y mayo deja libre lo mismo en las dos: $400.000 menos que febrero

### Requirement: Distribución solo por TestFlight
La app reescrita SHALL distribuirse solo por TestFlight, al grupo de pruebas internas, con la versión 2.1.0 en el `app.json` de `main`. MUST NOT enviarse a revisión de App Store ni publicarse en la tienda, y MUST NOT distribuirse por Google Play. El build SHALL salir del perfil `testflight` de `eas.json` (distribución de tienda y número de build remoto con autoincremento), y el envío, del perfil de submit `testflight`. La v1 (1.0.2) MUST seguir pudiendo generarse desde la rama `release/1.0.x` con su perfil `production`.

#### Scenario: Build en TestFlight
- **WHEN** desde la rama se ejecuta `eas build --profile testflight --platform ios --auto-submit-with-profile testflight`
- **THEN** el build 2.1.0 aparece en TestFlight para los testers internos, ninguna versión se envía a revisión en App Store Connect y la tienda sigue mostrando la 1.0.2

#### Scenario: La v1 sigue publicable
- **WHEN** se revisa `release/1.0.x`, la rama que sale del tag `v1.0.2`
- **THEN** `app.json`, en la raíz de esa rama, sigue en 1.0.2 y `eas.json` conserva el perfil `production` y su submit sin cambios
