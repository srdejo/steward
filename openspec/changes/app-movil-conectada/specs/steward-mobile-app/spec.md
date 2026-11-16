## ADDED Requirements

### Requirement: Conectada al backend
La app SHALL usar el backend de producción, con la misma capa conectada que la PWA, para todo lo que se lee y se registra. La sesión MUST guardarse en el Keychain del dispositivo y validarse con el backend al abrir. Sin conexión, la app MUST mostrar el error y permitir reintentar, sin mostrar datos de prueba.

#### Scenario: Sesión guardada
- **WHEN** Daniel entró ayer y abre la app
- **THEN** ve su hogar sin volver a entrar

#### Scenario: Sesión vencida
- **WHEN** el backend responde 401 al validar la sesión
- **THEN** la sesión se borra y se abre Acceso

#### Scenario: Sin conexión
- **WHEN** se abre la app sin red
- **THEN** muestra que no hay conexión, con "Reintentar", y ningún dato de prueba

### Requirement: Acceso en la app
Acceso SHALL ofrecer "Continuar con Google", con el selector nativo, y "Continuar con Apple" con el botón del sistema. MUST NOT ofrecer Face ID ni correo. Cancelar el selector MUST dejar la pantalla igual, sin error.

#### Scenario: Entrar con Google
- **WHEN** Daniel toca "Continuar con Google" y elige su cuenta
- **THEN** entra a su hogar, el mismo de la PWA

#### Scenario: Cancelar
- **WHEN** se abre el selector de Apple y se cancela
- **THEN** Acceso sigue abierta y sin mensaje de error

### Requirement: Invitaciones en la app
Una persona sin hogar SHALL ver en la app las invitaciones para el correo de su sesión y poder unirse, y MUST ver ese correo para poder compartirlo.

#### Scenario: Correo oculto de Apple
- **WHEN** alguien entra con Apple ocultando su correo y no tiene invitaciones
- **THEN** ve el correo de su sesión, con que le pueden invitar

### Requirement: Aviso a quien viene de la v1
Al primer ingreso, si el dispositivo tiene datos de la v1, la app SHALL avisar una sola vez que esta versión empieza de cero y guarda en la nube, y que los datos anteriores siguen en el teléfono.

#### Scenario: Con datos de la v1
- **WHEN** alguien actualiza desde la v1 y entra por primera vez
- **THEN** ve el aviso una vez, y no vuelve a verlo

#### Scenario: Sin datos de la v1
- **WHEN** alguien instala la app por primera vez
- **THEN** no ve el aviso

### Requirement: Distribución en TestFlight y App Store
La app SHALL salir con la versión del `app.json` de `main` (hoy 2.2.1), con el perfil `testflight` de `eas.json` (distribución de tienda y número de build remoto con autoincremento): primero por TestFlight y, con confirmación de Daniel, a revisión de App Store con un build ya probado en TestFlight, en lugar de la v1. La ficha de App Store Connect MUST llevar el mismo número de versión que ese build. MUST NOT distribuirse por Google Play. La v1 SHALL seguir en `release/1.0.x` y su tag `v1.0.2`.

#### Scenario: Primero TestFlight
- **WHEN** se genera el build de la versión actual
- **THEN** llega a TestFlight y ninguna versión se envía a revisión sin la confirmación de Daniel

#### Scenario: A revisión el build probado
- **WHEN** Daniel confirma el envío a revisión
- **THEN** se envía el build que ya probaron en TestFlight, con la ficha en su misma versión, y ninguno otro

#### Scenario: La v1 sigue publicable
- **WHEN** se revisa `release/1.0.x`, la rama que sale del tag `v1.0.2`
- **THEN** `app.json`, en la raíz de esa rama, sigue en 1.0.2 y `eas.json` conserva el perfil `production` y su submit sin cambios

## MODIFIED Requirements

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

#### Scenario: Los mismos datos
- **WHEN** Daniel registra un gasto en la PWA y abre la app con su cuenta
- **THEN** la app muestra ese gasto y las mismas cifras

### Requirement: Persistencia propia sin tocar la v1
La app SHALL guardar los datos de prueba en el dispositivo con una clave de almacenamiento distinta de la que usa la v1. Instalada sobre la v1, MUST NOT leer, modificar ni borrar los datos locales de la v1.

#### Scenario: Instalación sobre la v1
- **WHEN** la app nueva se instala en un dispositivo con datos de la v1 y luego se reinstala la v1
- **THEN** la v1 muestra sus datos intactos

#### Scenario: Actualizar desde la v1
- **WHEN** la versión actual de la app se instala sobre la v1 y se usa
- **THEN** `@steward/budget_v3` sigue igual que antes de actualizar

## REMOVED Requirements

### Requirement: Distribución solo por TestFlight
**Reason**: La app reemplaza a la v1 en App Store.
**Migration**: Ver "Distribución en TestFlight y App Store". La v1 queda en `release/1.0.x`.
