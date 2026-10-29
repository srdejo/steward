## MODIFIED Requirements

### Requirement: Mes en borrador con escenarios
Un mes en Borrador SHALL mostrar sus opciones (A, B, …) con quién propuso cada una, el total que cada una "dejaría libre" y sus ingresos y gastos por categoría. El diezmo MUST verse calculado y bloqueado ("Calculado · 10% de Salario Daniel"). Cualquiera puede crear o duplicar una opción, y quitar una que ya no sirva ("Quitar opción", con confirmación), salvo la última y la que está en uso. "Usar opción X" MUST dejarla como el plan que se activa al iniciar el mes, y las demás opciones se archivan, no se borran.

Varias opciones existen solo mientras el mes está en Borrador: un mes Activo MUST NOT ofrecer "+ Duplicar" ni "Quitar opción". Si el mes deja de estar en Borrador mientras la pantalla está abierta, la acción MUST mostrar "{Mes} ya está en curso; su plan no gana opciones" sin crear nada.

En modo conectado:
- las opciones, sus ítems, "+ Duplicar", "Quitar opción" y "Usar opción X" MUST guardarse en el backend;
- los dos miembros MUST ver las mismas opciones, con su autor real.

#### Scenario: Duplicar
- **WHEN** en noviembre (opciones A, B y C) se toca "+ Duplicar" sobre la Opción A
- **THEN** aparece una Opción D igual a A, propuesta por el usuario actual

#### Scenario: Diezmo bloqueado
- **WHEN** se intenta editar la fila Diezmo de una opción
- **THEN** la fila no es editable y muestra de qué ingreso se calcula

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

### Requirement: Comparar escenarios
Comparar SHALL mostrar las opciones de un mes lado a lado, resaltando solo las filas que cambian, con el total "Queda libre" de cada una y un botón "Usar {X}" por opción. Está diseñada para web; con menos de 1024 px de ancho MUST desplazarse en horizontal, sin comprimir las columnas.

En modo conectado, Comparar MUST mostrar las opciones reales del mes, y "Usar {X}" MUST guardarse en el backend. Con una sola opción, Comparar la muestra sola, sin avisos.

#### Scenario: Filas distintas
- **WHEN** las opciones A y B de noviembre solo difieren en Variables
- **THEN** solo la fila Variables aparece resaltada

#### Scenario: Comparar en modo conectado
- **WHEN** en modo conectado noviembre tiene la Opción A y la B con un abono extra de $2.000.000, y Daniel toca "Usar B" en Comparar
- **THEN** solo la fila Créditos aparece resaltada, B "deja libre" $2.000.000 menos que A, y los dos ven noviembre con la B como plan
