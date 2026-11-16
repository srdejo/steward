# steward-planear Specification

## Purpose

Define la planeación: la vista general por meses, el mes en borrador con escenarios, el mes sin plan, la comparación de escenarios, el plan anual y el cierre de mes.

## Requirements

### Requirement: Planear inicio
Planear SHALL mostrar el acceso al plan del año siguiente, los próximos meses con su estado (Borrador, Activo o sin plan) y los meses cerrados (solo lectura). Un mes futuro MUST abrirse en planeación y nunca en seguimiento.

El acceso al año:
- si el año siguiente no tiene plan anual, MUST decir "Año {año} · Sin plan", con los pasos (mes base, replicar, lo que cambia) y "Planear {año}";
- si lo tiene, MUST mostrar su estado y el libre proyectado, y abrirlo.

Desde 1024 px de ancho, Planear SHALL usar el ancho de la página:
- la tarjeta del año arriba;
- "Próximos meses" y "Este mes y anteriores" como tarjetas en cuadrícula, cada una con su estado, su monto y su acción;
- la página MUST NOT tener scroll horizontal.

Con menos de 1024 px, MUST seguir en una columna.

#### Scenario: Abrir un mes sin plan
- **WHEN** en Planear se toca diciembre, que no tiene plan
- **THEN** se abre Mes sin plan de diciembre

#### Scenario: Año sin plan
- **WHEN** hoy es 26 oct 2026 y 2027 no tiene plan anual
- **THEN** Planear muestra "Año 2027 · Sin plan" y "Planear 2027", que abre el paso del mes base

#### Scenario: Planear en escritorio
- **WHEN** la PWA se abre en Planear a 1280 px
- **THEN** noviembre, diciembre y enero se ven como tarjetas en una misma fila, octubre, septiembre y agosto en otra, y la página no tiene scroll horizontal

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
Comparar SHALL mostrar las opciones de un mes lado a lado, resaltando solo las filas que cambian, con el total "Queda libre" de cada una y un botón "Usar {X}" por opción. Con menos de 1024 px de ancho MUST desplazarse en horizontal, sin comprimir las columnas. Desde 1024 px, el mes ya muestra las opciones lado a lado ("Opciones del mes en escritorio"): abrir Comparar MUST llevar al mes.

En modo conectado, Comparar MUST mostrar las opciones reales del mes, y "Usar {X}" MUST guardarse en el backend. Con una sola opción, Comparar la muestra sola, sin avisos.

#### Scenario: Filas distintas
- **WHEN** las opciones A y B de noviembre solo difieren en Variables
- **THEN** solo la fila Variables aparece resaltada

#### Scenario: Comparar en modo conectado
- **WHEN** en modo conectado noviembre tiene la Opción A y la B con un abono extra de $2.000.000, y Daniel toca "Usar B" en Comparar
- **THEN** solo la fila Créditos aparece resaltada, B "deja libre" $2.000.000 menos que A, y los dos ven noviembre con la B como plan

#### Scenario: Comparar en escritorio
- **WHEN** a 1280 px se abre `/planear/2026-11/comparar`
- **THEN** se abre `/planear/2026-11` con las opciones lado a lado

### Requirement: Plan anual
Planear el año SHALL hacerse en dos pasos.

**Paso 1, mes base.** El paso SHALL ofrecer:
- cada mes con plan, del más reciente al más antiguo, con lo que deja libre;
- "Solo fijos e ingresos";
- "Desde cero".

Al lado SHALL mostrar cómo queda cada mes: los ingresos fijos, los aportes proyectados, el total de cada categoría, el diezmo calculado, lo que queda libre al mes y el total del año. "Replicar en los 12 meses" MUST:
- crear el plan anual si no existe;
- llenar los 12 meses con el mes base: cada categoría con su total, y los aportes de cada miembro como proyectados;
- abrir el paso 2.

Si el año ya tiene celdas, MUST pedir confirmación ("Se reemplazan los montos de los 12 meses; lo que cambia se conserva").

**Paso 2, lo que cambia.** SHALL mostrar los KPI: libre proyectado del año (con cuánto suben o bajan por lo que cambia), mes más apretado y diezmo del año. "Algo distinto en un mes" SHALL pedir:
- ingreso o gasto;
- nombre y monto;
- el mes;
- para un gasto, la categoría (por defecto "Eventos del año");
- para un ingreso, de quién es (hereda su regla de diezmo);
- "Solo en {mes}" o "De {mes} en adelante".

