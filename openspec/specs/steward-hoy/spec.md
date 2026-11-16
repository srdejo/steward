# steward-hoy Specification

## Purpose

Define la ejecución del mes en curso: la pantalla Hoy y los tres registros rápidos (aporte, pago y gasto), con las reglas de diezmo y de aporte implícito del handoff.

## Requirements

### Requirement: Resumen del mes en Hoy
Hoy SHALL mostrar el mes elegido en su selector (spec "Elegir el mes en Hoy"), que por defecto es el mes en curso:
- "Te queda libre" y las cifras **Falta pagar**, Pagado y Vs. plan. Vs. plan es la diferencia acumulada, con el ahorro en color positivo. Falta pagar es la suma de lo pendiente de cada ítem de Por pagar (lo que le falta a un variable para su presupuesto, el plan completo de un fijo sin pagar) y MUST verse destacada con el color de alerta cuando es mayor que cero;
- Ingresos: las líneas de ingreso de la opción en uso (spec `steward-plan-mes`, "Ingresos de la opción"), recibidas o "Por recibir", y los aportes agrupados por persona con su conteo (`2 aportes · 1 pago directo`). Si el mes no tiene plan, los ingresos fijos activos de Ajustes;
- Por pagar, con el vencimiento y con el total de Falta pagar junto al título;
- Ya pagado, con plan vs. real y el avatar de quien pagó.

Con más de 3 ítems en Por pagar, Hoy MUST mostrar los 3 primeros (ordenados por vencimiento) y una fila "Ver N más · M pendientes en total" con la suma de los ocultos. Tocarla MUST mostrar la lista completa. El total de Falta pagar siempre cuenta todos los ítems, se vean o no.

Una línea por recibir MUST contar con su monto en "Te queda libre"; una recibida, con lo que realmente llegó. "Recibí" MUST abrir el monto de la línea para confirmarlo o cambiarlo antes de guardar. Un gasto variable MUST mostrar lo acumulado contra su presupuesto (`llevas $180.000 de $320.000`).

En modo conectado:
- "Recibí" MUST registrarse en el backend, y los dos miembros ven las mismas líneas y su estado;
- si el backend responde que el ingreso ya se recibió este mes, Hoy MUST mostrar el mensaje y quedar con el ingreso como recibido.

#### Scenario: Datos de ejemplo
- **WHEN** se abre Hoy con los datos de prueba iniciales
- **THEN** muestra "Te queda libre $3.436.000", "Falta pagar $2.715.000", "Pagado $2.613.000" y "Vs. plan −$62.000", y el encabezado "Por pagar $2.715.000"

#### Scenario: Lista corta de Por pagar
- **WHEN** se abre Hoy con los datos de prueba iniciales (4 ítems por pagar)
- **THEN** Por pagar muestra Compra a cuotas, Diezmo · Salario Daniel y Tarjeta Mastercard, y la fila "Ver 1 más · 4 pendientes en total $140.000"; al tocarla aparece Mercado

#### Scenario: Falta pagar baja al pagar
- **WHEN** se marca pagada la Tarjeta Mastercard por $1.500.000
- **THEN** Falta pagar pasa de $2.715.000 a $1.215.000 y Pagado sube $1.500.000

#### Scenario: Nada pendiente
- **WHEN** todos los ítems del plan del mes están pagados
- **THEN** Falta pagar muestra $0 sin color de alerta y Por pagar dice que no hay nada pendiente

#### Scenario: Plan vs. real en un pago
- **WHEN** Recibo Luz tiene plan $50.000 y se pagó $38.000
- **THEN** su fila en Ya pagado muestra "plan $50.000 · −$12.000" y el monto $38.000

#### Scenario: Recibir con otro monto
- **WHEN** "Salario Daniel" está por recibir con $6.288.000 y se toca "Recibí", se cambia a $6.350.000 y se guarda
- **THEN** la línea queda recibida con $6.350.000 y "Te queda libre" sube $62.000

#### Scenario: Ingreso editado en el plan
- **WHEN** en la opción en uso de octubre la línea "Salario Daniel" está en $6.500.000 y todavía no se recibe
- **THEN** Hoy la muestra por recibir con $6.500.000, y "Te queda libre" la cuenta así

