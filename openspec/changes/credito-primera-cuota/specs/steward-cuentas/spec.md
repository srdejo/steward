## ADDED Requirements

### Requirement: Primera cuota de un crédito
Cada crédito SHALL poder tener una **primera cuota** (mes y año). Sin ella, la primera cuota MUST seguir siendo la del mes en curso, o la del siguiente si la de este mes ya se pagó, como hasta ahora.

Mientras el mes en curso sea anterior a la primera cuota:
- las cuotas proyectadas MUST empezar en ese mes: "Próxima cuota", "Próximas cuotas", la proyección "Cuánto deberían al final de cada mes", "Deberán al cerrar {año}", "Intereses en {año siguiente}" y "Termina";
- el crédito MUST NOT pagar cuota en los meses anteriores para el plan anual ni para crear el plan de un mes (spec `steward-plan-mes`, "Crear el plan de un mes").

Desde el mes de la primera cuota, el campo MUST NOT cambiar nada: el crédito sigue la regla de siempre.

El selector ofrece el mes en curso y los 12 siguientes; el mes en curso guarda el crédito sin primera cuota. Un crédito con una primera cuota ya pasada la muestra como el mes en curso. En modo conectado, el crédito la envía al crear (`POST /api/creditos`) y al cambiar el método (`PUT /api/creditos/{id}/metodo`) como `primeraCuota` ("2026-12"); el mes en curso la quita, y sin el campo, crear la deja vacía y cambiar el método conserva la que había. La lectura la devuelve igual, o null. Un mes anterior al en curso o a más de 12 meses MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Detalle antes de la primera cuota
- **WHEN** hoy es 20 nov 2026 y "Johana" (saldo $192.000.000, cuota $2.000.000, 0 % EM, sin pagos) tiene "Primera cuota: diciembre 2026"
- **THEN** su detalle muestra "Próxima cuota · diciembre", "Próximas cuotas" de diciembre a mayo, el saldo proyectado a fin de noviembre sigue en $192.000.000 y "Termina" es noviembre 2034

#### Scenario: Sin primera cuota, como antes
- **WHEN** hoy es 20 nov y un crédito sin primera cuota no tiene pago este mes
- **THEN** su próxima cuota es la de noviembre

#### Scenario: El plan anual empieza en la primera cuota
- **WHEN** hoy es 20 nov 2026, "Johana" tiene "Primera cuota: febrero 2027" y se crean los meses de 2027 desde el plan anual
- **THEN** enero no trae "Cuota johana" y febrero sí

#### Scenario: Primera cuota fuera de rango
- **WHEN** en modo conectado se crea un crédito con `primeraCuota` "2026-10" y hoy es 20 nov 2026
- **THEN** responde 400 `DATOS_INVALIDOS`

## MODIFIED Requirements

### Requirement: Agregar crédito
En la pestaña Créditos, "+ Crédito" SHALL abrir "¿Cómo baja el saldo?" con tres métodos (spec "Cómo baja el saldo de un crédito") y, debajo, los datos del método elegido, además de nombre, entidad, día de pago y **"Primera cuota"** (requirement "Primera cuota de un crédito"; por defecto, el mes en curso). Guardar MUST crear el crédito y, si el mes en curso tiene plan, no está cerrado y la primera cuota no es de un mes posterior, agregar su cuota a la opción en uso de ese mes, en Créditos y enlazada al crédito. El botón de guardar MUST quedar deshabilitado mientras falte el nombre, el día de pago o un dato obligatorio del método. Funciona igual en modo demo y en modo conectado.

#### Scenario: Agregar y verlo en el plan
- **WHEN** con el plan de octubre activo se agrega "Libre inversión" con la tasa: saldo $14.250.000, total $20.000.000, cuota $500.000, 1,6 % EM y día 15
- **THEN** la pestaña Créditos lista "Libre inversión" con "Con la tasa", y Hoy muestra "Cuota libre inversión" por $500.000 entre lo pendiente de octubre

