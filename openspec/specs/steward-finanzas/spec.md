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

Otro mes MUST responder 400 `DATOS_INVALIDOS`. Con "Aplicar diezmo", el aporte MUST ganar su propio ítem de diezmo en el plan de su mes, en la misma transacción (spec `steward-plan-mes`, "Ítems de diezmo").

#### Scenario: Aporte para el mes siguiente
- **WHEN** el 28 oct se registra un aporte de Esposa por $500.000 para noviembre
- **THEN** el aporte queda en noviembre, no en octubre

#### Scenario: Aporte con diezmo en un mes con plan
- **WHEN** el 26 oct Daniel, con 10 %, registra un aporte de $2.000.000 con "Aplicar diezmo", y octubre tiene plan
- **THEN** el aporte queda en octubre y la opción en uso de octubre tiene "Diezmo · aporte 26 oct" por $200.000

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
- marcar un pago;
- registrar un gasto;
- registrar un aporte para ese mes;
- corregir o borrar un registro de ese mes.

Para cambiar un mes cerrado hay que borrar antes su plan ("Borrar el plan de un mes", spec `steward-plan-mes`).

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

#### Scenario: Borrar un registro de un mes cerrado
- **WHEN** septiembre está cerrado y se intenta borrar un gasto de septiembre
- **THEN** responde 409 `MES_CERRADO` y el gasto sigue

### Requirement: Corregir o borrar un registro
Un miembro SHALL poder corregir o borrar un pago, un gasto, un ingreso recibido o un aporte de su hogar, de un mes no cerrado:
- **corregir** cambia el monto (mayor que cero), la cuenta de origen o destino y la nota (los gastos);
- **borrar** lo quita.

Las reglas son las del dominio compartido:
- un pago borrado deja su ítem otra vez por pagar;
- un ingreso recibido borrado deja su línea otra vez por recibir;
- un aporte borrado quita también su ítem de diezmo si este no tiene pagos; si ya tiene pagos, el ítem queda sin enlace;
- el saldo estimado de una cuenta sigue lo que queda registrado después de su último cuadre: corregir o borrar un registro que ya está incluido en un cuadre MUST NOT cambiar el saldo de esa cuenta;
- el pago de la cuota de un crédito y un abono registran cuánto bajó el saldo del crédito (`capital`); al borrarlo, el saldo del crédito MUST subir ese monto. Uno registrado antes de este cambio, sin `capital`, se borra sin tocar el saldo del crédito;
- el monto del pago de una cuota de crédito MUST NOT corregirse: se borra y se marca otra vez.

Un registro de otro hogar o inexistente MUST responder 404 `REGISTRO_NO_ENCONTRADO`. Las transferencias, los ajustes de cuadre, los abonos y las entregas de diezmo de antes MUST NOT corregirse ni borrarse por aquí (400 `DATOS_INVALIDOS`).

#### Scenario: Borrar un gasto equivocado
- **WHEN** octubre tiene el gasto "Farmacia" por $95.000 que no era de este hogar, y se borra
- **THEN** el gasto ya no está, y Pagado y "Te queda libre" de octubre vuelven a como estaban

#### Scenario: Corregir el monto de un pago
- **WHEN** Internet se marcó pagado por $210.000 en vez de $120.000 desde Davivienda, y se corrige a $120.000
- **THEN** el pago queda en $120.000 y el saldo estimado de Davivienda sube $90.000

#### Scenario: Borrar el pago de una cuota
- **WHEN** se pagó "Cuota libre inversión" por $500.000 y bajó el saldo del crédito $272.000, y se borra ese pago
- **THEN** la cuota vuelve a Por pagar y el saldo del crédito sube $272.000

#### Scenario: Registro ya cuadrado
- **WHEN** el pago de Arriendo desde Davivienda quedó incluido en un cuadre de Davivienda, y se borra
- **THEN** el pago se borra y el saldo de Davivienda no cambia

### Requirement: Un ingreso fijo editado actualiza los meses abiertos
Cuando un miembro cambia el neto o el bruto de su ingreso fijo en Ajustes, las líneas `FIJO` enlazadas a ese ingreso en las opciones de los planes no cerrados del mes en curso en adelante SHALL actualizarse al valor nuevo, si todavía tenían el valor anterior y no se han recibido en su mes. Sus ítems de diezmo se recalculan según "El diezmo sigue a su línea de ingreso" (spec `steward-plan-mes`). Las líneas que se habían cambiado a mano y los meses anteriores MUST NOT cambiar.

#### Scenario: Aumento de salario
- **WHEN** octubre (Activo, sin recibir) y noviembre tienen "Salario Daniel" con $4.800.000 neto y $5.100.000 bruto, y Daniel cambia en Ajustes el neto a $5.200.000 y el bruto a $5.500.000
- **THEN** las dos líneas pasan a $5.200.000 neto y $5.500.000 bruto, y sus diezmos (10 % del bruto) a $550.000

#### Scenario: Una línea cambiada a mano
- **WHEN** en la Opción B de noviembre "Salario Daniel" estaba en $6.000.000, y Daniel cambia su salario en Ajustes
- **THEN** la línea de la Opción B sigue en $6.000.000