Antes de guardar MUST mostrar en cuánto queda el mes. La lista "Lo que cambia" SHALL mostrar cada cambio por mes, con su tipo, categoría, monto y diezmo, y tocarlo MUST permitir corregirlo o quitarlo (con confirmación).

El diezmo MUST verse calculado desde las reglas, no editable. "Crear los 12 meses" SHALL crear cada mes sin plan en Borrador con su columna como Opción A, más sus ítems de diezmo. Editar un mes después MUST NOT modificar el anual.

**Vistas.**
- Desde 1024 px: la tabla de 12 meses por categoría, con las celdas que cambian frente al mes base resaltadas. Tocar una celda cambia solo ese mes.
- Con menos de 1024 px: una lista de los 12 meses con lo que queda libre y lo que cambia en cada uno (los meses seguidos sin cambios, agrupados: "Septiembre a noviembre · Igual al mes base"). Tocar un mes abre "Algo distinto en {mes}" en una hoja.

**Borrar.** El plan del año SHALL ofrecer "Borrar plan de {año}", en Borrador o con los meses ya creados. La confirmación MUST decir qué se borra ("Se borran los montos, 7 cambios y los aportes proyectados de 2027. Los meses ya creados no cambian.") y, después, Planear MUST mostrar el año sin plan.

En modo conectado, replicar, los cambios, borrar y "Crear los 12 meses" MUST guardarse en el backend, y los dos miembros MUST ver las mismas cifras.

#### Scenario: Replicar octubre
- **WHEN** en 2027 sin plan anual se elige "Octubre 2026" como mes base (Gastos fijos $795.000, Tarjetas y cuotas $2.675.000, Variables $720.000, Créditos $500.000, aportes de Esposa $1.500.000) y se toca "Replicar en los 12 meses"
- **THEN** cada mes de 2027 tiene esos totales y deja libre $2.398.000, y el libre del año es $28.776.000

#### Scenario: Evento del año
- **WHEN** se agrega un evento SOAT en marzo de $1.200.000
- **THEN** la columna de marzo y el KPI de libre proyectado bajan $1.200.000

#### Scenario: Crear el anual vacío
- **WHEN** 2027 no tiene plan anual y Daniel elige "Desde cero" y toca "Replicar en los 12 meses"
- **THEN** se ve el año 2027 con cada categoría del hogar en $0, una fila de aportes por miembro en $0 y "Crear los 12 meses"

#### Scenario: Aporte proyectado tenue
- **WHEN** Esposa pone $2.000.000 en su fila de aportes de enero de 2027
- **THEN** la celda se ve tenue, el libre de enero sube $2.000.000, y enero en Planear muestra "Aportes Esposa" proyectado

#### Scenario: Un evento del año
- **WHEN** en el paso 2 se agrega el gasto "SOAT" de $900.000, solo en marzo, en "Eventos del año"
- **THEN** marzo deja libre $1.498.000, su celda de Eventos del año se ve resaltada y "Lo que cambia" muestra "Mar · SOAT"

#### Scenario: Un gasto en su categoría
- **WHEN** se agrega el gasto "Navidad" de $680.000, solo en diciembre, en Variables
- **THEN** Variables de diciembre suma $1.400.000 y se ve resaltada, y al crear los meses diciembre trae "Navidad" en Variables

#### Scenario: De ese mes en adelante
- **WHEN** se agrega el ingreso "Aumento" de $300.000 de Daniel, de julio en adelante
- **THEN** julio a diciembre dejan libre $300.000 más (menos su diezmo), y enero a junio no cambian

#### Scenario: Prima con diezmo
- **WHEN** Daniel tiene regla 10 % del bruto y se agrega el ingreso "Prima" de $3.500.000 de Daniel, solo en junio
- **THEN** el diezmo de junio sube $350.000 y junio deja libre $5.548.000

#### Scenario: Quitar un cambio
- **WHEN** en "Lo que cambia" se toca "Mar · SOAT", luego "Quitar" y se confirma
- **THEN** marzo vuelve a dejar libre lo mismo que el mes base

#### Scenario: Lista de meses en móvil
- **WHEN** el plan de 2027 se abre a 390 px
- **THEN** no hay tabla con scroll horizontal: se ve la lista de los 12 meses, y enero dice "Matrícula −$1.800.000" con $598.000 en rojo

