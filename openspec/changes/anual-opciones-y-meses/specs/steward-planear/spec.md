## MODIFIED Requirements

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

El diezmo MUST verse calculado desde las reglas, no editable. Editar un mes después MUST NOT modificar el anual.

**Opciones.** El año SHALL mostrar sus opciones como pestañas (web) o chips (móvil), con la letra, la inicial del autor si no es quien está en la sesión, y la nota. "+ Duplicar Opción X" duplica la elegida y la deja elegida; "Quitar opción" sale en las que se pueden quitar, con confirmación. Lo que se edita (celdas, lo que cambia, replicar) MUST ir a la opción elegida. Con dos opciones o más:
- en web, las celdas de la opción elegida que difieren de la Opción A MUST verse marcadas, y debajo de la tabla "Las dos opciones, mes a mes" muestra lo que dejaría libre cada mes la A y la elegida, con el total del año;
- en móvil, cada mes muestra lo que deja libre con la diferencia frente a la A ("−$1.200.000 vs A");
- el KPI del año dice cuánto más o menos deja libre la elegida frente a la A.

**Meses con la Opción X.** El botón SHALL abrir una hoja con los 12 meses (agrupando los seguidos que están igual), cada uno con lo que tiene hoy ("Borrador · solo el salario y su diezmo", "Activo · tiene pagos") y lo que pasará:
- sin plan: "Se crea";
- con plan que se puede actualizar: una casilla "Se actualiza / No se toca", marcada si nació del plan anual o no tiene gastos;
- con registros o cerrado: deshabilitado, con el motivo.

La hoja MUST avisar que actualizar reemplaza el plan del mes con sus opciones. El botón dice cuántos meses se crean y se actualizan ("Crear 2 y actualizar 10 meses"), y al confirmar vuelve al año con la opción en uso.

**Vistas.**
- Desde 1024 px: la tabla de 12 meses por categoría, con las celdas que cambian frente al mes base resaltadas. Tocar una celda cambia solo ese mes.
- Con menos de 1024 px: una lista de los 12 meses con lo que queda libre y lo que cambia en cada uno (los meses seguidos sin cambios, agrupados: "Septiembre a noviembre · Igual al mes base"). Tocar un mes abre "Algo distinto en {mes}" en una hoja.

**Borrar.** El plan del año SHALL ofrecer "Borrar plan de {año}", en Borrador o con los meses ya creados. La confirmación MUST decir qué se borra ("Se borran los montos, 7 cambios y los aportes proyectados de 2027. Los meses ya creados no cambian.") y, después, Planear MUST mostrar el año sin plan.

En modo conectado, replicar, los cambios, las opciones, borrar y "Meses con la Opción X" MUST guardarse en el backend, y los dos miembros MUST ver las mismas cifras.

#### Scenario: Replicar octubre
- **WHEN** en 2027 sin plan anual se elige "Octubre 2026" como mes base (Gastos fijos $795.000, Tarjetas y cuotas $2.675.000, Variables $720.000, Créditos $500.000, aportes de Esposa $1.500.000) y se toca "Replicar en los 12 meses"
- **THEN** cada mes de 2027 tiene esos totales y deja libre $2.398.000, y el libre del año es $28.776.000

#### Scenario: Evento del año
- **WHEN** se agrega un evento SOAT en marzo de $1.200.000
- **THEN** la columna de marzo y el KPI de libre proyectado bajan $1.200.000

#### Scenario: Crear el anual vacío
- **WHEN** 2027 no tiene plan anual y Daniel elige "Desde cero" y toca "Replicar en los 12 meses"
- **THEN** se ve el año 2027 con cada categoría del hogar en $0, una fila de aportes por miembro en $0 y "Meses con la Opción A"

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
- **WHEN** en modo conectado se toca "Meses con la Opción A" en 2027
- **THEN** los meses de 2027 sin plan aparecen en Planear en Borrador para los dos miembros

#### Scenario: Opción B con carro nuevo
- **WHEN** a 1280 px se duplica la Opción A de 2027 y en la B se agrega "Venta carro viejo" +$8.000.000 en marzo y "Cuota carro nuevo" $1.200.000 en Créditos de abril en adelante
- **THEN** la pestaña Opción B queda elegida, las celdas de marzo y de Créditos de abril a diciembre se ven distintas de la A, y "Las dos opciones, mes a mes" muestra a la B con $2.800.000 menos en el año

#### Scenario: Actualizar los meses de 2027
- **WHEN** enero de 2027 está en Borrador con gastos hechos a mano, febrero tiene pagos y marzo a diciembre solo tienen el salario, y se abre "Meses con la Opción A"
- **THEN** enero sale sin marcar, febrero deshabilitado con "Tiene pagos", marzo a diciembre marcados, y el botón dice "Actualizar 10 meses"
