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

Una cuenta nueva queda sin cuadrar, con ese saldo y la fecha de hoy, y su saldo estimado suma solo lo registrado después de crearla. Un miembro MUST NOT poder crear una cuenta a nombre de otro. Todos los miembros ven las cuentas del hogar.

El saldo estimado de una cuenta SHALL ser, como en `saldoEstimado` del dominio, el saldo de su último cuadre (o el inicial) más el efecto de lo registrado después, en el orden en que se registró:
- suman los ingresos recibidos y los aportes que llegan a la cuenta, y lo que llega por una transferencia;
- restan los pagos, gastos, diezmos entregados y abonos a créditos que salen de la cuenta, y lo que sale por una transferencia;
- los ajustes de cuadre no la cambian.

El saldo estimado no depende de cuántos meses lee la app: lo registrado antes de los meses que se leen sigue contando hasta el siguiente cuadre.

#### Scenario: Cuentas del onboarding
- **WHEN** en el onboarding Daniel crea "Davivienda" con $4.000.000 a su nombre y "Efectivo" con $200.000 conjunta
- **THEN** el hogar tiene las dos cuentas, sin cuadrar, y Esposa también las ve

#### Scenario: Nombre vacío
- **WHEN** se crea una cuenta sin nombre
- **THEN** responde 400 `DATOS_INVALIDOS`

#### Scenario: Un pago de hace cuatro meses
- **WHEN** Davivienda no se cuadra desde junio y en junio se pagó desde ella $50.000
- **THEN** en octubre su saldo estimado sigue descontando esos $50.000

### Requirement: Finanzas del hogar en una lectura
Un miembro SHALL poder leer en una sola llamada:
- el mes en curso y el ajuste "Diezmo en Hoy";
- las categorías del hogar;
- los ingresos fijos activos de todos los miembros, y sus reglas de diezmo;
- las cuentas, cada una con el orden de registro de su último cuadre;
- los créditos, con sus últimos pagos;
- los planes de los meses, desde dos meses antes del mes en curso en adelante, con sus opciones e ítems (y el crédito de cada ítem enlazado) y su estado efectivo;
- los movimientos de esos mismos meses, más los de cualquier mes que todavía cuenten en el saldo estimado de alguna cuenta: ingresos recibidos, diezmos entregados (con lo que cubre cada entrega), pagos, gastos, aportes, ajustes de cuadre, transferencias y abonos, con su orden de registro, su origen, su nota, su cuenta destino y su crédito;
- los cierres desde tres meses antes del mes en curso (el del mes anterior a los que se leen trae el "Sobrante de {mes}" del primero), con sus filas, "Sin registrar", el sobrante, el reparto, quién cerró y la fecha.

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

### Requirement: Aislamiento de las finanzas
Todo lo de esta capacidad SHALL resolverse a partir del hogar del usuario de la sesión. Ingresos, cuentas, créditos, movimientos y obligaciones de otro hogar MUST NOT poder leerse ni modificarse. Un id ajeno MUST responder igual que uno inexistente. Sin sesión, MUST responder 401.

#### Scenario: Ingreso de otro hogar
- **WHEN** un miembro de otro hogar marca recibido "Salario Daniel" usando su id
- **THEN** responde 404 `INGRESO_NO_ENCONTRADO` y "Nuestra casa" no tiene ningún ingreso nuevo

#### Scenario: Entregar diezmo ajeno
- **WHEN** un miembro de otro hogar entrega la obligación de Daniel usando su id
- **THEN** responde 409 `SIN_DIEZMO` y la obligación sigue pendiente en "Nuestra casa"

#### Scenario: Cuadrar o abonar algo ajeno
- **WHEN** un miembro de otro hogar cuadra Davivienda o abona a "Libre inversión" usando sus ids
- **THEN** responde 404 `CUENTA_NO_ENCONTRADA` o `CREDITO_NO_ENCONTRADO`, y nada cambia en "Nuestra casa"

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

### Requirement: Cuadrar cuentas
Un miembro SHALL poder cuadrar una o varias cuentas del hogar en una sola operación, igual que `cuadrarCuentas` del dominio, escribiendo por cada una lo que dice el banco (de cero en adelante).

Por cada cuenta:
- la diferencia es el saldo estimado menos lo que dice el banco;
- si no es cero, se registra un ajuste "Gastos sin registrar" del mes en curso por esa diferencia, que puede ser negativa (entró dinero sin registrar), a nombre de quien cuadra;
- la cuenta queda cuadrada hoy, con ese saldo, y desde ahí su saldo estimado suma solo lo registrado después.

Las cuentas que no vienen en la operación MUST NOT cambiar. Una cuenta que no es del hogar MUST responder 404 `CUENTA_NO_ENCONTRADA`, sin cuadrar ninguna. Un saldo negativo MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Diferencia
- **WHEN** Davivienda se creó con $4.000.000, se pagó desde ella Recibo Luz por $50.000, y Daniel cuadra Davivienda en $3.900.000
- **THEN** queda un ajuste "Gastos sin registrar" de $50.000 en el mes en curso, y Davivienda queda cuadrada hoy con $3.900.000

#### Scenario: Entró dinero
- **WHEN** Efectivo estima $200.000 y se cuadra en $230.000
- **THEN** queda un ajuste de −$30.000 y Efectivo queda con $230.000

#### Scenario: Lo de antes del cuadre no cuenta
- **WHEN** después de cuadrar Davivienda en $3.900.000 se paga desde ella Internet por $120.000
- **THEN** el saldo estimado de Davivienda es $3.780.000

