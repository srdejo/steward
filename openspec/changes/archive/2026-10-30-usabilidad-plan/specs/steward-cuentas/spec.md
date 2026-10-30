## ADDED Requirements

### Requirement: Movimientos de una cuenta
Tocar una cuenta SHALL mostrar su detalle:
- el saldo del último cuadre y su fecha;
- los movimientos registrados después, del más reciente al más antiguo, con fecha, qué fue ("Arriendo", "Aporte Esposa", "Mover a Efectivo", "Gastos sin registrar"), quién y el monto con su signo;
- el saldo estimado que resulta.

Tocar un pago, gasto, ingreso recibido o aporte de la lista SHALL abrir su hoja para corregirlo o borrarlo (spec `steward-hoy`, "Abrir un registro para corregirlo"). Los demás movimientos son de solo lectura.

#### Scenario: De dónde sale el saldo
- **WHEN** Davivienda se cuadró en $4.000.000 el 1 oct y después se pagó Arriendo por $1.500.000 desde ella
- **THEN** su detalle muestra "Cuadre 1 oct $4.000.000", "Arriendo −$1.500.000" y "≈ $2.500.000"
