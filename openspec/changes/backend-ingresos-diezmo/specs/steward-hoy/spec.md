## MODIFIED Requirements

### Requirement: Diezmo al recibir
Marcar como recibido un ingreso fijo con regla de diezmo, o registrar un aporte con "Aplicar diezmo" activo, SHALL crear una obligación de diezmo igual al porcentaje por la base de la regla. Hoy MUST mostrarla en la tarjeta "Disponible para diezmar", con el botón "Entregado". Según el ajuste "Diezmo en Hoy" se muestra una tarjeta por ingreso (Separado) o una sola (Agrupado). Entregar MUST registrar el movimiento y quitar la tarjeta.

En modo conectado:
- "Recibí" en un ingreso fijo y "Entregado" MUST registrarse en el backend;
- los ingresos fijos, su estado ("Por recibir" o recibido) y las obligaciones de diezmo de los ingresos fijos MUST venir del backend, de modo que los dos miembros ven lo mismo;
- si el backend responde que el ingreso ya se recibió este mes, Hoy MUST mostrar el mensaje y quedar con el ingreso como recibido;
- los aportes, también los que aplican diezmo, siguen con el adaptador de prueba hasta que tengan backend.

#### Scenario: Salario recibido
- **WHEN** Salario Daniel (bruto $7.000.000, diezmo 10 % del bruto) se marca recibido
- **THEN** aparece "Disponible para diezmar $700.000 · 10% de Salario Daniel"

#### Scenario: Entregado
- **WHEN** en esa tarjeta se toca "Entregado"
- **THEN** la tarjeta desaparece y queda un movimiento de diezmo entregado por $700.000

#### Scenario: El otro miembro lo ve
- **WHEN** en modo conectado Daniel marca recibido su salario y Esposa abre Hoy
- **THEN** Esposa ve "Salario Daniel" como recibido y la tarjeta "Disponible para diezmar $700.000"
