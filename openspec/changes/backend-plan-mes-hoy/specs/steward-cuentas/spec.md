## MODIFIED Requirements

### Requirement: Detalle de crédito con simulador
El detalle de un crédito SHALL mostrar saldo, entidad, porcentaje pagado del total original, cuotas restantes, cuota, tasa (EM), día de pago y los últimos pagos, con "Actualizar saldo" y "Registrar abono". El simulador de abono extra MUST estimar las cuotas y los intereses ahorrados al escribir un monto. "Probarlo como opción de {mes}" SHALL crear un escenario nuevo en ese mes con el abono incluido.

En modo conectado, los créditos siguen con el adaptador de prueba hasta la Etapa 5, y "Probarlo como opción de {mes}" MUST mostrar que llega en una próxima versión, sin crear opciones, porque el plan del mes ya es real y solo tiene la Opción A.

#### Scenario: Simular abono
- **WHEN** en el crédito de $14.250.000 al 1,6 % EM con cuota $500.000 se simula un abono de $2.000.000
- **THEN** se muestra un estimado (≈) de cuotas y de intereses ahorrados, calculado con la tasa y la cuota del crédito

#### Scenario: Probarlo como opción
- **WHEN** se toca "Probarlo como opción de noviembre"
- **THEN** noviembre gana una opción nueva con el abono en Créditos, y se abre el mes en borrador

#### Scenario: Probarlo en modo conectado
- **WHEN** en modo conectado se toca "Probarlo como opción de noviembre"
- **THEN** se ve que llega en una próxima versión y noviembre sigue con solo la Opción A
