## MODIFIED Requirements

### Requirement: Diezmo al recibir
Marcar como recibido un ingreso fijo con regla de diezmo, o registrar un aporte con "Aplicar diezmo" activo, SHALL crear una obligación de diezmo igual al porcentaje por la base de la regla. Hoy MUST mostrarla en la tarjeta "Disponible para diezmar", con el botón "Entregado". Según el ajuste "Diezmo en Hoy" se muestra una tarjeta por ingreso (Separado) o una sola (Agrupado). Entregar MUST registrar el movimiento y quitar la tarjeta.

En modo conectado:
- "Recibí" en un ingreso fijo, el aporte con diezmo y "Entregado" MUST registrarse en el backend;
- los ingresos fijos, su estado ("Por recibir" o recibido), los aportes y las obligaciones de diezmo MUST venir del backend, de modo que los dos miembros ven lo mismo;
- si el backend responde que el ingreso ya se recibió este mes, Hoy MUST mostrar el mensaje y quedar con el ingreso como recibido.

#### Scenario: Salario recibido
- **WHEN** Salario Daniel (bruto $7.000.000, diezmo 10 % del bruto) se marca recibido
- **THEN** aparece "Disponible para diezmar $700.000 · 10% de Salario Daniel"

#### Scenario: Entregado
- **WHEN** en esa tarjeta se toca "Entregado"
- **THEN** la tarjeta desaparece y queda un movimiento de diezmo entregado por $700.000

#### Scenario: El otro miembro lo ve
- **WHEN** en modo conectado Daniel marca recibido su salario y Esposa abre Hoy
- **THEN** Esposa ve "Salario Daniel" como recibido y la tarjeta "Disponible para diezmar $700.000"

### Requirement: Registrar un aporte
"+ Aporte" SHALL abrir una hoja con quién (Daniel/Esposa), cuánto, para qué mes (este o el siguiente), cuenta destino opcional y "Aplicar diezmo". Guardar MUST sumar al "Te queda libre" del mes elegido al instante.

En modo conectado, el aporte MUST registrarse en el backend, y el otro miembro SHALL verlo al abrir la app.

#### Scenario: Aporte para el mes siguiente
- **WHEN** se registra un aporte de Esposa por $500.000 para noviembre
- **THEN** el "Te queda libre" de octubre no cambia y el plan de noviembre muestra el aporte

#### Scenario: Aporte en modo conectado
- **WHEN** en modo conectado Esposa registra un aporte de $500.000 para octubre y Daniel abre Hoy
- **THEN** Daniel ve "Aportes Esposa" con esos $500.000, y su "Te queda libre" sube $500.000

### Requirement: Marcar un pago
Tocar un ítem de Por pagar SHALL abrir Marcar pago con el valor prellenado con el plan, quién pagó y desde qué cuenta (opcional, incluida "Su cuenta"). Un pago desde una cuenta externa ("Su cuenta") MUST contar además como aporte implícito de quien pagó en ese mes. Si el ítem ya estaba pagado, MUST avisar "Ya lo pagó {nombre} el {dd mmm}" en lugar de registrarlo otra vez.

En modo conectado, el pago MUST registrarse en el backend. Si otro miembro ya lo pagó, el aviso MUST venir del backend, aunque esta pantalla aún no mostrara ese pago, y Hoy SHALL quedar con el ítem en Ya pagado.

#### Scenario: Pago directo
- **WHEN** Esposa marca pagada la Tarjeta Mastercard por $1.500.000 desde "Su cuenta"
- **THEN** la tarjeta pasa a Ya pagado con el avatar E, y Aportes Esposa sube $1.500.000 y suma un pago directo

#### Scenario: Pago duplicado
- **WHEN** se intenta marcar Recibo Luz, que ya pagó Esposa el 12 oct
- **THEN** se muestra "Ya lo pagó Esposa el 12 oct" y no se crea otro pago

#### Scenario: Lo pagó el otro miembro hace un momento
- **WHEN** en modo conectado Daniel tiene Hoy abierto desde antes de que Esposa pagara Internet, y toca Internet en Por pagar y guarda
- **THEN** se muestra "Ya lo pagó Esposa el {fecha}" e Internet pasa a Ya pagado

### Requirement: Registrar un gasto
"+ Gasto" SHALL abrir una hoja con monto, a qué ítem del plan va o "No estaba planeado", nota, quién pagó y desde qué cuenta. Un gasto contra un ítem variable MUST acumularse contra su presupuesto. Un gasto no planeado MUST sumarse a Pagado y restar de "Te queda libre".

En modo conectado, el gasto MUST registrarse en el backend.

#### Scenario: Gasto variable
- **WHEN** se registra $40.000 contra Mercado (llevaba $180.000 de $320.000)
- **THEN** Mercado muestra "llevas $220.000 de $320.000"

#### Scenario: Criterio de cierre de la Etapa 4
- **WHEN** en modo conectado, con el plan de octubre activo, se marca pagado Internet por $100.000 (plan $120.000), se registra un aporte de $500.000 y un gasto no planeado de $85.000
- **THEN** "Vs. plan" baja $20.000 por Internet y sube $85.000 por el gasto, y "Te queda libre" sube $500.000 por el aporte y baja $85.000 por el gasto, y los dos miembros ven las mismas cifras
