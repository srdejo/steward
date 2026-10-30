## ADDED Requirements

### Requirement: Editar el mes en curso
El plan de un mes Activo SHALL editarse igual que uno en Borrador: sus líneas de ingreso, sus ítems (agregar, editar y quitar) y sus diezmos. Lo único que un mes Activo MUST NOT permitir son varias opciones (duplicar, quitar una opción o cambiar la que está en uso), que siguen las reglas de "Usar la opción y estados del mes". Un mes Cerrado MUST seguir en solo lectura (409 `MES_CERRADO`). Quitar un ítem que ya tiene pagos o gastos MUST seguir respondiendo 409 `ITEM_CON_PAGOS`.

#### Scenario: Subir el mercado de octubre
- **WHEN** octubre es el mes en curso y está Activo, y se cambia Mercado de $800.000 a $900.000
- **THEN** la opción en uso de octubre queda con Mercado en $900.000, y Hoy lo muestra así

#### Scenario: Un gasto nuevo en el mes en curso
- **WHEN** en octubre Activo se agrega "Regalo" por $150.000 en Variables
- **THEN** aparece en Por pagar de Hoy por $150.000

### Requirement: Borrar el plan de un mes
Un miembro SHALL poder borrar el plan de un mes ("Borrar plan de {mes}"). Se borran, en una sola transacción:
- el plan, con todas sus opciones, líneas de ingreso e ítems;
- los pagos, gastos (también los "No estaba planeado") e ingresos recibidos de ese mes;
- el cierre del mes, si estaba cerrado.

Los aportes, los ajustes de cuadre, las transferencias y los abonos del mes MUST conservarse: no son del plan. Las cuotas de crédito borradas MUST devolver al saldo del crédito lo que su pago le había bajado, cuando el pago lo registró ("Corregir o borrar un registro", spec `steward-finanzas`). Antes de borrar, el miembro MUST poder ver cuántos pagos, gastos e ingresos recibidos se borrarán. Después el mes queda "Sin plan" y se puede volver a crear. Un mes que no tiene plan ni cierre MUST responder 404 `PLAN_NO_ENCONTRADO`.

#### Scenario: Borrar un mes mal creado
- **WHEN** noviembre está en Borrador sin registros y se borra su plan
- **THEN** noviembre queda "Sin plan" y se puede crear otra vez con "Desde cero"

#### Scenario: Borrar un mes con pagos
- **WHEN** octubre tiene el pago de Arriendo desde Davivienda, un gasto en Mercado, el salario recibido y un aporte, y se borra su plan
- **THEN** se borran el pago, el gasto y el ingreso recibido, el aporte se conserva, y el saldo estimado de Davivienda sube lo que había bajado el Arriendo

#### Scenario: Borrar un mes cerrado
- **WHEN** septiembre está cerrado con $500.000 pasados a octubre, y se borra el plan de septiembre
- **THEN** septiembre queda sin plan ni cierre, y octubre ya no muestra "Sobrante de septiembre"

### Requirement: Empezar de nuevo
Un miembro SHALL poder "Empezar de nuevo": se borran todos los planes de los meses, sus cierres, los planes anuales con sus aportes proyectados y todos los movimientos del hogar. Se conservan los miembros, las invitaciones, los ingresos fijos, las reglas de diezmo, las categorías, las cuentas y los créditos.

Cada cuenta MUST conservar el saldo estimado que tenía antes de empezar de nuevo, como su nuevo punto de partida, y cada crédito, su saldo. Todo se hace en una sola transacción.

#### Scenario: Empezar de nuevo
- **WHEN** el hogar tiene planes de septiembre a noviembre, pagos y un plan anual, y Davivienda está en ≈ $2.500.000, y un miembro elige "Empezar de nuevo"
- **THEN** ningún mes tiene plan, no hay plan anual ni registros, "Salario Daniel" y su regla siguen en Ajustes, y Davivienda sigue en $2.500.000

### Requirement: El diezmo sigue a su línea de ingreso
Cada ítem de diezmo que nace de una línea de ingreso de la opción SHALL quedar enlazado a esa línea. Su monto sugerido es el porcentaje de la regla del dueño de la línea sobre la base de la regla: el bruto de la línea si la base es BRUTO, o su monto si es NETO. Al nacer, una línea de un ingreso fijo toma el bruto de ese ingreso; una línea de un evento del anual o agregada a mano tiene el bruto igual a su monto.

Cuando cambia el monto o el bruto de la línea:
- su ítem de diezmo MUST recalcularse solo, si no está ajustado a mano y no tiene pagos;
- si está ajustado a mano, MUST conservar su monto.

Un ítem de diezmo MUST quedar "ajustado a mano" cuando un miembro cambia su monto, y SHALL ofrecer "Volver a calcular", que lo devuelve al monto sugerido y le quita esa marca. Quitar una línea MUST quitar también su ítem de diezmo si este no tiene pagos.

"+ Ingreso" SHALL ofrecer "Aplicar diezmo", que inicia marcado si la persona de la línea tiene la regla activa y crea su ítem de diezmo enlazado.

#### Scenario: Cambiar el salario en el plan
- **WHEN** en noviembre "Salario Daniel" tiene bruto $5.100.000, su diezmo (10 % del bruto) es $510.000, y se cambia el bruto de la línea a $5.500.000
- **THEN** "Diezmo · Salario Daniel" de noviembre pasa a $550.000

#### Scenario: Diezmo ajustado a mano
- **WHEN** "Diezmo · Salario Daniel" de noviembre se cambió a mano a $600.000, y luego se cambia el bruto de la línea a $5.500.000
- **THEN** el diezmo sigue en $600.000 con "ajustado a mano", y "Volver a calcular" lo deja en $550.000

#### Scenario: Diezmo ya pagado
- **WHEN** el diezmo del salario de octubre ya se pagó y se cambia el salario de octubre
- **THEN** el diezmo pagado no cambia

#### Scenario: Ingreso agregado con diezmo
- **WHEN** Daniel, con 10 %, agrega en noviembre "+ Ingreso" "Venta bicicleta" por $400.000 con "Aplicar diezmo"
- **THEN** noviembre gana la línea y "Diezmo · Venta bicicleta" por $40.000, enlazado a ella
