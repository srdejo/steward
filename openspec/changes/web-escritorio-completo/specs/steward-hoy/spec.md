## ADDED Requirements

### Requirement: Cerrar el mes desde Hoy
Desde 1024 px de ancho, cuando Hoy muestra el mes en curso y ese mes no está cerrado, SHALL mostrar "Cerrar {mes}" junto a las acciones del encabezado. Al tocarlo MUST abrir el Cierre de ese mes (spec `steward-planear`, "Cierre de mes"). Si Hoy muestra otro mes, o el mes ya está cerrado, el botón MUST NOT verse.

#### Scenario: Cerrar octubre desde Hoy
- **WHEN** hoy es 26 oct, a 1280 px Hoy muestra octubre y se toca "Cerrar octubre"
- **THEN** se abre el Cierre de octubre

#### Scenario: Mes siguiente en Hoy
- **WHEN** a 1280 px se elige noviembre en el selector de mes de Hoy
- **THEN** no se ve "Cerrar noviembre"
