## MODIFIED Requirements

### Requirement: Recibir un ingreso fijo
Cualquier miembro SHALL poder marcar como recibido ("Recibí") un ingreso del mes en curso o del siguiente, en la zona horaria del backend (por defecto el mes en curso; una línea de la opción lo toma de su plan; otro mes responde 400 `DATOS_INVALIDOS`). La fecha es la de hoy:
- **una línea de ingreso** de la opción principal del mes (spec `steward-plan-mes`, "Ingresos de la opción"), de cualquier tipo;
- o, si el mes no tiene plan, **un ingreso fijo activo** del hogar.

Se registra un movimiento de ingreso del mes con el monto que indique quien lo marca o, si no indica ninguno, el de la línea (o el neto del ingreso fijo), con la fecha de hoy, la persona de la línea o el dueño del ingreso, quién lo marcó, el ingreso fijo y su bruto si la línea está enlazada a uno, y la línea si la hay. Va a la cuenta del ingreso fijo enlazado, si la tiene.
- Recibir un ingreso MUST NOT crear ninguna obligación de diezmo: su diezmo ya está presupuestado como ítem del plan del mes (spec `steward-plan-mes`, "Ítems de diezmo").
- Marcar la misma línea dos veces, o el mismo ingreso fijo dos veces en un mes, MUST responder 409 `YA_RECIBIDO`.
- Un monto menor o igual a cero MUST responder 400 `DATOS_INVALIDOS`.
- Un ingreso inactivo o de otro hogar, o una línea de otro hogar, MUST responder 404 `INGRESO_NO_ENCONTRADO`.

#### Scenario: Salario recibido
- **WHEN** se marca recibido "Salario Daniel" el 25 de octubre
- **THEN** el mes de octubre tiene un ingreso de $6.288.000 de Daniel, recibido el 25 de octubre

#### Scenario: Recibido dos veces
- **WHEN** se marca recibido otra vez "Salario Daniel" en octubre
- **THEN** responde 409 `YA_RECIBIDO` y sigue habiendo un solo ingreso en el mes

#### Scenario: Recibido con otro monto
- **WHEN** el 25 de octubre llega "Salario Daniel" por $6.350.000 y se marca recibido con ese monto
- **THEN** octubre tiene un ingreso de $6.350.000 enlazado a la línea, y la línea de la opción sigue en $6.288.000 como plan

#### Scenario: Ingreso agregado a mano
- **WHEN** octubre tiene la línea "Venta bicicleta" por $400.000 y se marca recibida
- **THEN** octubre tiene un ingreso de $400.000 enlazado a esa línea

#### Scenario: Recibir en el mes siguiente
- **WHEN** hoy es 30 oct y se recibe la línea "Salario Daniel" del plan de noviembre
- **THEN** queda un ingreso de noviembre con fecha 30 oct, y la línea de octubre sigue por recibir

#### Scenario: Una línea de un mes más lejano
- **WHEN** hoy es 30 oct y se recibe una línea del plan de diciembre
- **THEN** responde 400 `DATOS_INVALIDOS` y no se registra nada

### Requirement: Marcar un pago
Un miembro SHALL poder marcar pagado un ítem de la opción principal del plan del mes en curso o del siguiente (por defecto el mes en curso; otro mes responde 400 `DATOS_INVALIDOS`), igual que `marcarPago` del dominio, con:
- monto (mayor que cero);
- quién pagó, un miembro del hogar;
- origen: una cuenta del hogar, "Su cuenta" (`EXTERNA`, fuera de la app) o ninguno.

Reglas:
- Un ítem fijo, de cuota o de crédito se paga una sola vez por mes. Si ya está pagado, MUST responder 409 `YA_PAGADO` con el mensaje "Ya lo pagó {nombre} el {dd mmm}" y no registrar otro pago, aunque lleguen dos a la vez.
- Un ítem variable se registra como gasto y acumula contra su presupuesto.
- Un ítem que no está en la opción principal de ese mes MUST responder 404 `ITEM_NO_ENCONTRADO`. Una cuenta o una persona que no son del hogar, 404 `CUENTA_NO_ENCONTRADA` o `MIEMBRO_NO_ENCONTRADO`.
- El pago desde "Su cuenta" queda con origen `EXTERNA`: así las vistas lo cuentan como aporte implícito de quien pagó.
- El pago de un ítem enlazado a un crédito MUST bajar el saldo del crédito en la parte de capital: el monto pagado menos el interés del mes (el saldo por la tasa efectiva mensual, redondeado al peso), sin bajar de cero. El pago aparece en los últimos pagos del crédito como cuota.

#### Scenario: Pago directo
- **WHEN** Esposa marca pagada la Tarjeta Mastercard por $1.500.000 desde "Su cuenta"
- **THEN** queda un pago de $1.500.000 del ítem, a nombre de Esposa, con origen `EXTERNA`

#### Scenario: Pago duplicado
- **WHEN** se intenta marcar Recibo Luz, que ya pagó Esposa el 12 oct
- **THEN** responde 409 `YA_PAGADO` con "Ya lo pagó Esposa el 12 oct", y sigue habiendo un solo pago

#### Scenario: Variable
- **WHEN** se marca pagado Mercado por $40.000 y ya llevaba $180.000
- **THEN** queda un gasto más de Mercado, y Mercado suma $220.000 en el mes

#### Scenario: Cuota de un crédito
- **WHEN** se paga "Cuota libre inversión" por $500.000 y el crédito tiene saldo $14.250.000 al 1,6 % EM
- **THEN** el interés del mes es $228.000, el saldo baja $272.000 y queda en $13.978.000

#### Scenario: Pagar un ítem del mes siguiente
- **WHEN** hoy es 30 oct y se marca pagado Internet de noviembre con `mes` noviembre
- **THEN** queda un pago de noviembre con fecha 30 oct, y octubre no cambia

#### Scenario: Sin indicar el mes
- **WHEN** se marca pagado un ítem de noviembre sin indicar `mes`, y hoy es 30 oct
- **THEN** responde 404 `ITEM_NO_ENCONTRADO`, porque se busca en octubre

### Requirement: Registrar un gasto
Un miembro SHALL poder registrar un gasto del mes en curso o del siguiente (por defecto el mes en curso; otro mes responde 400 `DATOS_INVALIDOS`), igual que `registrarGasto` del dominio:
- monto mayor que cero;
- contra un ítem de la opción principal del mes, o sin ítem ("No estaba planeado");
- nota opcional, de hasta 120 caracteres;
- quién pagó y el origen, como en "Marcar un pago".

Un ítem que no está en la opción principal MUST responder 404 `ITEM_NO_ENCONTRADO`.

#### Scenario: No estaba planeado
- **WHEN** Daniel registra $85.000 sin ítem, con la nota "Farmacia"
- **THEN** queda un gasto no planeado de $85.000 con esa nota en el mes en curso

#### Scenario: Gasto en el mes siguiente
- **WHEN** hoy es 30 oct y se registra un gasto no planeado con `mes` noviembre
- **THEN** queda en noviembre con fecha 30 oct

#### Scenario: Un mes que no se puede
- **WHEN** hoy es 30 oct y se registra un gasto con `mes` septiembre
- **THEN** responde 400 `DATOS_INVALIDOS` y no se registra nada