### Requirement: Mover dinero
Un miembro SHALL poder registrar una transferencia ("Mover dinero") entre dos cuentas distintas del hogar, igual que `moverDinero` del dominio, por un monto mayor que cero, con la fecha de hoy y a su nombre. La transferencia baja el saldo estimado de la cuenta de origen y sube el de la de destino, y no cuenta como gasto ni como aporte.

La misma cuenta en origen y destino MUST responder 400 `MISMA_CUENTA`. Una cuenta que no es del hogar MUST responder 404 `CUENTA_NO_ENCONTRADA`. Un monto de cero o menos MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Del banco al efectivo
- **WHEN** Daniel mueve $100.000 de Davivienda (≈ $3.900.000) a Efectivo (≈ $200.000)
- **THEN** los saldos estimados quedan en $3.800.000 y $300.000, y "Te queda libre" no cambia

#### Scenario: Misma cuenta
- **WHEN** se intenta mover de Davivienda a Davivienda
- **THEN** responde 400 `MISMA_CUENTA` y no se registra nada

### Requirement: Créditos del hogar
Un miembro SHALL poder agregar un crédito del hogar con:
- nombre (1 a 40 caracteres) y entidad (hasta 40);
- saldo, de cero en adelante, y total original, mayor o igual al saldo y mayor que cero;
- cuota mensual, mayor que cero;
- tasa efectiva mensual en porcentaje, de 0 a 10, con hasta dos decimales;
- día de pago, de 1 a 31.

Datos inválidos MUST responder 400 `DATOS_INVALIDOS`.

Al agregarlo, si el mes en curso tiene plan y no está cerrado, su Opción A MUST ganar un ítem de la categoría de créditos del hogar, de tipo `CREDITO`, enlazado al crédito, con el nombre "Cuota {nombre en minúsculas}", el monto de la cuota y el día de pago como vencimiento. Todos los miembros ven los créditos del hogar.

#### Scenario: Agregar un crédito
- **WHEN** con el plan de octubre activo, Daniel agrega "Libre inversión" de Bancolombia con saldo $14.250.000, total $20.000.000, cuota $500.000, 1,6 % EM y día 15
- **THEN** el hogar tiene el crédito, y la Opción A de octubre tiene "Cuota libre inversión" por $500.000, que vence el día 15, en Créditos

#### Scenario: Sin plan en el mes
- **WHEN** el mes en curso no tiene plan y se agrega un crédito
- **THEN** el crédito se crea y no se crea ningún plan

#### Scenario: Total menor que el saldo
- **WHEN** se agrega un crédito con saldo $14.250.000 y total original $10.000.000
- **THEN** responde 400 `DATOS_INVALIDOS`

### Requirement: Abono y saldo de un crédito
Un miembro SHALL poder:
- **actualizar el saldo** de un crédito del hogar (de cero en adelante), con la fecha de hoy, igual que `actualizarSaldoCredito` del dominio;
- **registrar un abono** a capital, igual que `registrarAbono` del dominio: monto mayor que cero y no mayor que el saldo, a nombre de un miembro y con origen (una cuenta del hogar, "Su cuenta" o ninguno). El abono baja el saldo y queda registrado como movimiento del mes en curso.

Un abono mayor que el saldo MUST responder 400 `ABONO_MAYOR` y no cambiar nada. Un crédito de otro hogar MUST responder 404 `CREDITO_NO_ENCONTRADO`. Dos abonos a la vez MUST NOT dejar el saldo por debajo de cero.

Cada crédito SHALL mostrar sus últimos pagos (las cuotas pagadas y los abonos, de lo registrado), del más reciente al más antiguo.

#### Scenario: Abono
- **WHEN** a "Libre inversión" con saldo $14.250.000 se le abona $2.000.000 desde Davivienda
- **THEN** el saldo queda en $12.250.000, Davivienda baja $2.000.000 y el abono aparece primero en sus últimos pagos

#### Scenario: Abono mayor que el saldo
- **WHEN** se abona $15.000.000 a un crédito con saldo $14.250.000
- **THEN** responde 400 `ABONO_MAYOR` y el saldo sigue en $14.250.000

#### Scenario: Actualizar saldo
- **WHEN** el banco dice que el saldo es $13.900.000 y se actualiza
- **THEN** el crédito queda con $13.900.000, actualizado hoy

### Requirement: Registros en un mes cerrado
En un mes cerrado, estos registros MUST responder 409 `MES_CERRADO` y no registrar nada, como `asegurarAbierto` del dominio:
- "Recibí";
- "Entregado";
- marcar un pago;
- registrar un gasto;
- registrar un aporte para ese mes.

Cuadrar cuentas, mover dinero y registrar un abono a un crédito no dependen del plan del mes y MUST seguir funcionando aunque el mes en curso esté cerrado. Sus movimientos no cambian el cierre guardado.

#### Scenario: Recibir en un mes cerrado
- **WHEN** octubre está cerrado y se marca recibido "Salario Daniel" en octubre
- **THEN** responde 409 `MES_CERRADO` y no queda ningún ingreso nuevo

#### Scenario: Aporte para el mes siguiente
- **WHEN** el 30 oct octubre ya está cerrado y se registra un aporte para noviembre
- **THEN** el aporte queda en noviembre

#### Scenario: Cuadrar con el mes cerrado
- **WHEN** octubre está cerrado y el 30 oct se cuadra Davivienda con una diferencia
- **THEN** la cuenta queda cuadrada y el cierre de octubre guardado no cambia
