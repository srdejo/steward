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
El detalle de un crédito SHALL mostrar saldo, entidad, porcentaje pagado del total original, cuotas restantes, cuota, tasa (EM), día de pago y los últimos pagos, con "Actualizar saldo" y "Registrar abono". "Registrar abono" MUST pedir el monto y desde dónde sale (una cuenta del hogar, "Su cuenta" o ninguna). El simulador de abono extra MUST estimar las cuotas y los intereses ahorrados al escribir un monto. "Probarlo como opción de {mes}" SHALL crear un escenario nuevo en ese mes con el abono incluido, si ese mes sigue en Borrador; si no, MUST mostrar que el mes ya está en curso.

En modo conectado, el crédito, "Actualizar saldo", "Registrar abono" y "Probarlo como opción de {mes}" son del backend.

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
En Cuentas, la sección Créditos SHALL tener "+ Agregar", que abre una hoja con nombre, entidad, saldo, total original, cuota, tasa (EM) y día de pago. Guardar MUST crear el crédito con esos datos y, si el mes en curso tiene plan y no está cerrado, agregar su cuota a la Opción A de ese mes, en Créditos y enlazada al crédito. El botón de guardar MUST quedar deshabilitado mientras falte el nombre, el saldo, la cuota o el día de pago. Funciona igual en modo demo y en modo conectado.

#### Scenario: Agregar y verlo en el plan
- **WHEN** con el plan de octubre activo se agrega "Libre inversión" con saldo $14.250.000, total $20.000.000, cuota $500.000, 1,6 % EM y día 15
- **THEN** Cuentas lista "Libre inversión" con 29 % pagado, y Hoy muestra "Cuota libre inversión" por $500.000 entre lo pendiente de octubre

#### Scenario: Datos incompletos
- **WHEN** en la hoja falta la cuota
- **THEN** el botón de guardar está deshabilitado

### Requirement: Cuentas, cuadre y créditos
Cuentas SHALL listar las cuentas con su titular (Daniel, Esposa o Conjunta) y su saldo estimado con "≈" y "cuadrada hace N días", con un filtro por titular. Debajo SHALL listar los créditos. Una cuenta sin cuadrar desde hace más de 30 días MUST mostrar un aviso suave. "+ Agregar" crea una cuenta y "Mover dinero" registra una transferencia entre dos cuentas.

En modo conectado:
- las cuentas y los créditos MUST venir del backend;
- "+ Agregar" MUST crear la cuenta allí, a nombre del usuario o conjunta;
- "Cuadrar cuentas" y "Mover dinero" MUST guardar en el backend, y los dos miembros MUST ver los mismos saldos estimados;
- los créditos de prueba MUST NOT verse: sin créditos reales, la sección dice "Sin créditos.".

#### Scenario: Filtro por titular
- **WHEN** en Cuentas se filtra por Esposa
- **THEN** solo se ve Ahorros Esposa

#### Scenario: Cuenta sin cuadrar
- **WHEN** hoy es 26 oct y Ahorros Esposa no se cuadra desde el 20 sep
- **THEN** su fila muestra "sin cuadrar desde 20 sep" y su saldo con "≈"

#### Scenario: Agregar en modo conectado
- **WHEN** en modo conectado Daniel agrega "Nu" con $300.000 a su nombre
- **THEN** el backend tiene la cuenta, y Esposa la ve en Cuentas con titular Daniel y "≈ $300.000"

#### Scenario: Cuadrar en modo conectado
- **WHEN** en modo conectado Daniel cuadra Davivienda en $3.900.000 y estimaba ≈ $3.950.000
- **THEN** Esposa ve Davivienda con $3.900.000 y "cuadrada hoy", y el Cierre del mes muestra $50.000 en "Sin registrar"

#### Scenario: Mover dinero en modo conectado
- **WHEN** en modo conectado Esposa mueve $100.000 de Davivienda a Efectivo
- **THEN** los dos ven Davivienda $100.000 más baja y Efectivo $100.000 más alta