#### Scenario: Diezmo en los meses creados
- **WHEN** Daniel tiene regla 10 % del bruto sobre su salario de $7.000.000 y se crean los meses de 2027
- **THEN** cada mes de 2027 creado trae "Diezmo · Salario Daniel" por $700.000 en la categoría Diezmo

#### Scenario: Borrar el plan del año
- **WHEN** en el plan de 2027 se toca "Borrar plan de 2027" y se confirma
- **THEN** se abre Planear con "Año 2027 · Sin plan", y los meses de 2027 que ya tenían plan siguen igual

#### Scenario: Crear meses en modo conectado
- **WHEN** en modo conectado se toca "Crear los 12 meses" en 2027
- **THEN** los meses de 2027 sin plan aparecen en Planear en Borrador para los dos miembros

### Requirement: Cierre de mes
Cierre SHALL mostrar la tabla plan vs. real por categoría, la fila "Sin registrar" (la suma de los ajustes de cuadre) y lo que sobró. El sobrante MUST poder repartirse entre "A ahorro" y "Pasar a {mes siguiente}", con una suma igual al sobrante. "Cerrar {mes}" SHALL dejar el mes Cerrado y en solo lectura, y lo pasado aparece como ingreso del mes siguiente ("Sobrante de octubre").

Desde 1024 px de ancho, Cierre SHALL usar el ancho del escritorio:
- encabezado "{Mes} {año} terminó con $X", con "El plan esperaba $Y libres" y la diferencia ("+$Z mejor de lo planeado" en positivo, o "−$Z menos de lo planeado");
- "Plan frente a lo real": por categoría, plan, real, diferencia (real − plan) y una barra de uso del plan. En los gastos, pasarse del plan MUST verse en rojo y quedar por debajo, en verde; en los ingresos, al revés;
- "Para tener en cuenta en {mes siguiente}", que MUST incluir lo que salió sin registrar (si es mayor que cero), cada categoría de gasto que pasó su plan y la diferencia de los ingresos (si la hay). Sin nada que mostrar, la sección no aparece;
- al lado, "¿Qué hacemos con lo que sobró?" con una barra del reparto, los montos "A ahorro" y "Pasar a {mes siguiente}", "Sin asignar" y "Cerrar {mes}".

En modo conectado:
- "Cerrar {mes}" MUST guardar el cierre en el backend, y los dos miembros MUST ver el mes Cerrado con lo guardado;
- un mes futuro MUST NOT poder cerrarse: su Cierre no ofrece "Cerrar {mes}";
- si alguien registró algo en el mes mientras tanto, MUST mostrarse "Alguien registró algo en {mes}; revisa el cierre otra vez", con las cifras ya recalculadas, sin cerrar el mes.

#### Scenario: Cerrar octubre
- **WHEN** octubre terminó con $3.166.000 y se reparte $2.000.000 a ahorro y $1.166.000 a noviembre
- **THEN** octubre queda Cerrado y noviembre muestra el ingreso "Sobrante de octubre $1.166.000"

#### Scenario: Reparto inválido
- **WHEN** la suma del reparto no coincide con el sobrante
- **THEN** "Cerrar octubre" queda deshabilitado y "Sin asignar" muestra la diferencia

#### Scenario: Cierre en escritorio
- **WHEN** a 1280 px se abre el cierre de octubre, Variables tenía plan $720.000 y real $750.000, y quedaron $220.000 sin registrar
- **THEN** la fila de Variables muestra "+$30.000" en rojo, y "Para tener en cuenta en noviembre" incluye los $220.000 sin registrar y Variables por encima del plan

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
- tocar un gasto abre su hoja: nombre, monto, categoría en chips (el tipo se deduce de ella), día de vencimiento y, según la categoría, "¿A cuotas?" con cuota actual y total en Tarjetas y cuotas, o "Cambia cada mes" en una categoría propia;
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

#### Scenario: El tipo sale de la categoría
- **WHEN** se toca "+ Gasto", se elige el chip Variables, se escribe "Regalo" por $150.000 y se guarda
- **THEN** "Regalo" queda de tipo Variable, sin haber elegido un tipo

#### Scenario: Una compra a cuotas
- **WHEN** se elige el chip Tarjetas y cuotas, se activa "¿A cuotas?", se escribe cuota 4 de 12 y se guarda
- **THEN** el gasto queda de tipo Cuota, con cuota 4 de 12

#### Scenario: Una categoría propia variable
- **WHEN** se elige el chip Educación, se activa "Cambia cada mes" y se guarda
- **THEN** el gasto queda de tipo Variable en Educación

