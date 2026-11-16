# steward-cuentas Specification

## Purpose

Define las cuentas del hogar con su saldo estimado, el cuadre contra el banco y los créditos con su simulador de abono extra.

## Requirements

### Requirement: Cuadrar todas
Cuadrar SHALL mostrar un campo por cuenta para escribir lo que dice el banco. Guardar MUST registrar la diferencia contra el saldo estimado como un ajuste ("Gastos sin registrar"), sin pedir explicación, y poner en cero los días sin cuadrar. Las cuentas que se dejan en blanco MUST NOT cambiar.

#### Scenario: Diferencia
- **WHEN** Davivienda estima ≈ $4.150.000 y se escribe $3.980.000, y Efectivo estima ≈ $200.000 y se escribe $150.000
- **THEN** la pantalla muestra "Gastos sin registrar $220.000" antes de guardar
- **AND** al guardar, los saldos quedan en $3.980.000 y $150.000, se crean ajustes por $170.000 y $50.000, y el Cierre del mes muestra $220.000 en "Sin registrar"

### Requirement: Detalle de crédito con simulador
El detalle de un crédito SHALL mostrar:
- saldo, entidad y cómo baja el saldo (el método), con "Cambiar";
- el progreso de cuotas ("Cuota 23 de 60 · 22 pagadas · faltan 38") cuando se conoce;
- cuota, día de pago y cuándo termina (≈ mes y año);
- los últimos pagos;
- con la tasa o con el plan de pagos, la **próxima cuota** con lo que va a capital y a intereses, y **"Próximas cuotas"**: las 6 siguientes, con interés, capital y lo que queda; debajo, "En {año siguiente} pagarías $X en intereses".

Tiene "Corregir con extracto" y "Registrar abono". "Corregir con extracto" MUST pedir el saldo que dice el extracto y dejarlo como saldo del crédito con la fecha de hoy; la proyección sigue desde ahí. "Registrar abono" MUST pedir el monto y desde dónde sale (una cuenta del hogar, "Su cuenta" o ninguna). El simulador de abono extra MUST estimar las cuotas y los intereses ahorrados al escribir un monto. "Probarlo como opción de {mes}" SHALL crear un escenario nuevo en ese mes con el abono incluido, si ese mes sigue en Borrador; si no, MUST mostrar que el mes ya está en curso.

En modo conectado, el crédito, "Corregir con extracto", "Registrar abono", el cambio de método y "Probarlo como opción de {mes}" son del backend.

#### Scenario: Próxima cuota con la tasa
- **WHEN** se abre "Libre inversión" con saldo $14.250.000 al 1,6 % EM y cuota $500.000
- **THEN** la próxima cuota muestra "$272.000 a capital" y "$228.000 intereses", y en Próximas cuotas la primera fila queda en $13.978.000

#### Scenario: Corregir con extracto
- **WHEN** el extracto de "Libre inversión" dice $13.900.000 y se corrige
- **THEN** el saldo queda en $13.900.000, "Saldo actualizado" con la fecha de hoy, y las próximas cuotas se calculan desde $13.900.000

#### Scenario: Simular abono
- **WHEN** en el crédito de $14.250.000 al 1,6 % EM con cuota $500.000 se simula un abono de $2.000.000
- **THEN** se muestra un estimado (≈) de cuotas y de intereses ahorrados, calculado con la tasa y la cuota del crédito

#### Scenario: Probarlo como opción
- **WHEN** se toca "Probarlo como opción de noviembre"
- **THEN** noviembre gana una opción nueva con el abono en Créditos, y se abre el mes en borrador

#### Scenario: Probarlo en modo conectado
- **WHEN** en modo conectado Daniel toca "Probarlo como opción de noviembre" con un abono de $2.000.000
- **THEN** se abre noviembre con una opción nueva que trae "Abono extra libre inversión" por $2.000.000, y Esposa también la ve

