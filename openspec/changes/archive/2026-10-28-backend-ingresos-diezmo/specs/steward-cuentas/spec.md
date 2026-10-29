## MODIFIED Requirements

### Requirement: Cuentas y créditos
Cuentas SHALL listar las cuentas con su titular (Daniel, Esposa o Conjunta) y su saldo estimado con "≈" y "cuadrada hace N días", con un filtro por titular. Debajo SHALL listar los créditos. Una cuenta sin cuadrar desde hace más de 30 días MUST mostrar un aviso suave. "+ Agregar" crea una cuenta y "Mover dinero" registra una transferencia entre dos cuentas.

En modo conectado:
- las cuentas MUST venir del backend, y "+ Agregar" MUST crearlas allí, a nombre del usuario o conjuntas;
- "Cuadrar cuentas" y "Mover dinero" MUST mostrar que llegan en una próxima versión, sin cambiar nada;
- los créditos siguen con el adaptador de prueba.

#### Scenario: Filtro por titular
- **WHEN** en Cuentas se filtra por Esposa
- **THEN** solo se ve Ahorros Esposa

#### Scenario: Cuenta sin cuadrar
- **WHEN** hoy es 26 oct y Ahorros Esposa no se cuadra desde el 20 sep
- **THEN** su fila muestra "sin cuadrar desde 20 sep" y su saldo con "≈"

#### Scenario: Agregar en modo conectado
- **WHEN** en modo conectado Daniel agrega "Nu" con $300.000 a su nombre
- **THEN** el backend tiene la cuenta, y Esposa la ve en Cuentas con titular Daniel y "≈ $300.000"

#### Scenario: Cuadrar todavía no
- **WHEN** en modo conectado se toca "Cuadrar cuentas"
- **THEN** se ve que cuadrar llega en una próxima versión y ningún saldo cambia