#### Scenario: Abrir y guardar no cambia el tipo
- **WHEN** un gasto de tipo Fijo está en Variables desde antes, se abre, se cambia su monto y se guarda sin tocar la categoría
- **THEN** sigue siendo de tipo Fijo

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

### Requirement: Opción con saldo negativo
Cuando una opción deja menos de cero, Planear SHALL decir "Con la Opción {letra} faltarían" con el monto en valor absoluto y en rojo, en lugar de "Opción {letra} dejaría libre". En cero o positivo MUST seguir diciendo "Opción {letra} dejaría libre".

#### Scenario: Faltan $200.000
- **WHEN** la Opción A tiene ingresos por $4.000.000 y gastos por $4.200.000
- **THEN** Planear muestra "Con la Opción A faltarían $200.000" en rojo

#### Scenario: Justo en cero
- **WHEN** la Opción A tiene ingresos y gastos por $4.000.000
- **THEN** Planear muestra "Opción A dejaría libre $0"

### Requirement: Ver el mes siguiente en Ejecución
Abrir en Planear el mes siguiente al mes en curso SHALL ofrecer "Ver en Ejecución", que abre Hoy (se ve como Ejecución) con ese mes elegido (spec `steward-hoy`, "Elegir el mes en Hoy").

#### Scenario: De noviembre a Ejecución
- **WHEN** hoy es 30 oct, se abre noviembre en Planear y se toca "Ver en Ejecución"
- **THEN** Hoy muestra noviembre

### Requirement: Plan de un mes en escritorio
Desde 1024 px de ancho, un mes con una sola opción (en Borrador, Activo o Cerrado) SHALL mostrarse a todo el ancho, con las mismas reglas de "Mes en borrador con opciones" y "El mes en curso se edita en Planear":
- **Encabezado:** "‹ Planear", flechas al mes anterior y al siguiente, y el estado ("Borrador · empieza en N días", "Activo", "Cerrado"). En Borrador también "Crear otra opción" (duplica la opción) y "Usar este plan en {mes}".
- **Indicadores:**
  - **Entra**: el total de ingresos; si hay ingresos que no estaban el mes anterior, "Incluye {nombre} ($X)";
  - **Sale**: el total de gastos, con la nota de las dos filas que más cambian frente al mes anterior;
  - **Quedaría libre**;
  - **Diezmo**: el total de los ítems de diezmo, con el desglose por línea.
- **Tabla:** grupos en este orden: Ingresos (las líneas de la opción, los aportes proyectados de cada persona en gris como "Proyectado", y "Sobrante de {mes anterior}" si se espera) y después las categorías de gasto, con el Diezmo al final. Cada grupo tiene su total y su diferencia frente al mes anterior.
  - Cada fila tiene nombre, detalle (el de Hoy: "Corte 13 · valor del extracto", "Cuota 6 de 12"), día, monto y diferencia frente a la misma fila (misma categoría y nombre) del mes anterior: "—" si es igual, "+$X" o "−$X".
  - Una fila puede llevar una etiqueta: "Solo {mes}" si no estaba el mes anterior, "Proyectado" en un aporte proyectado, "Último" en la cuota con la que termina un crédito.
  - Los montos de un mes en Borrador o Activo MUST editarse en la celda (Enter o al salir del campo guarda). Tocar el nombre abre su hoja, y hay "+ Agregar a {grupo}". El diezmo se abre en su hoja. En un mes Cerrado, nada se edita.
- **Calendario de pagos:** las semanas del mes (L a D), cada día con lo que entra (+) y sale (−) ese día. Tocar un día, o una fila con día, lo elige y muestra debajo sus movimientos ("Nada programado este día" si no tiene).
- **Plata en cuentas, día a día:**
  - una barra por día con el saldo proyectado: el saldo del hogar estimado de hoy al empezar el mes (o desde hoy, si es el mes en curso), más lo que entra y menos lo que sale cada día;
  - el punto más bajo resaltado, con el aviso "Punto más bajo el {día}, con ≈ $X";
  - los gastos y los ingresos sin día no entran y se dicen aparte ("Los gastos sin fecha ($X) no están aquí").
- **Se libera:** si un crédito paga su última cuota este mes, "Se libera $X" con el crédito y desde qué mes.

En modo conectado, editar una celda y las demás acciones MUST guardarse en el backend.

