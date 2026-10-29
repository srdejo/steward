## ADDED Requirements

### Requirement: Marcar un pago
Un miembro SHALL poder marcar pagado un ítem de la opción principal del plan del mes en curso, igual que `marcarPago` del dominio, con:
- monto (mayor que cero);
- quién pagó, un miembro del hogar;
- origen: una cuenta del hogar, "Su cuenta" (`EXTERNA`, fuera de la app) o ninguno.

Reglas:
- Un ítem fijo, de cuota o de crédito se paga una sola vez por mes. Si ya está pagado, MUST responder 409 `YA_PAGADO` con el mensaje "Ya lo pagó {nombre} el {dd mmm}" y no registrar otro pago, aunque lleguen dos a la vez.
- Un ítem variable se registra como gasto y acumula contra su presupuesto.
- Un ítem que no está en la opción principal del mes en curso MUST responder 404 `ITEM_NO_ENCONTRADO`. Una cuenta o una persona que no son del hogar, 404 `CUENTA_NO_ENCONTRADA` o `MIEMBRO_NO_ENCONTRADO`.
- El pago desde "Su cuenta" queda con origen `EXTERNA`: así las vistas lo cuentan como aporte implícito de quien pagó.

#### Scenario: Pago directo
- **WHEN** Esposa marca pagada la Tarjeta Mastercard por $1.500.000 desde "Su cuenta"
- **THEN** queda un pago de $1.500.000 del ítem, a nombre de Esposa, con origen `EXTERNA`

#### Scenario: Pago duplicado
- **WHEN** se intenta marcar Recibo Luz, que ya pagó Esposa el 12 oct
- **THEN** responde 409 `YA_PAGADO` con "Ya lo pagó Esposa el 12 oct", y sigue habiendo un solo pago

#### Scenario: Variable
- **WHEN** se marca pagado Mercado por $40.000 y ya llevaba $180.000
- **THEN** queda un gasto más de Mercado, y Mercado suma $220.000 en el mes

### Requirement: Registrar un gasto
Un miembro SHALL poder registrar un gasto del mes en curso, igual que `registrarGasto` del dominio:
- monto mayor que cero;
- contra un ítem de la opción principal del mes, o sin ítem ("No estaba planeado");
- nota opcional, de hasta 120 caracteres;
- quién pagó y el origen, como en "Marcar un pago".

Un ítem que no está en la opción principal MUST responder 404 `ITEM_NO_ENCONTRADO`.

#### Scenario: No estaba planeado
- **WHEN** Daniel registra $85.000 sin ítem, con la nota "Farmacia"
- **THEN** queda un gasto no planeado de $85.000 con esa nota en el mes en curso

### Requirement: Registrar un aporte
Un miembro SHALL poder registrar un aporte, igual que `registrarAporte` del dominio:
- de un miembro del hogar;
- por un monto mayor que cero;
- para el mes en curso o el siguiente;
- con cuenta destino opcional del hogar;
- con "Aplicar diezmo".

Otro mes MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Aporte para el mes siguiente
- **WHEN** el 28 oct se registra un aporte de Esposa por $500.000 para noviembre
- **THEN** el aporte queda en noviembre, no en octubre

## MODIFIED Requirements

### Requirement: Obligaciones de diezmo
Las obligaciones de diezmo pendientes del mes en curso SHALL calcularse así, con las mismas cifras que el dominio compartido:
- una por cada ingreso recibido que generó diezmo y no se ha entregado: el porcentaje de la regla actual del dueño sobre el bruto o el neto del ingreso recibido, según la base, con el detalle `{porcentaje}% de {nombre del ingreso} · recibido {fecha corta}`;
- una por cada aporte registrado con "Aplicar diezmo" y no entregado: el porcentaje de la regla actual de quien aportó sobre el monto del aporte, con el detalle `{porcentaje}% del aporte · {fecha corta}`;
- los montos se redondean al peso más cercano, con las mitades hacia arriba.

Si el dueño ya no tiene regla, sus obligaciones no aparecen. Cualquier miembro MUST poder consultarlas. Cada una tiene id, monto, detalle, dueño y fecha.

#### Scenario: Diezmo del salario
- **WHEN** "Salario Daniel" (bruto $7.000.000, neto $6.288.000) se recibe el 25 oct y Daniel tiene 10 % sobre el bruto
- **THEN** hay una obligación pendiente de $700.000 con detalle "10% de Salario Daniel · recibido 25 oct"

#### Scenario: Base neto
- **WHEN** la regla de Daniel es 10 % sobre el neto y se recibe el mismo salario
- **THEN** la obligación es de $628.800

#### Scenario: Sin regla
- **WHEN** Esposa no tiene regla activa y se recibe su ingreso fijo
- **THEN** no aparece ninguna obligación por ese ingreso

#### Scenario: Aporte con diezmo
- **WHEN** Daniel, con 10 %, registra el 26 oct un aporte de $2.000.000 con "Aplicar diezmo"
- **THEN** hay una obligación pendiente de $200.000 con detalle "10% del aporte · 26 oct", que "Entregado" cierra como las demás

### Requirement: Finanzas del hogar en una lectura
Un miembro SHALL poder leer en una sola llamada:
- el mes en curso y el ajuste "Diezmo en Hoy";
- las categorías del hogar;
- los ingresos fijos activos de todos los miembros, y sus reglas de diezmo;
- las cuentas;
- los planes de los meses, desde dos meses antes del mes en curso en adelante, con sus opciones e ítems y su estado efectivo;
- los movimientos de esos mismos meses: ingresos recibidos, diezmos entregados (con lo que cubre cada entrega), pagos, gastos y aportes, con su origen y su nota.

Sin hogar, MUST responder 404 `SIN_HOGAR`.

#### Scenario: Lo que ve Esposa
- **WHEN** Daniel ya recibió su salario y Esposa lee las finanzas del hogar
- **THEN** ve "Salario Daniel" como ingreso activo, la regla de Daniel, las cuentas y el ingreso recibido de octubre

#### Scenario: El plan y lo pagado
- **WHEN** Daniel marcó pagado Internet en octubre y Esposa lee las finanzas
- **THEN** ve el plan de octubre con su Opción A, el ítem Internet y su pago a nombre de Daniel
