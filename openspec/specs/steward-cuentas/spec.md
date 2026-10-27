# steward-cuentas Specification

## Purpose

Define las cuentas del hogar con su saldo estimado, el cuadre contra el banco y los créditos con su simulador de abono extra.

## Requirements

### Requirement: Cuentas y créditos
Cuentas SHALL listar las cuentas con su titular (Daniel, Esposa o Conjunta) y su saldo estimado con "≈" y "cuadrada hace N días", con un filtro por titular. Debajo SHALL listar los créditos. Una cuenta sin cuadrar desde hace más de 30 días MUST mostrar un aviso suave. "+ Agregar" crea una cuenta y "Mover dinero" registra una transferencia entre dos cuentas.

#### Scenario: Filtro por titular
- **WHEN** en Cuentas se filtra por Esposa
- **THEN** solo se ve Ahorros Esposa

#### Scenario: Cuenta sin cuadrar
- **WHEN** hoy es 26 oct y Ahorros Esposa no se cuadra desde el 20 sep
- **THEN** su fila muestra "sin cuadrar desde 20 sep" y su saldo con "≈"

### Requirement: Cuadrar todas
Cuadrar SHALL mostrar un campo por cuenta para escribir lo que dice el banco. Guardar MUST registrar la diferencia contra el saldo estimado como un ajuste ("Gastos sin registrar"), sin pedir explicación, y poner en cero los días sin cuadrar. Las cuentas que se dejan en blanco MUST NOT cambiar.

#### Scenario: Diferencia
- **WHEN** Davivienda estima ≈ $4.150.000 y se escribe $3.980.000, y Efectivo estima ≈ $200.000 y se escribe $150.000
- **THEN** la pantalla muestra "Gastos sin registrar $220.000" antes de guardar
- **AND** al guardar, los saldos quedan en $3.980.000 y $150.000, se crean ajustes por $170.000 y $50.000, y el Cierre del mes muestra $220.000 en "Sin registrar"

### Requirement: Detalle de crédito con simulador
El detalle de un crédito SHALL mostrar saldo, entidad, porcentaje pagado del total original, cuotas restantes, cuota, tasa (EM), día de pago y los últimos pagos, con "Actualizar saldo" y "Registrar abono". El simulador de abono extra MUST estimar las cuotas y los intereses ahorrados al escribir un monto. "Probarlo como opción de {mes}" SHALL crear un escenario nuevo en ese mes con el abono incluido.

#### Scenario: Simular abono
- **WHEN** en el crédito de $14.250.000 al 1,6 % EM con cuota $500.000 se simula un abono de $2.000.000
- **THEN** se muestra un estimado (≈) de cuotas y de intereses ahorrados, calculado con la tasa y la cuota del crédito

#### Scenario: Probarlo como opción
- **WHEN** se toca "Probarlo como opción de noviembre"
- **THEN** noviembre gana una opción nueva con el abono en Créditos, y se abre el mes en borrador
