## ADDED Requirements

### Requirement: Qué se avisa
El sistema SHALL calcular, para el hogar y para una fecha de hoy, los avisos de estos tipos:
- **Pagos y recibos**: cada ítem fijo del plan del mes en uso con día de pago y sin pagar;
- **Tarjetas**: el día de pago de cada tarjeta con valor por pagar en el ciclo, y su día de corte;
- **Cuotas de créditos**: la cuota del mes de cada crédito, con su número ("Cuota 4 de 12");
- **Ingresos esperados**: cada línea de ingreso por recibir en su día ("¿Llegó el salario?");
- **Plan del mes**: elegir la opción del mes siguiente antes de que empiece, si tiene más de una y ninguna en uso, y cerrar el mes en su último día;
- **Cuadrar cuentas**: cada cuenta sin cuadrar hace más de 30 días.

Un ítem pagado, un ingreso recibido, un mes con opción elegida o cerrado y una cuenta cuadrada MUST dejar de avisarse en cuanto eso pasa. Los ítems variables y los de diezmo MUST NOT avisarse: no tienen fecha de pago (spec `steward-hoy`, "Diezmo sin vencimiento").

#### Scenario: Pago de una tarjeta
- **WHEN** hoy es lunes 26 oct y la tarjeta Nu · Mercado paga el 28 con $320.000 por pagar
- **THEN** el cálculo incluye "Nu · Mercado" para el 28 oct con $320.000 y el tipo Tarjetas

#### Scenario: Ya pagado
- **WHEN** Mastercard (paga el 30) se marca pagada el 27 oct
- **THEN** desde ese momento ningún cálculo la incluye para octubre

#### Scenario: Variable sin aviso
- **WHEN** Mercado es un ítem variable del plan
- **THEN** no aparece en ningún aviso

#### Scenario: Cuenta sin cuadrar
- **WHEN** Ahorros Esposa se cuadró por última vez el 20 sep y hoy es 26 oct
- **THEN** el cálculo incluye "Cuadrar Ahorros Esposa" con "Sin cuadrar desde el 20 sep"

### Requirement: Cuándo se avisa
Cada persona SHALL recibir el aviso de una fecha en estos momentos, siempre a las 8:00 (hora de Colombia):
- el **lunes** de la semana de la fecha, con todos los pagos de esa semana (lunes a domingo);
- el **día anterior**;
- el **mismo día**, si todavía no se ha pagado.

Un pago ya marcado MUST NOT avisarse en los momentos que faltan. Lo vencido MUST NOT enviarse por push: se ve en Avisos y en Hoy. Los avisos de una persona para el mismo momento MUST llegar en uno solo, con el conteo y la suma ("Esta semana: 3 pagos · $2.195.000"); si el lunes es también el día anterior o el día de un pago, ese pago va en el mismo aviso del lunes. Durante su horario de no molestar (por defecto de 9:00 p. m. a 7:00 a. m.), un aviso MUST esperar al final del horario. Un mismo aviso (persona, fecha, ítem y momento) MUST NOT enviarse dos veces, aunque el programador corra de nuevo o el servidor se reinicie.

"Recordar mañana" en un aviso MUST posponer ese ítem para esa persona al día siguiente a las 8:00, sin cambiar los demás.

#### Scenario: El lunes, el día anterior y el mismo día
- **WHEN** Mastercard paga el viernes 30 oct y nadie la marca
- **THEN** a Daniel le llega el aviso de la semana el lunes 26 oct a las 8:00 (con Mastercard), el de Mastercard el jueves 29 a las 8:00 y otra vez el viernes 30 a las 8:00, y el sábado 31 no le llega nada

#### Scenario: Ya pagado antes del día
- **WHEN** Mastercard se marca pagada el jueves 29 oct a las 10:00
- **THEN** el viernes 30 no le llega el aviso de Mastercard

#### Scenario: El aviso del lunes
- **WHEN** es lunes 2 nov a las 8:00 y esa semana vencen Pensión (5 nov, $550.000), Visa · Gasolina (6 nov, $800.000) y Celular (8 nov, $50.000)
- **THEN** a Daniel le llega un solo aviso "Esta semana: 3 pagos · $1.400.000" que los nombra

#### Scenario: No molestar
- **WHEN** Esposa marca un pago a las 10:00 p. m. y Daniel tiene no molestar de 9:00 p. m. a 7:00 a. m.
- **THEN** el aviso le llega a Daniel a las 7:00 a. m.

#### Scenario: Sin repetir
- **WHEN** el programador corre dos veces el 29 oct a las 8:00
- **THEN** Daniel recibe el aviso de Mastercard una sola vez

#### Scenario: Recordar mañana
- **WHEN** Daniel toca "Recordar mañana" en el aviso de Nu · Mercado el 26 oct
- **THEN** el 27 oct a las 8:00 le llega otra vez el de Nu · Mercado, y a Esposa no le cambia nada