#### Scenario: Diciembre con una opción
- **WHEN** a 1280 px se abre un diciembre con una opción que tiene la prima de $3.500.000 y la Navidad de $680.000, y noviembre no las tenía
- **THEN** "Entra" dice "Incluye Prima ($3.500.000)"; las filas de la prima y de la Navidad llevan "Solo diciembre" y "+$3.500.000" y "+$680.000" en la diferencia; y "Quedaría libre" es lo que entra menos lo que sale

#### Scenario: Elegir un día
- **WHEN** a 1280 px se toca la fila "Compra a cuotas", que vence el 20
- **THEN** el calendario marca el 20 y debajo lista lo que sale ese día con su monto

#### Scenario: Punto más bajo
- **WHEN** el saldo del hogar es ≈ $3.000.000 y la Visa ($800.000) y la pensión ($550.000) salen antes de que llegue el salario el 25
- **THEN** la barra más baja es la del último pago antes del salario (el primer día que llega a ese saldo), y el aviso dice ese día y ese saldo

#### Scenario: Editar en la celda
- **WHEN** a 1280 px se escribe $420.000 en la celda de Transporte de diciembre y se pulsa Enter
- **THEN** Transporte queda en $420.000, "Sale" y "Quedaría libre" se actualizan, y su diferencia frente a noviembre cambia

#### Scenario: Se libera
- **WHEN** a la compra a cuotas le queda su última cuota en junio
- **THEN** el plan de junio muestra "Último" en esa fila y "Se libera $375.000" desde julio

### Requirement: Opciones del mes en escritorio
Desde 1024 px de ancho, un mes en Borrador con dos opciones o más SHALL mostrarse a todo el ancho, con las mismas reglas de "Mes en borrador con opciones":
- **Encabezado:** "‹ Planear", flechas al mes anterior y al siguiente, el estado, "Solo lo que cambia", "Duplicar {opción}" y "Usar {opción} para {mes}". Al usar una opción, el mes pasa a la vista de una opción.
- **Tabla de opciones:** una columna por opción con su letra y su descripción. Al tocar el encabezado, esa opción queda "Editando"; al abrir, es la opción en uso o, si no hay, la A. Arriba, los ingresos de cada opción. Después, por categoría, el subtotal y una fila por gasto (misma categoría y nombre en las opciones), con detalle, vencimiento y su monto en cada opción ("—" si no lo tiene). Las celdas que difieren de la A MUST verse resaltadas. Al final, "Total gastos" y "Queda libre".
- **Editar en la celda:** las celdas de la opción "Editando" se editan en la tabla. Escribir en una celda "—" MUST agregar ese gasto a la opción, con la categoría, el nombre, el tipo y el vencimiento de la fila. El nombre abre su hoja. El diezmo se abre en su hoja.
- **"Solo lo que cambia":** oculta las filas iguales en todas las opciones y dice cuántas se ocultaron.
- **Al lado:**
  - la opción "Editando", con lo que dejaría libre, cuánto más o menos que la A, sus cambios frente a la A y su nota;
  - "{Mes} ya trae";
  - los atajos.
- **Atajos:** Ctrl + D duplica la opción "Editando". N, con el foco en una celda, abre "+ Agregar" en su categoría.

Un mes sin plan muestra las formas de empezar y "ya trae" una al lado de la otra. Por debajo de 1024 px, el mes se ve como hoy.

#### Scenario: Opciones de noviembre lado a lado
- **WHEN** a 1280 px se abre noviembre 2026, con las opciones A, B y C de los datos de prueba
- **THEN** la fila "Regalos de Navidad" muestra "—" en A y C y $600.000 resaltado en B, y "Queda libre" muestra lo mismo que cada opción "dejaría libre"

#### Scenario: Agregar un gasto desde una celda vacía
- **WHEN** a 1280 px se elige la Opción A y se escribe $300.000 en la celda "—" de "Regalos de Navidad"
- **THEN** la Opción A gana "Regalos de Navidad" en Variables por $300.000, y la celda deja de estar resaltada

#### Scenario: Solo lo que cambia
- **WHEN** a 1280 px se marca "Solo lo que cambia" en noviembre
- **THEN** solo quedan las filas que difieren, y la tabla dice cuántos gastos iguales se ocultaron

#### Scenario: Usar una opción
- **WHEN** a 1280 px se toca "Usar Opción B para noviembre"
- **THEN** noviembre queda con la B en uso y se muestra en la vista de una opción
