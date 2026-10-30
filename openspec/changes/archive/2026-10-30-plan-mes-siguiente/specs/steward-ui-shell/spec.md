## MODIFIED Requirements

### Requirement: Navegación principal
La UI SHALL tener tres destinos principales, con estos nombres visibles: **Ejecución** (la pantalla Hoy), **Plan** (la pantalla Planear) y **Cuentas**. Las rutas `/hoy` y `/planear` MUST NOT cambiar. Con un ancho menor a 1024 px MUST mostrarse como barra inferior; desde 1024 px, como menú lateral con los mismos destinos. Ajustes MUST abrirse desde los avatares del hogar en Hoy y no ser un destino de la barra. Al abrir la app con sesión, SHALL mostrarse siempre Hoy del mes en curso.

#### Scenario: Móvil
- **WHEN** la PWA se abre a 390 px de ancho con sesión iniciada
- **THEN** se ve Hoy del mes en curso y una barra inferior con Hoy (activo), Planear y Cuentas

#### Scenario: Web
- **WHEN** la PWA se abre a 1280 px de ancho
- **THEN** los mismos tres destinos aparecen en un menú lateral y no hay barra inferior

#### Scenario: Ajustes desde los avatares
- **WHEN** en Hoy se toca el grupo de avatares "D E"
- **THEN** se abre Ajustes del hogar, con "‹ Hoy" para volver

#### Scenario: Los nombres nuevos
- **WHEN** se abre la app con sesión
- **THEN** la navegación muestra Ejecución, Plan y Cuentas, y un enlace guardado a `/hoy` sigue abriendo Ejecución
