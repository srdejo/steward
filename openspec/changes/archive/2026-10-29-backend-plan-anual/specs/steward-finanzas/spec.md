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