### Requirement: Avisos · Próximos
La pantalla Avisos SHALL abrirse en la pestaña **Próximos**, con lo que viene en los próximos 30 días y lo vencido, agrupado en:
- **Vencido**, en el color de vencido;
- **Próximos 7 días**;
- **Más adelante**;
- **Para no olvidar**: cuadrar cuentas.

Cada fila MUST mostrar el bloque de fecha, el nombre, el detalle ("En 2 días · valor del extracto", "Cuota 4 de 12 · hace 6 días") y el valor si lo tiene. Los cortes de tarjeta MUST verse distintos de los pagos.

Un pago MUST tener el botón para marcarlo pagado. Marcarlo MUST abrir Marcar pago (spec `steward-hoy`), con su valor y su aviso de duplicado, y al guardar desaparecer de Avisos y quedar pagado en Hoy. Un aviso que no es un pago (cerrar el mes, elegir opción, cuadrar, ingreso esperado) MUST llevar a su pantalla. La lista se calcula con las mismas reglas que el backend (requisito "Qué se avisa").

#### Scenario: Próximos el 26 oct
- **WHEN** se abre Avisos el lunes 26 oct con los datos del canvas
- **THEN** se ven:
  - en Vencido, Compra a cuotas;
  - en Próximos 7 días, Nu · Mercado (28), Mastercard (30), Cerrar octubre (31) y Elegir opción de noviembre (1 nov);
  - en Más adelante, Pensión (5 nov), entre otros;
  - en Para no olvidar, Cuadrar Ahorros Esposa

#### Scenario: Marcar pagado desde Avisos
- **WHEN** en Avisos se marca pagada Nu · Mercado por $320.000
- **THEN** desaparece de Avisos y Hoy la muestra en Ya pagado

#### Scenario: Ir a cerrar el mes
- **WHEN** se toca "Cerrar octubre"
- **THEN** se abre el cierre de octubre

### Requirement: Avisos · Configurar
La pestaña **Configurar** SHALL mostrar y guardar la configuración de quien la abre:
- el texto "Te aviso el lunes con los pagos de la semana, el día anterior y el mismo día si no se ha pagado, a las 8:00.";
- un interruptor por tipo: Pagos y recibos, Tarjetas, Cuotas de créditos, Ingresos esperados, Plan del mes, Cuadrar cuentas y "Lo que marque {otro miembro}";
- "Notificaciones en este celular" (o "en este navegador"), con su estado, el botón para activarlas y "Probar";
- "Resumen por correo" (lunes 7:30, pagos de la semana), sí o no;
- "No molestar", sí o no, de 9:00 p. m. a 7:00 a. m.

La configuración MUST ser de cada persona y guardarse en el backend: lo que cambia Daniel MUST NOT cambiar la de Esposa. Por defecto, para alguien que nunca la abrió: todos los tipos activos, correo sí y no molestar sí. Ajustes MUST tener una fila "Avisos" con el resumen ("El lunes, el día anterior y el mismo día") que abre esta pestaña.

#### Scenario: Cuándo avisa
- **WHEN** Daniel abre Configurar
- **THEN** lee "Te aviso el lunes con los pagos de la semana, el día anterior y el mismo día si no se ha pagado, a las 8:00."

#### Scenario: Apagar un tipo
- **WHEN** Esposa apaga Tarjetas
- **THEN** a Esposa no le llegan avisos de tarjetas y a Daniel sí

#### Scenario: Probar
- **WHEN** con las notificaciones activadas se toca "Probar"
- **THEN** a ese dispositivo le llega un aviso de prueba en segundos

### Requirement: Campana en Hoy
El encabezado de Hoy SHALL tener una campana que abre Avisos. Mientras haya avisos vencidos o de los próximos 7 días, MUST mostrar su número en una insignia, con `aria-label` "Avisos · N pendientes". En web, la campana MUST estar en la barra superior, junto a Agregar.

#### Scenario: Tres pendientes
- **WHEN** hay 1 vencido y 2 pagos en los próximos 7 días
- **THEN** la campana muestra 3

#### Scenario: Nada pendiente
- **WHEN** no hay vencidos ni nada en 7 días
- **THEN** la campana no muestra insignia

### Requirement: Push en la app
La app SHALL pedir permiso de notificaciones cuando se activan en Configurar, no al abrirla. Con el permiso, MUST registrar su token de push en el backend para el usuario, y quitarlo al cerrar sesión o al eliminar la cuenta.

El aviso de un solo pago MUST tener las acciones **"Ya lo pagué"** y **"Recordar mañana"**:
- "Ya lo pagué" MUST registrar el pago con el valor del plan, quien toca la acción como quien pagó y sin cuenta, igual que un pago marcado en Hoy;
- si ya estaba pagado, la acción MUST NOT crear otro pago.

