## MODIFIED Requirements

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
