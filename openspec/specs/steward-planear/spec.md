# steward-planear Specification

## Purpose

Define la planeación: la vista general por meses, el mes en borrador con escenarios, el mes sin plan, la comparación de escenarios, el plan anual y el cierre de mes.

## Requirements

### Requirement: Planear inicio
Planear SHALL mostrar el acceso al plan del año, los próximos meses con su estado (Borrador, Activo o sin plan) y los meses cerrados (solo lectura). Un mes futuro MUST abrirse en planeación y nunca en seguimiento.

#### Scenario: Abrir un mes sin plan
- **WHEN** en Planear se toca diciembre, que no tiene plan
- **THEN** se abre Mes sin plan de diciembre

### Requirement: Mes sin plan
Mes sin plan SHALL ofrecer "Copiar mes anterior", "Solo fijos e ingresos" y "Desde cero", y mostrar lo que el mes ya trae: primas, su diezmo y el sobrante del mes anterior. Elegir una opción MUST crear el mes en Borrador con la Opción A.

#### Scenario: Copiar mes anterior
- **WHEN** en diciembre se elige "Copiar mes anterior"
- **THEN** se abre diciembre en Borrador, con una Opción A que trae los ítems de noviembre

### Requirement: Mes en borrador con escenarios
Un mes en Borrador SHALL mostrar sus opciones (A, B, …) con quién propuso cada una, el total que cada una "dejaría libre" y sus ingresos y gastos por categoría. El diezmo MUST verse calculado y bloqueado ("Calculado · 10% de Salario Daniel"). Cualquiera puede crear o duplicar una opción. "Usar opción X" MUST dejarla como el plan que se activa al iniciar el mes, y las demás opciones se archivan, no se borran.

#### Scenario: Duplicar
- **WHEN** en noviembre (opciones A, B y C) se toca "+ Duplicar" sobre la Opción A
- **THEN** aparece una Opción D igual a A, propuesta por el usuario actual

#### Scenario: Diezmo bloqueado
- **WHEN** se intenta editar la fila Diezmo de una opción
- **THEN** la fila no es editable y muestra de qué ingreso se calcula

#### Scenario: Usar una opción
- **WHEN** se elige "Usar opción A"
- **THEN** noviembre queda con la Opción A como plan y las opciones B y C quedan archivadas

### Requirement: Comparar escenarios
Comparar SHALL mostrar las opciones de un mes lado a lado, resaltando solo las filas que cambian, con el total "Queda libre" de cada una y un botón "Usar {X}" por opción. Está diseñada para web; con menos de 1024 px de ancho MUST desplazarse en horizontal, sin comprimir las columnas.

#### Scenario: Filas distintas
- **WHEN** las opciones A y B de noviembre solo difieren en Variables
- **THEN** solo la fila Variables aparece resaltada

### Requirement: Plan anual
El plan anual SHALL mostrar una cuadrícula de 12 meses por categoría, con los fijos llenos automáticamente, los eventos del año (primas, SOAT, predial, matrícula, renta, Navidad) con "+ Evento del año", y los aportes proyectados en tono tenue. MUST mostrar los KPI: libre proyectado del año, mes más apretado y diezmo del año. "Crear meses desde este plan" SHALL crear cada mes en Borrador con su columna como Opción A. Editar un mes después MUST NOT modificar el anual.

#### Scenario: Evento del año
- **WHEN** se agrega un evento SOAT en marzo de $1.200.000
- **THEN** la columna de marzo y el KPI de libre proyectado bajan $1.200.000

### Requirement: Cierre de mes
Cierre SHALL mostrar la tabla plan vs. real por categoría, la fila "Sin registrar" (la suma de los ajustes de cuadre) y lo que sobró. El sobrante MUST poder repartirse entre "A ahorro" y "Pasar a {mes siguiente}", con una suma igual al sobrante. "Cerrar {mes}" SHALL dejar el mes Cerrado y en solo lectura, y lo pasado aparece como ingreso del mes siguiente ("Sobrante de octubre").

#### Scenario: Cerrar octubre
- **WHEN** octubre terminó con $3.166.000 y se reparte $2.000.000 a ahorro y $1.166.000 a noviembre
- **THEN** octubre queda Cerrado y noviembre muestra el ingreso "Sobrante de octubre $1.166.000"

#### Scenario: Reparto inválido
- **WHEN** la suma del reparto no coincide con el sobrante
- **THEN** "Cerrar octubre" queda deshabilitado