Tocar el aviso MUST abrir Avisos; tocar uno de lo que marcó el otro miembro MUST abrir Hoy.

#### Scenario: Ya lo pagué desde el aviso
- **WHEN** a Daniel le llega "Nu · Mercado vence en 2 días · $320.000" y toca "Ya lo pagué" sin abrir la app
- **THEN** Nu · Mercado queda pagada por $320.000 con el avatar D, y en Hoy de los dos aparece en Ya pagado

#### Scenario: Ya lo había pagado el otro
- **WHEN** Esposa ya pagó Nu · Mercado y Daniel toca "Ya lo pagué" en un aviso anterior
- **THEN** no se crea otro pago

#### Scenario: Cerrar sesión
- **WHEN** Daniel cierra sesión en el iPhone
- **THEN** ese iPhone deja de recibir sus avisos

### Requirement: Push en la PWA
La PWA SHALL ofrecer activar las notificaciones del navegador con Web Push. La suscripción MUST registrarse en el backend para el usuario y quitarse al cerrar sesión. Los avisos MUST tener el mismo texto que en la app. "Ya lo pagué" y "Recordar mañana" MUST aparecer como acciones donde el navegador las soporte.

En un iPhone con la PWA en Safari sin agregar a la pantalla de inicio, Configurar MUST decir "En iPhone los avisos llegan si la app está agregada a la pantalla de inicio" en lugar del botón para activar. Si el navegador no soporta push, MUST decirlo.

#### Scenario: Activar en el computador
- **WHEN** en Chrome a 1280 px se activan las notificaciones y se toca "Probar"
- **THEN** llega un aviso de prueba de Presupuesto Hogar

#### Scenario: Safari sin instalar
- **WHEN** se abre Configurar en Safari de iPhone sin la PWA instalada
- **THEN** se ve el texto de la pantalla de inicio y no el botón para activar

### Requirement: Resumen por correo
Cada lunes a las 7:30 (hora de Colombia), el sistema SHALL enviar a cada persona con "Resumen por correo" activo un correo con:
- los pagos de esa semana (lunes a domingo), con fecha, nombre y valor;
- lo vencido;
- el total.

Si no hay nada, MUST NOT enviarlo. El correo MUST salir por la API `contact` del workspace, con un enlace a Avisos, y MUST respetar los tipos apagados de la persona.

#### Scenario: Lunes 26 oct
- **WHEN** Daniel tiene el resumen activo y es lunes 26 oct a las 7:30
- **THEN** le llega un correo con Compra a cuotas (vencida), Nu · Mercado (28 oct) y Mastercard (30 oct), y el total $2.195.000

#### Scenario: Semana sin pagos
- **WHEN** no hay pagos ni vencidos en la semana
- **THEN** no se envía el correo

### Requirement: Lo que marca el otro miembro
Cuando un miembro registra un pago o un aporte, el sistema SHALL avisar al otro miembro del hogar, si tiene activo "Lo que marque {nombre}". El texto debe ser "{nombre} pagó {ítem}" o "{nombre} registró un aporte", con el valor y, si fue desde su cuenta, "cuenta como aporte". Quien lo registró MUST NOT recibir ese aviso.

#### Scenario: Esposa paga la luz
- **WHEN** Esposa marca pagado Recibo Luz por $38.000 desde "Su cuenta"
- **THEN** a Daniel le llega "Esposa pagó Recibo Luz · $38.000 desde su cuenta · cuenta como aporte", y a Esposa no

### Requirement: API de avisos
El backend SHALL exponer, para el usuario con sesión y solo sobre su hogar:
- registrar y quitar un dispositivo (token de Expo o suscripción Web Push);
- leer y guardar su configuración;
- los próximos avisos;
- enviar un aviso de prueba;
- marcar pagado y posponer desde una acción de aviso.

Cada acción de aviso MUST llevar un identificador firmado por el backend con la persona, el hogar, el ítem, el mes y la acción. Es válido por 7 días, para que la acción funcione sin abrir la app ni tener sesión. Un identificador alterado o vencido MUST NOT registrar nada. Un dispositivo que el servicio de push reporta como inválido MUST quitarse.

#### Scenario: Identificador alterado
- **WHEN** se cambia el ítem dentro del identificador de un aviso de Nu · Mercado para que apunte a otro ítem u otro hogar
- **THEN** la firma no coincide, responde 404 y no registra nada

#### Scenario: Identificador vencido
- **WHEN** se toca "Ya lo pagué" en un aviso de hace 8 días
- **THEN** no se registra el pago y, al abrir la app, Avisos muestra el ítem para marcarlo ahí

#### Scenario: Token inválido
- **WHEN** Expo responde que el token de un iPhone ya no es válido
- **THEN** el backend quita ese dispositivo y no vuelve a enviarle