#### Scenario: Agregar con plan de pagos
- **WHEN** se agrega "Compra a cuotas" con plan de pagos: valor $4.500.000, 12 cuotas, 0 % EA, 3 pagadas, día 20
- **THEN** la cuota es $375.000, el crédito debe $3.375.000 y muestra "Cuota 4 de 12"

#### Scenario: Datos incompletos
- **WHEN** en la hoja, con la tasa, falta la cuota
- **THEN** el botón de guardar está deshabilitado

#### Scenario: Primera cuota el mes siguiente
- **WHEN** el 3 nov, con el plan de noviembre en Borrador, se agrega "Johana" con la tasa (saldo $192.000.000, cuota $2.000.000, 0 % EM, día 1) y "Primera cuota: diciembre 2026"
- **THEN** el plan de noviembre no trae "Cuota johana", y Hoy no la muestra entre lo pendiente de noviembre

### Requirement: Cómo baja el saldo de un crédito
Cada crédito SHALL tener uno de tres métodos, y se MUST poder cambiar desde su detalle ("Cambiar"):
- **Con la tasa de interés:** saldo, tasa, cuota y día de pago. La tasa MUST poderse escribir efectiva mensual (EM) o efectiva anual (EA); una EA se convierte a EM con EM = (1 + EA)^(1/12) − 1. Al marcar la cuota pagada, el saldo baja en la cuota menos el interés del mes (saldo × EM). La hoja MUST mostrar cuántas cuotas faltan y cuándo termina ≈.
- **Con el plan de pagos:** valor financiado, número de cuotas, tasa efectiva anual (0 % = sin intereses), cuotas ya pagadas y día de pago. La cuota MUST calcularse como una cuota fija (sistema francés) con la EM equivalente, redondeada al peso; con 0 %, es el valor dividido entre el número de cuotas. Al pagar la cuota *k*, el saldo MUST quedar en el de la tabla después de *k* cuotas, y el crédito muestra "Cuota {k+1} de {n}". La tabla es aproximada: lo dice la hoja ("Calculado con la tasa; corrígelo con el extracto si no coincide").
- **Lo actualizo a mano:** saldo, cuota y día de pago. Pagar la cuota MUST NOT cambiar el saldo. Si el día de pago del mes ya pasó y el saldo no se actualizó desde entonces, el crédito MUST mostrar "Actualiza el saldo con el extracto".

Los créditos que ya existían quedan **con la tasa**. "Corregir con extracto" sirve en los tres métodos. La hoja de "Cambiar" MUST mostrar también "Primera cuota" y permitir cambiarla (requirement "Primera cuota de un crédito").

#### Scenario: Tasa efectiva anual
- **WHEN** al agregar un crédito con la tasa se escribe 12 % EA
- **THEN** se guarda con 0,95 % EM

#### Scenario: Plan de pagos con intereses
- **WHEN** se agrega un plan de pagos de $5.000.000 en 24 cuotas al 24 % EA
- **THEN** la cuota es la cuota fija de $5.000.000 a 24 meses con la EM equivalente al 24 % EA, y la suma de capital de las 24 cuotas de la tabla es $5.000.000

#### Scenario: Pagar una cuota del plan de pagos
- **WHEN** en "Compra a cuotas" (12 de $375.000, sin intereses, 3 pagadas) se marca pagada la cuota de octubre
- **THEN** el crédito debe $3.000.000 y muestra "Cuota 5 de 12"

#### Scenario: A mano
- **WHEN** un crédito a mano con día de pago 10 tiene el saldo actualizado el 5 oct, y hoy es 26 oct
- **THEN** muestra "Actualiza el saldo con el extracto", y pagar su cuota no cambia el saldo

#### Scenario: Corregir la primera cuota
- **WHEN** hoy es 20 nov y en "Cambiar" de "Johana" (sin pagos) se elige "Primera cuota: diciembre 2026" y se guarda
- **THEN** el saldo, la cuota y el método no cambian, y el detalle muestra "Próxima cuota · diciembre"
