## MODIFIED Requirements

### Requirement: Distribución solo por TestFlight
La app reescrita SHALL distribuirse solo por TestFlight, al grupo de pruebas internas, con la versión 2.2.1 en el `app.json` de `main`. MUST NOT enviarse a revisión de App Store ni publicarse en la tienda, y MUST NOT distribuirse por Google Play. El build SHALL salir del perfil `testflight` de `eas.json` (distribución de tienda y número de build remoto con autoincremento), y el envío, del perfil de submit `testflight`. La v1 (1.0.2) MUST seguir pudiendo generarse desde la rama `release/1.0.x` con su perfil `production`.

#### Scenario: Build en TestFlight
- **WHEN** desde la rama se ejecuta `eas build --profile testflight --platform ios --auto-submit-with-profile testflight`
- **THEN** el build 2.2.1 aparece en TestFlight para los testers internos, ninguna versión se envía a revisión en App Store Connect y la tienda sigue mostrando la 1.0.2

#### Scenario: La v1 sigue publicable
- **WHEN** se revisa `release/1.0.x`, la rama que sale del tag `v1.0.2`
- **THEN** `app.json`, en la raíz de esa rama, sigue en 1.0.2 y `eas.json` conserva el perfil `production` y su submit sin cambios