#### Scenario: Abono en modo conectado
- **WHEN** en modo conectado Daniel registra un abono de $2.000.000 desde Davivienda a "Libre inversión" ($14.250.000)
- **THEN** los dos ven el saldo en $12.250.000, el abono en los últimos pagos y Davivienda $2.000.000 más baja

### Requirement: Agregar crédito
En la pestaña Créditos, "+ Crédito" SHALL abrir "¿Cómo baja el saldo?" con tres métodos (spec "Cómo baja el saldo de un crédito") y, debajo, los datos del método elegido, además de nombre, entidad y día de pago. Guardar MUST crear el crédito y, si el mes en curso tiene plan y no está cerrado, agregar su cuota a la opción en uso de ese mes, en Créditos y enlazada al crédito. El botón de guardar MUST quedar deshabilitado mientras falte el nombre, el día de pago o un dato obligatorio del método. Funciona igual en modo demo y en modo conectado.

#### Scenario: Agregar y verlo en el plan
- **WHEN** con el plan de octubre activo se agrega "Libre inversión" con la tasa: saldo $14.250.000, total $20.000.000, cuota $500.000, 1,6 % EM y día 15
- **THEN** la pestaña Créditos lista "Libre inversión" con "Con la tasa", y Hoy muestra "Cuota libre inversión" por $500.000 entre lo pendiente de octubre

#### Scenario: Agregar con plan de pagos
- **WHEN** se agrega "Compra a cuotas" con plan de pagos: valor $4.500.000, 12 cuotas, 0 % EA, 3 pagadas, día 20
- **THEN** la cuota es $375.000, el crédito debe $3.375.000 y muestra "Cuota 4 de 12"

#### Scenario: Datos incompletos
- **WHEN** en la hoja, con la tasa, falta la cuota
- **THEN** el botón de guardar está deshabilitado

### Requirement: Cuentas, cuadre y créditos
Cuentas SHALL tener tres pestañas: **Cuentas**, **Tarjetas** (spec `steward-tarjetas`) y **Créditos** (spec "Proyección de créditos"). La pestaña Tarjetas MUST mostrar al lado de su nombre "Pago en N días" cuando una tarjeta se paga en 3 días o menos.

La pestaña Cuentas SHALL listar las cuentas con su titular (Daniel, Esposa o Conjunta) y su saldo estimado con "≈" y "cuadrada hace N días", con un filtro por titular. Una cuenta sin cuadrar desde hace más de 30 días MUST mostrar un aviso suave. "+ Agregar" crea una cuenta y "Mover dinero" registra una transferencia entre dos cuentas.

Desde 1024 px de ancho, Cuentas SHALL usar el ancho del escritorio:
- arriba, "Saldo del hogar · estimado", "Mover dinero" y "+ Cuenta";
- "Cuadrar cuentas" como tabla, con una fila por cuenta: nombre, titular, "La app estima", un campo "El banco dice", la diferencia ("Cuadra" si es igual) y el último cuadre. Tiene el filtro por titular, "Se guardan como gastos sin registrar: $X" y "Guardar saldos", con las mismas reglas de "Cuadrar todas". Al guardar, la página se queda en Cuentas con los saldos nuevos;
- "Movimientos recientes" de todas las cuentas, del más reciente al más antiguo, con fecha, qué fue, quién, cuenta y monto con signo, y un filtro por cuenta. Tocar uno MUST abrir la hoja para corregirlo si es corregible (spec "Movimientos de una cuenta"); si no, su cuenta;
- al lado, una tarjeta resumen de Tarjetas (el próximo pago y en cuántos días) y una de Créditos (lo que se debe), cada una con su enlace a la pestaña.

