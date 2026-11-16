## MODIFIED Requirements

### Requirement: Navegación principal
La UI SHALL tener tres destinos principales, con estos nombres visibles: **Ejecución** (la pantalla Hoy), **Plan** (la pantalla Planear) y **Cuentas**. Las rutas `/hoy` y `/planear` MUST NOT cambiar. Con un ancho menor a 1024 px MUST mostrarse como barra inferior con esos tres destinos, y Ajustes MUST abrirse desde los avatares del hogar en Hoy, sin ser destino de la barra. Desde 1024 px MUST mostrarse como menú lateral con los tres destinos más **Ajustes** como cuarto destino; los avatares también abren Ajustes. Al abrir la app con sesión, SHALL mostrarse siempre Hoy del mes en curso.

#### Scenario: Móvil
- **WHEN** la PWA se abre a 390 px de ancho con sesión iniciada
- **THEN** se ve Hoy del mes en curso y una barra inferior con Hoy (activo), Planear y Cuentas

#### Scenario: Web
- **WHEN** la PWA se abre a 1280 px de ancho
- **THEN** el menú lateral muestra Ejecución, Plan, Cuentas y Ajustes, y no hay barra inferior

#### Scenario: Ajustes desde el menú lateral
- **WHEN** a 1280 px se toca Ajustes en el menú lateral
- **THEN** se abre Ajustes y queda marcado como destino activo

#### Scenario: Ajustes desde los avatares
- **WHEN** en Hoy se toca el grupo de avatares "D E"
- **THEN** se abre Ajustes del hogar, con "‹ Hoy" para volver

#### Scenario: Los nombres nuevos
- **WHEN** se abre la app con sesión
- **THEN** la navegación muestra Ejecución, Plan y Cuentas, y un enlace guardado a `/hoy` sigue abriendo Ejecución
