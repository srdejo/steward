# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
