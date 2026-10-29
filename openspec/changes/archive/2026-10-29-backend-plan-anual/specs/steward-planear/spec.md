## MODIFIED Requirements

### Requirement: Plan anual
Si el año no tiene plan anual, SHALL ofrecer "Crear plan anual {año}" (año en curso o futuro), que lo crea vacío. El plan anual SHALL mostrar una cuadrícula de 12 meses por categoría (todas las del hogar), con los fijos llenos automáticamente, los eventos del año (primas, SOAT, predial, matrícula, renta, Navidad) con "+ Evento del año", y los aportes proyectados en tono tenue: una fila por miembro, editable, con lo que cada uno espera aportar cada mes. MUST mostrar los KPI: libre proyectado del año, mes más apretado y diezmo del año. "Crear meses desde este plan" SHALL crear cada mes en Borrador con su columna como Opción A. Editar un mes después MUST NOT modificar el anual.

En modo conectado, el plan anual, sus celdas, eventos y proyecciones, y "Crear meses desde este plan" MUST guardarse en el backend, y los dos miembros MUST ver la misma cuadrícula y los mismos KPI.

#### Scenario: Evento del año
- **WHEN** se agrega un evento SOAT en marzo de $1.200.000
- **THEN** la columna de marzo y el KPI de libre proyectado bajan $1.200.000

#### Scenario: Crear el anual vacío
- **WHEN** 2027 no tiene plan anual y Daniel toca "Crear plan anual 2027"
- **THEN** se ve la cuadrícula de 2027 con cada categoría del hogar en $0, una fila de aportes por miembro en $0 y "Crear meses desde este plan"

#### Scenario: Aporte proyectado tenue
- **WHEN** Esposa pone $2.000.000 en su fila de aportes de enero de 2027
- **THEN** la celda se ve tenue, el libre de enero sube $2.000.000, y enero en Planear muestra "Aportes Esposa" proyectado

#### Scenario: Crear meses en modo conectado
- **WHEN** en modo conectado se toca "Crear meses desde este plan" en 2027
- **THEN** los meses de 2027 sin plan aparecen en Planear en Borrador para los dos miembros
