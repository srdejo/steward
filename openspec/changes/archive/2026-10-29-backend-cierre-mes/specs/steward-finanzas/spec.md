## ADDED Requirements

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

## MODIFIED Requirements

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