### Requirement: Registrar un aporte
"+ Aporte" SHALL abrir una hoja con quién (Daniel/Esposa), cuánto, para qué mes (este o el siguiente), cuenta destino opcional y "Aplicar diezmo". "Aplicar diezmo" MUST empezar marcado según el "aplica a aportes" de la regla de quien aporta. Guardar MUST sumar al "Te queda libre" del mes elegido al instante, y con "Aplicar diezmo" MUST agregar al plan de ese mes el ítem "Diezmo · aporte {fecha corta}" (spec `steward-plan-mes`, "Ítems de diezmo"), que aparece en Por pagar.

En modo conectado, el aporte MUST registrarse en el backend, y el otro miembro SHALL verlo al abrir la app.

#### Scenario: Aporte para el mes siguiente
- **WHEN** se registra un aporte de Esposa por $500.000 para noviembre
- **THEN** el "Te queda libre" de octubre no cambia y el plan de noviembre muestra el aporte

#### Scenario: Aporte en modo conectado
- **WHEN** en modo conectado Esposa registra un aporte de $500.000 para octubre y Daniel abre Hoy
- **THEN** Daniel ve "Aportes Esposa" con esos $500.000, y su "Te queda libre" sube $500.000

#### Scenario: Aporte con diezmo
- **WHEN** Daniel, con 10 %, registra el 26 oct un aporte de $2.000.000 para octubre con "Aplicar diezmo"
- **THEN** Por pagar muestra "Diezmo · aporte 26 oct" por $200.000, y "Te queda libre" sube $1.800.000

### Requirement: Marcar un pago
Tocar un ítem de Por pagar SHALL abrir Marcar pago con el valor prellenado con el plan, quién pagó y desde qué cuenta (opcional, incluida "Su cuenta"). Un pago desde una cuenta externa ("Su cuenta") MUST contar además como aporte implícito de quien pagó en ese mes. Si el ítem ya estaba pagado, MUST avisar "Ya lo pagó {nombre} el {dd mmm}" en lugar de registrarlo otra vez, con acceso a abrir ese pago para corregirlo o borrarlo.

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

### Requirement: Diezmo como gasto en Hoy
Los ítems de diezmo del mes SHALL verse en Hoy como cualquier gasto del plan: en Por pagar mientras no se marquen, y en Ya pagado con plan vs. real y el avatar de quien pagó. Tocar uno MUST abrir Marcar pago, con las mismas reglas que los demás ítems. Hoy MUST NOT sumar el diezmo aparte: el plan, lo pagado y "Te queda libre" lo cuentan solo a través de sus ítems.

Las entregas de diezmo registradas antes de este cambio MUST seguir contando en lo pagado de su mes, como un gasto sin ítem.

En modo conectado, el pago de un ítem de diezmo MUST registrarse en el backend, y el otro miembro SHALL verlo pagado al abrir la app.

#### Scenario: Diezmo por pagar
- **WHEN** octubre tiene "Diezmo · Salario Daniel" por $700.000 sin pagar
- **THEN** Hoy lo muestra en Por pagar, y el Plan del mes incluye esos $700.000 una sola vez

#### Scenario: Llevar el diezmo
- **WHEN** Daniel toca "Diezmo · Salario Daniel", deja $700.000 y elige Davivienda
- **THEN** el ítem pasa a Ya pagado con el avatar D, Pagado sube $700.000 y "Te queda libre" no cambia

#### Scenario: Recibir no crea tarjeta
- **WHEN** se marca recibido "Salario Daniel"
- **THEN** Hoy no muestra ninguna tarjeta "Disponible para diezmar"; el diezmo sigue como ítem en Por pagar

### Requirement: Abrir un registro para corregirlo
En Hoy, tocar un ítem de Ya pagado, un gasto "No estaba planeado", una línea de ingreso ya recibida o los aportes de una persona SHALL abrir una hoja con lo registrado (fecha, quién, cuánto, desde o hacia qué cuenta y la nota). Desde ahí MUST poder:
- **"Guardar"** un monto, una cuenta o una nota corregidos;
- **"Borrar este registro"**, con una confirmación que diga qué pasa: "Internet vuelve a Por pagar", "El saldo de Davivienda sube $120.000" o "Ya está en el cuadre de Davivienda: su saldo no cambia".

Un ítem con varios gastos (variable) o una persona con varios aportes MUST mostrar la lista de sus registros, cada uno con su corrección. Para la cuota de un crédito, la hoja MUST explicar que para cambiar el monto hay que borrar el pago y marcarlo otra vez.