En modo conectado:
- las cuentas, las tarjetas y los créditos MUST venir del backend;
- "+ Agregar" MUST crear la cuenta allí, a nombre del usuario o conjunta;
- "Cuadrar cuentas" y "Mover dinero" MUST guardar en el backend, y los dos miembros MUST ver los mismos saldos estimados;
- los créditos de prueba MUST NOT verse: sin créditos reales, la pestaña Créditos dice "Sin créditos.".

#### Scenario: Filtro por titular
- **WHEN** en Cuentas se filtra por Esposa
- **THEN** solo se ve Ahorros Esposa

#### Scenario: Cuenta sin cuadrar
- **WHEN** hoy es 26 oct y Ahorros Esposa no se cuadra desde el 20 sep
- **THEN** su fila muestra "sin cuadrar desde 20 sep" y su saldo con "≈"

#### Scenario: Aviso en la pestaña Tarjetas
- **WHEN** hoy es 26 oct y Nu se paga el 28
- **THEN** la pestaña Tarjetas muestra "Pago en 2 días"

#### Scenario: Cuadrar en la tabla de escritorio
- **WHEN** a 1280 px, en la fila de Davivienda que estima ≈ $4.150.000 se escribe $3.980.000, en Efectivo (≈ $200.000) se escribe $150.000 y se toca "Guardar saldos"
- **THEN** antes de guardar se ven "−$170.000" y "−$50.000" en Diferencia y "gastos sin registrar: $220.000"; después, la página sigue en Cuentas y las filas muestran $3.980.000 y $150.000

#### Scenario: Movimientos recientes
- **WHEN** a 1280 px se abre Cuentas y se pagó Arriendo desde Davivienda
- **THEN** "Movimientos recientes" muestra Arriendo con Davivienda y el monto en negativo; al filtrar por Efectivo, Arriendo no aparece

#### Scenario: Agregar en modo conectado
- **WHEN** en modo conectado Daniel agrega "Nu" con $300.000 a su nombre
- **THEN** el backend tiene la cuenta, y Esposa la ve en Cuentas con titular Daniel y "≈ $300.000"

#### Scenario: Cuadrar en modo conectado
- **WHEN** en modo conectado Daniel cuadra Davivienda en $3.900.000 y estimaba ≈ $3.950.000
- **THEN** Esposa ve Davivienda con $3.900.000 y "cuadrada hoy", y el Cierre del mes muestra $50.000 en "Sin registrar"

#### Scenario: Mover dinero en modo conectado
- **WHEN** en modo conectado Esposa mueve $100.000 de Davivienda a Efectivo
- **THEN** los dos ven Davivienda $100.000 más baja y Efectivo $100.000 más alta

### Requirement: Movimientos de una cuenta
Tocar una cuenta SHALL mostrar su detalle:
- el saldo del último cuadre y su fecha;
- los movimientos registrados después, del más reciente al más antiguo, con fecha, qué fue ("Arriendo", "Aporte Esposa", "Mover a Efectivo", "Gastos sin registrar"), quién y el monto con su signo;
- el saldo estimado que resulta.

Tocar un pago, gasto, ingreso recibido o aporte de la lista SHALL abrir su hoja para corregirlo o borrarlo (spec `steward-hoy`, "Abrir un registro para corregirlo"). Los demás movimientos son de solo lectura.

#### Scenario: De dónde sale el saldo
- **WHEN** Davivienda se cuadró en $4.000.000 el 1 oct y después se pagó Arriendo por $1.500.000 desde ella
- **THEN** su detalle muestra "Cuadre 1 oct $4.000.000", "Arriendo −$1.500.000" y "≈ $2.500.000"

### Requirement: Eliminar una cuenta
El detalle de una cuenta SHALL ofrecer "Eliminar cuenta" solo si es de quien está en la sesión o es conjunta. Se puede eliminar con cualquier saldo: el total del hogar baja en ese saldo. Antes de eliminar, una hoja MUST decir cuánto baja el total y que no se puede deshacer.
- Lo registrado con la cuenta MUST quedar en el historial, sin cuenta; los ingresos fijos que llegaban a ella quedan sin cuenta.
- En modo conectado va a `DELETE /api/cuentas/{id}` (204). Eliminar la cuenta de otro miembro MUST responder 409 con `codigo` `SOLO_TUYAS`; una cuenta inexistente o de otro hogar, 404 con `CUENTA_NO_ENCONTRADA`.

