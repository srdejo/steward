## MODIFIED Requirements

### Requirement: Cuentas, cuadre y créditos
Cuentas SHALL listar las cuentas con su titular (Daniel, Esposa o Conjunta) y su saldo estimado con "≈" y "cuadrada hace N días", con un filtro por titular. Debajo SHALL listar los créditos. Una cuenta sin cuadrar desde hace más de 30 días MUST mostrar un aviso suave. "+ Agregar" crea una cuenta y "Mover dinero" registra una transferencia entre dos cuentas.

Desde 1024 px de ancho, Cuentas SHALL usar el ancho del escritorio:
- arriba, "Saldo del hogar · estimado", "Mover dinero" y "+ Cuenta";
- pestañas Cuentas, Tarjetas y Créditos. Tarjetas y Créditos MUST llevar a la lista de créditos;
- "Cuadrar cuentas" como tabla, con una fila por cuenta: nombre, titular, "La app estima", un campo "El banco dice", la diferencia ("Cuadra" si es igual) y el último cuadre. Tiene el filtro por titular, "Se guardan como gastos sin registrar: $X" y "Guardar saldos", con las mismas reglas de "Cuadrar todas". Al guardar, la página se queda en Cuentas con los saldos nuevos;
- "Movimientos recientes" de todas las cuentas, del más reciente al más antiguo, con fecha, qué fue, quién, cuenta y monto con signo, y un filtro por cuenta. Tocar uno MUST abrir la hoja para corregirlo si es corregible (spec "Movimientos de una cuenta"); si no, su cuenta;
- al lado, la tarjeta de Créditos con lo que se debe y "Ver créditos ›".

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