En modo conectado, la corrección y el borrado MUST guardarse en el backend, y el otro miembro SHALL verlos al abrir la app.

#### Scenario: Borrar un gasto equivocado desde Hoy
- **WHEN** Hoy muestra "Farmacia (error)" por $95.000 en "No estaba planeado", se toca, y se confirma "Borrar este registro"
- **THEN** el gasto desaparece de Ya pagado, Pagado baja $95.000 y "Te queda libre" sube $95.000

#### Scenario: Corregir un pago
- **WHEN** se toca Internet en Ya pagado, pagado por $210.000, y se guarda con $120.000
- **THEN** Internet sigue en Ya pagado con $120.000 y "igual al plan"

#### Scenario: Deshacer un "Recibí"
- **WHEN** se tocó "Recibí" en "Salario Daniel" por error, se abre y se borra
- **THEN** "Salario Daniel" vuelve a "Por recibir"

### Requirement: Diezmo sin vencimiento
Un ítem de diezmo en Por pagar SHALL mostrar de dónde viene y cuándo llega su ingreso ("Del Salario Daniel · día 25", "Del aporte del 26 oct"), sin "Venció" ni color de alerta, porque no es una factura.

#### Scenario: Diezmo del salario
- **WHEN** hoy es 30 oct y "Diezmo · Salario Daniel" (día 25) está por pagar
- **THEN** Por pagar lo muestra con "Del Salario Daniel · día 25", sin rojo

### Requirement: Elegir el mes en Hoy
Hoy SHALL ofrecer un selector con el mes en curso y el siguiente. Lo que se registra desde Hoy ("Recibí", marcar un pago, un gasto y un aporte) MUST quedar en el mes elegido, con la fecha real de hoy. Cuando el mes elegido no es el mes en curso, cada hoja MUST decir "Se registra en {mes}".

El mes elegido se recuerda en el dispositivo y es de cada persona. Si el mes recordado ya no es el mes en curso ni el siguiente, Hoy MUST volver al mes en curso.

El mes siguiente se ejecuta con su opción principal y sigue en Borrador hasta que llegue. Si tiene varias opciones y ninguna elegida, Hoy MUST mostrar "Opción {letra} · elige otra en Planear". Si no tiene plan, Hoy MUST mostrar "Este mes no tiene plan" con el acceso a planearlo.

#### Scenario: Recibir el salario para noviembre
- **WHEN** hoy es 30 oct, se elige noviembre en Hoy y se toca "Recibí" en "Salario Daniel"
- **THEN** el ingreso queda en noviembre con fecha 30 oct, noviembre lo muestra recibido y octubre no cambia

#### Scenario: Pagar en noviembre
- **WHEN** hoy es 30 oct, se elige noviembre y se marca pagado Internet desde Davivienda
- **THEN** Internet pasa a Ya pagado en noviembre, en octubre no cambia nada, y el saldo estimado de Davivienda baja hoy

#### Scenario: Otro miembro lo ve
- **WHEN** Daniel registra un gasto en noviembre y Esposa elige noviembre en Hoy
- **THEN** Esposa ve ese gasto en noviembre

#### Scenario: Cambia el mes
- **WHEN** Daniel dejó elegido noviembre y abre Hoy en enero
- **THEN** Hoy muestra enero

### Requirement: Hoy detallado en escritorio
Desde 1024 px de ancho, la PWA SHALL mostrar Hoy en la vista detallada del diseño `HoyWeb.dc.html`, con las mismas cifras y reglas que la vista de una columna. Por debajo de 1024 px, y en la app móvil, Hoy MUST seguir en una columna.

La vista detallada MUST tener:
- **Encabezado:**
  - el mes, con botones de mes anterior y siguiente que solo recorren los meses que ofrece el selector de Hoy;
  - los botones "+ Aporte" y "+ Gasto".
- **Cuatro tarjetas con subtítulo:**
  - Te queda libre: "de {total de ingresos del mes} que entran este mes".
  - Falta pagar: "{N} pendientes · {K} vencidos", o solo "{N} pendientes" si nada venció.
  - Pagado: "{N} pagos · {P}% de lo planeado", con P redondeado hacia abajo.
  - Vs. plan: "gastaste menos de lo planeado", "gastaste más de lo planeado" o "igual al plan".
