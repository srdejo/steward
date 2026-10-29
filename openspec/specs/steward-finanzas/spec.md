# steward-finanzas Specification

## Purpose
Define en el backend lo que cada persona aporta al presupuesto del hogar: su regla de diezmo, sus ingresos fijos, recibir un ingreso y la obligación de diezmo que genera, entregar el diezmo, el ajuste "Diezmo en Hoy" y las cuentas básicas, con el aislamiento entre hogares.

## Requirements

### Requirement: Regla de diezmo propia
Cada usuario SHALL tener como máximo una regla de diezmo:
- activa o no;
- porcentaje, mayor que 0 y hasta 100, con hasta dos decimales;
- base Bruto o Neto;
- si aplica a sus aportes.

Un usuario MUST poder consultar y guardar solo su propia regla. Guardar reemplaza la anterior. Un porcentaje fuera de rango MUST responder 400 `DATOS_INVALIDOS`. La regla es de la persona, no del hogar: la conserva si sale del hogar y entra a otro.

#### Scenario: Guardar la regla
- **WHEN** Daniel guarda diezmo activo, 10 % sobre el bruto, sin aplicar a aportes
- **THEN** su regla queda así, y la de Esposa no cambia

#### Scenario: Porcentaje inválido
- **WHEN** se guarda una regla con porcentaje 0 o 120
- **THEN** responde 400 `DATOS_INVALIDOS` y la regla anterior sigue igual

### Requirement: Ingresos fijos propios
Un miembro SHALL poder crear, editar y quitar sus propios ingresos fijos en su hogar. Cada ingreso tiene:
- nombre, de 1 a 60 caracteres;
- bruto y neto en pesos, con neto mayor que 0 y bruto mayor o igual al neto;
- día de pago, de 1 a 31;
- cuenta opcional del hogar.

Quitar un ingreso MUST desactivarlo, sin borrarlo, para conservar lo ya recibido. Editar o quitar el ingreso de otro miembro, o uno de otro hogar, MUST responder 404 `INGRESO_NO_ENCONTRADO`. Datos inválidos MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Crear el salario
- **WHEN** Daniel crea "Salario Daniel" con bruto $7.000.000, neto $6.288.000 y día 25
- **THEN** el ingreso aparece activo, con Daniel como dueño, en las finanzas del hogar

#### Scenario: Bruto menor que el neto
- **WHEN** se guarda un ingreso con bruto $5.000.000 y neto $6.000.000
- **THEN** responde 400 `DATOS_INVALIDOS`

#### Scenario: Ingreso ajeno
- **WHEN** Esposa intenta editar "Salario Daniel"
- **THEN** responde 404 `INGRESO_NO_ENCONTRADO` y el ingreso no cambia

### Requirement: Recibir un ingreso fijo
Cualquier miembro SHALL poder marcar como recibido ("Recibí") un ingreso fijo activo de su hogar.
- Se registra un movimiento de ingreso del mes en curso, en la zona horaria del backend, con el neto del ingreso, su bruto, la fecha de hoy, el dueño del ingreso y quién lo marcó.
- El movimiento MUST quedar marcado como generador de diezmo si el dueño tiene la regla activa en ese momento.
- Marcar el mismo ingreso dos veces en un mes MUST responder 409 `YA_RECIBIDO`.
- Un ingreso inactivo o de otro hogar MUST responder 404 `INGRESO_NO_ENCONTRADO`.

#### Scenario: Salario recibido
- **WHEN** se marca recibido "Salario Daniel" el 25 de octubre
- **THEN** el mes de octubre tiene un ingreso de $6.288.000 de Daniel, recibido el 25 de octubre

#### Scenario: Recibido dos veces
- **WHEN** se marca recibido otra vez "Salario Daniel" en octubre
- **THEN** responde 409 `YA_RECIBIDO` y sigue habiendo un solo ingreso en el mes

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

### Requirement: Entregar el diezmo
Un miembro SHALL poder entregar ("Entregado") una o varias obligaciones pendientes del mes en curso, con cuenta de origen opcional.
- Se registra un movimiento de diezmo entregado por la suma de esas obligaciones, que las cubre, y ellas dejan de estar pendientes.
- Los ids que no corresponden a una obligación pendiente del hogar MUST ignorarse.
- Si ninguno corresponde, MUST responder 409 `SIN_DIEZMO`.
- Una obligación MUST NOT poder entregarse dos veces.

#### Scenario: Entregado
- **WHEN** se entrega la obligación de $700.000 del salario de Daniel
- **THEN** queda un movimiento de diezmo entregado por $700.000 y no quedan obligaciones pendientes

#### Scenario: Agrupado
- **WHEN** hay dos obligaciones pendientes, de $700.000 y $150.000, y se entregan juntas
- **THEN** queda un solo movimiento de $850.000 que cubre las dos

#### Scenario: Ya entregado
- **WHEN** se intenta entregar otra vez la obligación de $700.000
- **THEN** responde 409 `SIN_DIEZMO`

### Requirement: Diezmo en Hoy
El hogar SHALL tener el ajuste "Diezmo en Hoy", con valor `SEPARADO` (por defecto) o `AGRUPADO`. Cualquier miembro MUST poder cambiarlo. Un valor distinto MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Pasar a agrupado
- **WHEN** un miembro elige `AGRUPADO`
- **THEN** las finanzas del hogar muestran `AGRUPADO` para los dos miembros

### Requirement: Cuentas básicas
Un miembro SHALL poder crear una cuenta del hogar con:
- nombre, de 1 a 60 caracteres;
- titular: él mismo o la cuenta conjunta;
- saldo aproximado en pesos, de cero en adelante.

Una cuenta nueva queda sin cuadrar, con ese saldo y la fecha de hoy. Un miembro MUST NOT poder crear una cuenta a nombre de otro. Todos los miembros ven las cuentas del hogar. Cuadrar, el saldo estimado, mover dinero y los créditos no son parte de esta capacidad todavía.

#### Scenario: Cuentas del onboarding
- **WHEN** en el onboarding Daniel crea "Davivienda" con $4.000.000 a su nombre y "Efectivo" con $200.000 conjunta
- **THEN** el hogar tiene las dos cuentas, sin cuadrar, y Esposa también las ve

#### Scenario: Nombre vacío
- **WHEN** se crea una cuenta sin nombre
- **THEN** responde 400 `DATOS_INVALIDOS`

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

### Requirement: Aislamiento de las finanzas
Todo lo de esta capacidad SHALL resolverse a partir del hogar del usuario de la sesión. Ingresos, cuentas, movimientos y obligaciones de otro hogar MUST NOT poder leerse ni modificarse. Un id ajeno MUST responder igual que uno inexistente. Sin sesión, MUST responder 401.

#### Scenario: Ingreso de otro hogar
- **WHEN** un miembro de otro hogar marca recibido "Salario Daniel" usando su id
- **THEN** responde 404 `INGRESO_NO_ENCONTRADO` y "Nuestra casa" no tiene ningún ingreso nuevo

#### Scenario: Entregar diezmo ajeno
- **WHEN** un miembro de otro hogar entrega la obligación de Daniel usando su id
- **THEN** responde 409 `SIN_DIEZMO` y la obligación sigue pendiente en "Nuestra casa"

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
