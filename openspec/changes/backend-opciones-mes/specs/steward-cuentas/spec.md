## MODIFIED Requirements

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