- **Tabla Por pagar**, con todos los pendientes (sin lista corta):
  - Gasto, con su detalle debajo;
  - Categoría, con su color;
  - Vence;
  - Falta;
  - un botón "Marcar pagado" que abre la misma hoja que tocar la fila en una columna.

  La columna Vence:
  - de un ítem vencido: "Venció el {día}", en rojo;
  - de uno que vence en 7 días o menos: la fecha y "en N días", en ámbar;
  - de un variable: "Durante el mes";
  - de un diezmo: de dónde viene, sin color de alerta (spec "Diezmo sin vencimiento").
- **Tabla Ya pagado:**
  - Gasto;
  - Plan;
  - Real;
  - Dif. (real − plan; "—" cuando son iguales);
  - Quién (avatar de quien pagó);
  - Desde (el nombre de la cuenta de origen, o "Su cuenta" para un pago externo).

  Los gastos no planeados MUST aparecer en esta tabla con Plan "—". Tocar una fila MUST abrir el registro, como en una columna.
- **Columna lateral:**
  - Ingresos, con las mismas líneas y acciones ("Recibí", abrir un registro) que en una columna;
  - Por categoría: cada categoría con ítems en el plan del mes, con "real / plan" y una barra de avance que llega como máximo al 100 %;
  - Cuentas: cada cuenta con su saldo y su estado de cuadre, tal como los muestra Cuentas, y un enlace a Cuadrar.

Un ítem cuenta como **vencido** si:
- no está pagado;
- tiene día de vencimiento;
- el mes elegido es el mes en curso y ese día ya pasó.

Los ítems de diezmo y los variables MUST NOT contar como vencidos.

#### Scenario: Escritorio con los datos de ejemplo
- **WHEN** la PWA se abre a 1280 px con los datos de prueba iniciales
- **THEN** se ven las cuatro tarjetas:
  - "Te queda libre $3.436.000 · de $8.826.000 que entran este mes";
  - "Falta pagar $2.715.000 · 4 pendientes · 1 vencido";
  - "Pagado $2.613.000 · … · 48% de lo planeado";
  - "Vs. plan −$62.000 · gastaste menos de lo planeado".

  La tabla Por pagar tiene las 4 filas, sin "Ver más".

#### Scenario: Ítem vencido
- **WHEN** hoy es 26 oct y la Compra a cuotas vence el día 20 sin pagar
- **THEN** su columna Vence dice "Venció el 20" en rojo y cuenta en "1 vencido"

#### Scenario: De qué cuenta salió
- **WHEN** Pensión se pagó desde Davivienda y Recibo Luz con un pago externo de Esposa
- **THEN** en Ya pagado la columna Desde dice "Davivienda" para Pensión y "Su cuenta" para Recibo Luz, con el avatar de quien pagó

#### Scenario: Avance por categoría
- **WHEN** Gastos fijos tiene $795.000 en el plan y $733.000 pagados
- **THEN** Por categoría muestra "Gastos fijos $733.000 / $795.000" con la barra al 92 %

#### Scenario: Marcar pagado desde la tabla
- **WHEN** en escritorio se toca "Marcar pagado" en la Tarjeta Mastercard
- **THEN** se abre la hoja Marcar pago de ese ítem, y al guardar la fila pasa a la tabla Ya pagado y Falta pagar baja

#### Scenario: Ventana angosta
- **WHEN** la PWA se abre a 800 px de ancho
- **THEN** Hoy se ve en una columna, con la lista corta de Por pagar, igual que en el móvil

#### Scenario: Flechas del mes
- **WHEN** en escritorio el mes elegido es el mes en curso
- **THEN** la flecha de mes siguiente lleva al mes siguiente y la de mes anterior está deshabilitada

### Requirement: Cerrar el mes desde Hoy
Desde 1024 px de ancho, cuando Hoy muestra el mes en curso y ese mes no está cerrado, SHALL mostrar "Cerrar {mes}" junto a las acciones del encabezado. Al tocarlo MUST abrir el Cierre de ese mes (spec `steward-planear`, "Cierre de mes"). Si Hoy muestra otro mes, o el mes ya está cerrado, el botón MUST NOT verse.

#### Scenario: Cerrar octubre desde Hoy
- **WHEN** hoy es 26 oct, a 1280 px Hoy muestra octubre y se toca "Cerrar octubre"
- **THEN** se abre el Cierre de octubre

#### Scenario: Mes siguiente en Hoy
- **WHEN** a 1280 px se elige noviembre en el selector de mes de Hoy
- **THEN** no se ve "Cerrar noviembre"