#### Scenario: Eliminar una cuenta con saldo
- **WHEN** Daniel elimina Nu, a su nombre, con ≈ $3.360.000
- **THEN** Nu ya no aparece, el total del hogar baja $3.360.000 y los pagos hechos desde Nu siguen en el historial, sin cuenta

#### Scenario: Cuenta de otro miembro
- **WHEN** Daniel abre Ahorros Esposa
- **THEN** no ve "Eliminar cuenta", y si lo intentara contra el backend recibiría 409 `SOLO_TUYAS`

### Requirement: Cómo baja el saldo de un crédito
Cada crédito SHALL tener uno de tres métodos, y se MUST poder cambiar desde su detalle ("Cambiar"):
- **Con la tasa de interés:** saldo, tasa, cuota y día de pago. La tasa MUST poderse escribir efectiva mensual (EM) o efectiva anual (EA); una EA se convierte a EM con EM = (1 + EA)^(1/12) − 1. Al marcar la cuota pagada, el saldo baja en la cuota menos el interés del mes (saldo × EM). La hoja MUST mostrar cuántas cuotas faltan y cuándo termina ≈.
- **Con el plan de pagos:** valor financiado, número de cuotas, tasa efectiva anual (0 % = sin intereses), cuotas ya pagadas y día de pago. La cuota MUST calcularse como una cuota fija (sistema francés) con la EM equivalente, redondeada al peso; con 0 %, es el valor dividido entre el número de cuotas. Al pagar la cuota *k*, el saldo MUST quedar en el de la tabla después de *k* cuotas, y el crédito muestra "Cuota {k+1} de {n}". La tabla es aproximada: lo dice la hoja ("Calculado con la tasa; corrígelo con el extracto si no coincide").
- **Lo actualizo a mano:** saldo, cuota y día de pago. Pagar la cuota MUST NOT cambiar el saldo. Si el día de pago del mes ya pasó y el saldo no se actualizó desde entonces, el crédito MUST mostrar "Actualiza el saldo con el extracto".

Los créditos que ya existían quedan **con la tasa**. "Corregir con extracto" sirve en los tres métodos.

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

### Requirement: Proyección de créditos
La pestaña Créditos SHALL mostrar:
- arriba, "Deben en créditos" (la suma de los saldos) y "+ Crédito";
- indicadores: "Pagan al mes" (la suma de las cuotas), "Deberán al cerrar {año}" (la suma proyectada a diciembre del año en curso, con "−$X desde hoy") e "Intereses en {año siguiente}" (los intereses proyectados de enero a diciembre del año siguiente);
- una tabla de créditos con nombre, entidad, método, día de pago, cuota, lo que se debe hoy y cuándo termina. Tocar uno MUST abrir su detalle (en escritorio, al lado de la tabla, con la próxima cuota y las acciones);
- "Cuánto deberían al final de cada mes": por crédito, el saldo proyectado al final del mes en curso y de los 5 siguientes, con una fila Total y sus barras.

La proyección MUST suponer que cada cuota se paga en su mes: con la tasa, amortización con su tasa y su cuota; con el plan de pagos, su tabla; a mano, el saldo no cambia. Un mes en el que el crédito ya está pagado vale $0. Si se corrige el saldo con el extracto, la proyección MUST seguir desde ese saldo.

En móvil, la pestaña muestra "Deben en créditos" y "Pagan al mes", y cada crédito como una tarjeta con su método, saldo, progreso de cuotas, la próxima cuota con capital e intereses, y "+ Agregar crédito".

