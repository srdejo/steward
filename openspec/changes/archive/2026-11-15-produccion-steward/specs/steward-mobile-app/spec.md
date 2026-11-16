## MODIFIED Requirements

### Requirement: Distribución solo por TestFlight
La app reescrita SHALL distribuirse solo por TestFlight, al grupo de pruebas internas, con la versión 1.1.0 en el `app.json` de la rama. MUST NOT enviarse a revisión de App Store ni publicarse en la tienda, y MUST NOT distribuirse por Google Play. El build SHALL salir del perfil `testflight` de `eas.json` (distribución de tienda y número de build remoto con autoincremento), y el envío, del perfil de submit `testflight`. La v1 de App Store (1.0.2) MUST seguir pudiendo corregirse y publicarse desde la rama `release/1.0.x`, creada del tag `v1.0.2` antes de pasar `develop` a `main`, con su perfil `production`.

#### Scenario: Build en TestFlight
- **WHEN** desde la rama se ejecuta `eas build --profile testflight --platform ios --auto-submit-with-profile testflight`
- **THEN** el build 1.1.0 aparece en TestFlight para los testers internos, ninguna versión se envía a revisión en App Store Connect y la tienda sigue mostrando la 1.0.2

#### Scenario: La v1 sigue publicable
- **WHEN** se revisa `release/1.0.x` (o el tag `v1.0.2`)
- **THEN** `mobile/app.json` está en 1.0.2 y `mobile/eas.json` conserva el perfil `production` y su submit sin cambios, aunque `main` ya tenga la app reescrita
