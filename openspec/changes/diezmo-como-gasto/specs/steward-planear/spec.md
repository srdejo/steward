## ADDED Requirements

### Requirement: Mes en borrador con opciones
Un mes en Borrador SHALL mostrar sus opciones (A, B, …) con quién propuso cada una, el total que cada una "dejaría libre" y sus ingresos y gastos por categoría. Los ingresos de cada opción MUST ser sus propias líneas (spec `steward-plan-mes`, "Ingresos de la opción"): tocarlas permite editar su nombre y monto o quitarlas, y "+ Ingreso" agrega una, sin tocar Ajustes ni las otras opciones; los aportes y el sobrante del mes anterior se siguen mostrando aparte. El diezmo MUST verse como la categoría Diezmo, con un ítem por cada ingreso ("Diezmo · Salario Daniel"), editable como cualquier ítem; MUST NOT haber una fila de diezmo calculada aparte. Cualquiera puede crear o duplicar una opción, y quitar una que ya no sirva ("Quitar opción", con confirmación), salvo la última y la que está en uso. "Usar opción X" MUST dejarla como el plan que se activa al iniciar el mes, y las demás opciones se archivan, no se borran.

Varias opciones existen solo mientras el mes está en Borrador: un mes Activo MUST NOT ofrecer "+ Duplicar" ni "Quitar opción". Si el mes deja de estar en Borrador mientras la pantalla está abierta, la acción MUST mostrar "{Mes} ya está en curso; su plan no gana opciones" sin crear nada.

En modo conectado:
- las opciones, sus ítems, "+ Duplicar", "Quitar opción" y "Usar opción X" MUST guardarse en el backend;
- los dos miembros MUST ver las mismas opciones, con su autor real.

#### Scenario: Duplicar
- **WHEN** en noviembre (opciones A, B y C) se toca "+ Duplicar" sobre la Opción A
- **THEN** aparece una Opción D igual a A, propuesta por el usuario actual, con los mismos ítems de diezmo

#### Scenario: Diezmo editable
- **WHEN** en la Opción A de noviembre se cambia "Diezmo · Salario Daniel" a $750.000
- **THEN** el ítem queda en $750.000, y el total que dejaría libre baja $50.000

#### Scenario: Ingreso editable
- **WHEN** en la Opción B de noviembre se toca "Salario Daniel" y se cambia a $7.000.000
- **THEN** la Opción B deja libres $712.000 más, y la Opción A y Ajustes siguen con $6.288.000

#### Scenario: Agregar un ingreso
- **WHEN** en la Opción A de noviembre se toca "+ Ingreso" y se guarda "Venta bicicleta" por $400.000
- **THEN** la línea aparece en los ingresos de la Opción A, y lo que dejaría libre sube $400.000

#### Scenario: Usar una opción
- **WHEN** se elige "Usar opción A"
- **THEN** noviembre queda con la Opción A como plan y las opciones B y C quedan archivadas

#### Scenario: Editar la Opción A en modo conectado
- **WHEN** en modo conectado Daniel agrega "Internet" por $120.000 a la Opción A de noviembre y Esposa abre noviembre
- **THEN** Esposa ve Internet en la Opción A, y el total que dejaría libre ya lo descuenta

#### Scenario: Duplicar en modo conectado
- **WHEN** en modo conectado Esposa toca "+ Duplicar" sobre la Opción A de noviembre, que propuso Daniel
- **THEN** los dos ven la Opción B "por Esposa", igual a A

#### Scenario: Quitar una opción
- **WHEN** en noviembre (opciones A, B y C) se toca "Quitar opción" sobre la C y se confirma
- **THEN** noviembre muestra solo A y B, y el otro miembro también

#### Scenario: Quitar la única opción
- **WHEN** noviembre solo tiene la Opción A
- **THEN** "Quitar opción" no se ofrece

#### Scenario: Duplicar en un mes Activo
- **WHEN** octubre es el mes en curso con la Opción A en uso y se abre octubre en Planear
- **THEN** no se ofrece "+ Duplicar", y octubre sigue con solo la Opción A

## MODIFIED Requirements

### Requirement: Plan anual
Si el año no tiene plan anual, SHALL ofrecer "Crear plan anual {año}" (año en curso o futuro), que lo crea vacío. El plan anual SHALL mostrar una cuadrícula de 12 meses por categoría (todas las del hogar salvo Diezmo), con los fijos llenos automáticamente, los eventos del año (primas, SOAT, predial, matrícula, renta, Navidad) con "+ Evento del año", y los aportes proyectados en tono tenue: una fila por miembro, editable, con lo que cada uno espera aportar cada mes. El diezmo MUST verse como una fila calculada desde las reglas, no editable. MUST mostrar los KPI: libre proyectado del año, mes más apretado y diezmo del año. "Crear meses desde este plan" SHALL crear cada mes en Borrador con su columna como Opción A, más sus ítems de diezmo. Editar un mes después MUST NOT modificar el anual.

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

#### Scenario: Diezmo en los meses creados
- **WHEN** Daniel tiene regla 10 % del bruto sobre su salario de $7.000.000 y se crean los meses de 2027 desde el anual
- **THEN** cada mes de 2027 creado trae "Diezmo · Salario Daniel" por $700.000 en la categoría Diezmo

## REMOVED Requirements

### Requirement: Mes en borrador con escenarios
**Reason**: Pedía el diezmo como fila calculada y bloqueada en cada opción; ahora el diezmo son ítems editables de la categoría Diezmo.
**Migration**: Lo reemplaza "Mes en borrador con opciones", con las mismas reglas de opciones y el diezmo como ítems.