#### Scenario: Proyección de los datos de prueba
- **WHEN** hoy es 26 oct y los créditos son "Libre inversión" ($14.250.000 al 1,6 % EM, cuota $500.000, ya pagada en octubre) y "Compra a cuotas" ($3.375.000, plan de pagos sin intereses, cuota $375.000 de octubre sin pagar)
- **THEN** "Deben en créditos" es $17.625.000, "Pagan al mes" es $875.000, y en la proyección Compra a cuotas queda en $3.000.000 al final de octubre y Libre inversión en $13.978.000 al final de noviembre

#### Scenario: Crédito que termina
- **WHEN** a un crédito le queda una sola cuota en noviembre
- **THEN** su saldo proyectado es $0 de noviembre en adelante y su "termina" dice nov

### Requirement: Detalle de crédito en escritorio
Desde 1024 px de ancho, el detalle de un crédito SHALL usar el ancho de escritorio, con lo mismo que en móvil, ordenado así:
- **Encabezado:** la entidad, el nombre, el saldo y su fecha. A la derecha, "Corregir con extracto" y "Registrar abono".
- **Cuatro indicadores:**
  - **Cuota:** el monto y "Día N de cada mes";
  - **Pagado:** el porcentaje, su barra, el total original y, si se sabe, "cuota N de M";
  - **Termina:** el mes (con "≈" si se calcula con la tasa) y las cuotas que faltan;
  - **Intereses en {año siguiente}:** se muestra solo si los hay.
- **Próximas cuotas:** hasta 12, cada una con su mes, una barra de capital e interés, el interés, el capital y lo que queda.
- **Últimos pagos:** cada uno con su fecha, su tipo (cuota o abono), la cuenta de donde salió y el monto.
- **Al lado:**
  - cómo baja el saldo, con "Cambiar";
  - "¿Y si abonas extra?", con "Probarlo como opción";
  - "¿Ya no lo tienen?", con "Eliminar crédito".

Por debajo de 1024 px, el detalle se ve como hoy.

#### Scenario: Libre inversión en escritorio
- **WHEN** a 1280 px se abre el crédito Libre inversión de los datos de prueba
- **THEN** se ven los indicadores Cuota "$500.000 · Día 15 de cada mes", Pagado y Termina; la tabla tiene 12 próximas cuotas; y al lado está "Eliminar crédito"

### Requirement: Eliminar un crédito
El detalle de un crédito SHALL ofrecer "Eliminar crédito", en la web y en la app. Antes de eliminarlo, una hoja MUST decir:
- que sale de Créditos;
- que su cuota sale del plan del mes en curso y de los siguientes;
- cuántos pagos registrados se conservan.

Al confirmar:
- el crédito deja de aparecer en Créditos y en "Deben en créditos";
- sus pagos y abonos MUST quedar en el historial de las cuentas, sin crédito;
- en el mes en curso y en los siguientes que no estén cerrados, los ítems enlazados al crédito sin pagos ni gastos MUST quitarse;
- los ítems con pagos, y los de meses anteriores o cerrados, se quedan sin enlace;
- al terminar, vuelve a la pestaña Créditos.

En modo conectado va a `DELETE /api/creditos/{id}`.

#### Scenario: Eliminar la compra a cuotas
- **WHEN** en octubre, con la cuota de la compra a cuotas sin pagar, Daniel elimina "Compra a cuotas"
- **THEN** ya no aparece en Créditos, "Deben en créditos" baja $3.375.000, y la Opción A de octubre y las opciones de noviembre ya no tienen "Compra a cuotas"

#### Scenario: Una cuota ya pagada se queda
- **WHEN** Daniel elimina "Libre inversión", cuya cuota de octubre ya está pagada
- **THEN** octubre conserva "Cuota libre inversión" con su pago, sin crédito; noviembre ya no tiene la cuota, y el pago sigue en el historial de Davivienda
