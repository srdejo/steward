## MODIFIED Requirements

### Requirement: Recibir un ingreso fijo
Cualquier miembro SHALL poder marcar como recibido ("Recibí") un ingreso del mes en curso, en la zona horaria del backend:
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

### Requirement: Registrar un aporte
Un miembro SHALL poder registrar un aporte, igual que `registrarAporte` del dominio:
- de un miembro del hogar;
- por un monto mayor que cero;
- para el mes en curso o el siguiente;
- con cuenta destino opcional del hogar;
- con "Aplicar diezmo".

Otro mes MUST responder 400 `DATOS_INVALIDOS`. Con "Aplicar diezmo", el aporte MUST ganar su propio ítem de diezmo en el plan de su mes, en la misma transacción (spec `steward-plan-mes`, "Ítems de diezmo").

#### Scenario: Aporte para el mes siguiente
- **WHEN** el 28 oct se registra un aporte de Esposa por $500.000 para noviembre
- **THEN** el aporte queda en noviembre, no en octubre

#### Scenario: Aporte con diezmo en un mes con plan
- **WHEN** el 26 oct Daniel, con 10 %, registra un aporte de $2.000.000 con "Aplicar diezmo", y octubre tiene plan
- **THEN** el aporte queda en octubre y la opción en uso de octubre tiene "Diezmo · aporte 26 oct" por $200.000

### Requirement: Finanzas del hogar en una lectura
Un miembro SHALL poder leer en una sola llamada:
- el mes en curso;
- las categorías del hogar;
- los ingresos fijos activos de todos los miembros, y sus reglas de diezmo;
- las cuentas, cada una con el orden de registro de su último cuadre;
- los créditos, con sus últimos pagos;
- los planes de los meses, desde dos meses antes del mes en curso en adelante, con sus opciones, sus líneas de ingreso e ítems (y el crédito, el ingreso fijo o el aporte de cada ítem enlazado) y su estado efectivo;
- los movimientos de esos mismos meses, más los de cualquier mes que todavía cuenten en el saldo estimado de alguna cuenta: ingresos recibidos, pagos, gastos, aportes, ajustes de cuadre, transferencias, abonos y las entregas de diezmo registradas antes de que el diezmo pasara al plan, con su orden de registro, su origen, su nota, su cuenta destino y su crédito;
- los cierres desde tres meses antes del mes en curso (el del mes anterior a los que se leen trae el "Sobrante de {mes}" del primero), con sus filas, "Sin registrar", el sobrante, el reparto, quién cerró y la fecha;
- los planes anuales desde el año del primer mes que se lee, con sus celdas y eventos, y los aportes proyectados de esos años.

Sin hogar, MUST responder 404 `SIN_HOGAR`.

#### Scenario: Lo que ve Esposa
- **WHEN** Daniel ya recibió su salario y Esposa lee las finanzas del hogar
- **THEN** ve "Salario Daniel" como ingreso activo, la regla de Daniel, las cuentas y el ingreso recibido de octubre

#### Scenario: El plan y lo pagado
- **WHEN** Daniel marcó pagado Internet en octubre y Esposa lee las finanzas
- **THEN** ve el plan de octubre con su Opción A, el ítem Internet y su pago a nombre de Daniel

#### Scenario: Un crédito con su cuota pagada
- **WHEN** Daniel pagó "Cuota libre inversión" y Esposa lee las finanzas
- **THEN** ve "Libre inversión" con el saldo ya rebajado y la cuota en sus últimos pagos

#### Scenario: Un mes cerrado
- **WHEN** Daniel cerró octubre con $1.166.000 al mes siguiente y Esposa lee las finanzas
- **THEN** ve el cierre de octubre con sus filas, su sobrante y el reparto, y el plan de octubre en Cerrado

#### Scenario: El plan anual
- **WHEN** Daniel creó el plan anual 2027 con un evento y Esposa proyectó sus aportes, y Esposa lee las finanzas
- **THEN** ve el plan anual 2027 con sus celdas, el evento y las proyecciones de los dos

### Requirement: Aislamiento de las finanzas
Todo lo de esta capacidad SHALL resolverse a partir del hogar del usuario de la sesión. Ingresos, cuentas, créditos, movimientos e ítems de otro hogar MUST NOT poder leerse ni modificarse. Un id ajeno MUST responder igual que uno inexistente. Sin sesión, MUST responder 401.

#### Scenario: Ingreso de otro hogar
- **WHEN** un miembro de otro hogar marca recibido "Salario Daniel" usando su id
- **THEN** responde 404 `INGRESO_NO_ENCONTRADO` y "Nuestra casa" no tiene ningún ingreso nuevo

#### Scenario: Entregar diezmo ajeno
- **WHEN** un miembro de otro hogar marca pagado "Diezmo · Salario Daniel" usando el id de ese ítem
- **THEN** responde 404 `ITEM_NO_ENCONTRADO` y el ítem sigue sin pagar en "Nuestra casa"

#### Scenario: Cuadrar o abonar algo ajeno
- **WHEN** un miembro de otro hogar cuadra Davivienda o abona a "Libre inversión" usando sus ids
- **THEN** responde 404 `CUENTA_NO_ENCONTRADA` o `CREDITO_NO_ENCONTRADO`, y nada cambia en "Nuestra casa"

## REMOVED Requirements

### Requirement: Obligaciones de diezmo
**Reason**: El diezmo pasa a presupuestarse como ítems del plan, uno por ingreso (spec `steward-plan-mes`, "Ítems de diezmo"); ya no hay obligaciones que se generan al recibir.
**Migration**: `GET /api/diezmo/pendientes` deja de existir. Lo pendiente de diezmo es lo que falta por pagar de los ítems de tipo `DIEZMO` del mes. La migración `V8` agrega esos ítems a los planes abiertos.

### Requirement: Entregar el diezmo
**Reason**: Cada ítem de diezmo se marca con "Marcar pago", desde una cuenta, como cualquier gasto.
**Migration**: `POST /api/diezmo/entregas` deja de existir; se usa `POST` de pagos del ítem (spec `steward-hoy`, "Marcar un pago"). Las entregas ya registradas se conservan como historia: siguen restando de su cuenta y cuentan como gasto sin ítem de su mes.

### Requirement: Diezmo en Hoy
**Reason**: Solo decidía cómo se agrupaba la tarjeta "Disponible para diezmar", que desaparece.
**Migration**: `PUT /api/hogar/diezmo-en-hoy` y el campo `diezmoEnHoy` de las finanzas dejan de existir; la columna se borra en `V8`.
