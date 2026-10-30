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

En modo conectado, el mes MUST crearse en el backend y el otro miembro SHALL verlo al abrir Planear.

#### Scenario: Copiar mes anterior
- **WHEN** en diciembre se elige "Copiar mes anterior"
- **THEN** se abre diciembre en Borrador, con una Opción A que trae los ítems de noviembre

#### Scenario: Primer mes en modo conectado
- **WHEN** en modo conectado un hogar sin planes abre Hoy en octubre
- **THEN** Hoy indica que el mes no tiene plan y lleva a Mes sin plan de octubre, donde "Desde cero" crea el mes en el backend

### Requirement: Comparar escenarios
Comparar SHALL mostrar las opciones de un mes lado a lado, resaltando solo las filas que cambian, con el total "Queda libre" de cada una y un botón "Usar {X}" por opción. Está diseñada para web; con menos de 1024 px de ancho MUST desplazarse en horizontal, sin comprimir las columnas.

En modo conectado, Comparar MUST mostrar las opciones reales del mes, y "Usar {X}" MUST guardarse en el backend. Con una sola opción, Comparar la muestra sola, sin avisos.

#### Scenario: Filas distintas
- **WHEN** las opciones A y B de noviembre solo difieren en Variables
- **THEN** solo la fila Variables aparece resaltada

#### Scenario: Comparar en modo conectado
- **WHEN** en modo conectado noviembre tiene la Opción A y la B con un abono extra de $2.000.000, y Daniel toca "Usar B" en Comparar
- **THEN** solo la fila Créditos aparece resaltada, B "deja libre" $2.000.000 menos que A, y los dos ven noviembre con la B como plan

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

### Requirement: Cierre de mes
Cierre SHALL mostrar la tabla plan vs. real por categoría, la fila "Sin registrar" (la suma de los ajustes de cuadre) y lo que sobró. El sobrante MUST poder repartirse entre "A ahorro" y "Pasar a {mes siguiente}", con una suma igual al sobrante. "Cerrar {mes}" SHALL dejar el mes Cerrado y en solo lectura, y lo pasado aparece como ingreso del mes siguiente ("Sobrante de octubre").

En modo conectado:
- "Cerrar {mes}" MUST guardar el cierre en el backend, y los dos miembros MUST ver el mes Cerrado con lo guardado;
- un mes futuro MUST NOT poder cerrarse: su Cierre no ofrece "Cerrar {mes}";
- si alguien registró algo en el mes mientras tanto, MUST mostrarse "Alguien registró algo en {mes}; revisa el cierre otra vez", con las cifras ya recalculadas, sin cerrar el mes.

#### Scenario: Cerrar octubre
- **WHEN** octubre terminó con $3.166.000 y se reparte $2.000.000 a ahorro y $1.166.000 a noviembre
- **THEN** octubre queda Cerrado y noviembre muestra el ingreso "Sobrante de octubre $1.166.000"

#### Scenario: Reparto inválido
- **WHEN** la suma del reparto no coincide con el sobrante
- **THEN** "Cerrar octubre" queda deshabilitado

#### Scenario: Cerrar en modo conectado
- **WHEN** en modo conectado Daniel cierra octubre
- **THEN** Esposa ve octubre Cerrado con el mismo reparto, y en Hoy ya no puede marcar pagos de octubre

#### Scenario: Cierre desactualizado
- **WHEN** en modo conectado Esposa registró un gasto de octubre mientras Daniel tenía abierto el Cierre, y Daniel toca "Cerrar octubre"
- **THEN** ve que alguien registró algo, la tabla ya incluye el gasto y octubre sigue abierto

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

### Requirement: Editar en hojas con "Guardar"
En Planear, los ingresos y los gastos de una opción SHALL editarse en hojas, no en campos de la fila:
- tocar una línea de ingreso abre su hoja: nombre, monto, bruto (cuando la regla de su persona usa el bruto) y persona;
- tocar un gasto abre su hoja: nombre, monto, categoría, tipo (Fijo, Variable, Cuota, Crédito o Diezmo), día de vencimiento y, para las compras a cuotas, cuota actual y total;
- en un ítem de diezmo, la hoja muestra de qué ingreso viene y, si está "ajustado a mano", "Volver a calcular".

Cada hoja MUST tener "Guardar", que deja el cambio en el plan y muestra "Guardado", y "Quitar", que pide confirmación ("¿Quitar Internet de la Opción A?"). Cerrar la hoja sin guardar MUST NOT cambiar nada. "+ Gasto" y "+ Ingreso" MUST abrir la misma hoja vacía, con el monto, y "+ Ingreso" con "Aplicar diezmo".

Las categorías de gastos MUST mostrar que se abren y se cierran (un indicador ›/⌄) y cuántos gastos tienen.

En modo conectado, "Guardar" y "Quitar" MUST guardarse en el backend antes de mostrar "Guardado". Si el backend responde un error, la hoja MUST seguir abierta con el mensaje y lo escrito.

#### Scenario: Cambiar un monto
- **WHEN** en noviembre se toca Mercado, se cambia a $900.000 y se toca "Guardar"
- **THEN** la hoja se cierra con "Guardado", Variables suma $900.000 y lo que dejaría libre baja $100.000

#### Scenario: Cerrar sin guardar
- **WHEN** se toca Mercado, se escribe $900.000 y se cierra la hoja sin "Guardar"
- **THEN** Mercado sigue en $800.000

#### Scenario: Agregar un gasto con su monto
- **WHEN** se toca "+ Gasto", se escribe "Regalo" por $150.000 en Variables y se guarda
- **THEN** Variables tiene "Regalo" por $150.000, sin pasos adicionales

#### Scenario: Quitar con confirmación
- **WHEN** se toca Internet, luego "Quitar" y se confirma
- **THEN** Internet ya no está en la opción

### Requirement: El mes en curso se edita en Planear
Abrir en Planear el mes en curso, en Activo, SHALL mostrar su plan editable, con las mismas hojas que un Borrador (spec `steward-plan-mes`, "Editar el mes en curso"), sin "+ Duplicar", sin pestañas de opciones y con acceso a Hoy y al Cierre. Un mes Cerrado MUST seguir en solo lectura.

#### Scenario: Editar octubre
- **WHEN** octubre está Activo y en Planear se abre octubre
- **THEN** se ven sus ingresos y gastos con sus hojas de edición, y no aparece "+ Duplicar"

### Requirement: Borrar el plan del mes en Planear
Un mes con plan, o cerrado, SHALL ofrecer en Planear "Borrar plan de {mes}". La confirmación MUST decir qué se borra ("Se borran 3 pagos, 2 gastos y 1 ingreso recibido de octubre; los aportes se conservan", o "y su cierre" si estaba cerrado) y pedir confirmarlo otra vez cuando hay registros. Después el mes se abre como "Sin plan".

#### Scenario: Borrar noviembre
- **WHEN** en noviembre se toca "Borrar plan de noviembre" y se confirma
- **THEN** Planear muestra noviembre "Sin plan" con sus tres formas de empezar
