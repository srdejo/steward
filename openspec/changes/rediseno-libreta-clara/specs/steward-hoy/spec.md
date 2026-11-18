## ADDED Requirements

### Requirement: Agregar desde un solo botón
El botón **+** de la barra inferior (móvil) y el botón **Agregar** del menú lateral (web) SHALL abrir una sola hoja "Agregar" desde cualquier pantalla, con tres pestañas: **Gasto**, **Aporte** y **Pago**. Por defecto MUST abrirse en Gasto, salvo que se llegue desde "+ Aporte" (pestaña Aporte) o desde un ítem de Por pagar (pestaña Pago con ese ítem elegido).

Cada pestaña MUST pedir el monto primero y aplicar las mismas reglas que el registro que reemplaza ("Registrar un gasto", "Registrar un aporte", "Marcar un pago"). La pestaña Pago MUST listar lo pendiente de Por pagar para elegir el ítem. Guardar MUST cerrar la hoja y dejar Hoy actualizado.

Los registros MUST guardarse en el mes en curso, salvo el aporte, que mantiene su "¿Para qué mes?". Si la hoja se abre desde otra pantalla, guardar MUST dejar al usuario en esa pantalla.

#### Scenario: Gasto desde el +
- **WHEN** en Planear a 390 px se toca + y se registra un gasto de $40.000 contra Mercado (llevaba $180.000 de $320.000)
- **THEN** la hoja se cierra, se sigue en Planear y Hoy muestra Mercado con "llevas $220.000 de $320.000"

#### Scenario: Aporte desde Entró este mes
- **WHEN** en Hoy se toca "+ Aporte"
- **THEN** se abre Agregar en la pestaña Aporte

#### Scenario: Pago desde Por pagar
- **WHEN** en Hoy se toca Mastercard en Por pagar
- **THEN** se abre Agregar en la pestaña Pago con Mastercard elegida y el valor del plan prellenado

#### Scenario: Agregar en web
- **WHEN** a 1280 px se toca Agregar en el menú lateral
- **THEN** se abre la misma hoja con las pestañas Gasto, Aporte y Pago

## MODIFIED Requirements

### Requirement: Resumen del mes en Hoy
Hoy SHALL mostrar el mes elegido en su selector (spec "Elegir el mes en Hoy"), que por defecto es el mes en curso:
- una tarjeta destacada con "Te queda libre en {mes}" como cifra principal, una barra de Pagado frente a lo que falta, las cifras **Pagado** y **Falta pagar**, y Vs. plan como frase ("Gastaron $62.000 menos que el plan"). Vs. plan es la diferencia acumulada. Falta pagar es la suma de lo pendiente de cada ítem de Por pagar (lo que le falta a un variable para su presupuesto, el plan completo de un fijo sin pagar) y MUST verse destacada con el color de alerta cuando es mayor que cero;
- Ingresos ("Entró este mes"): las líneas de ingreso de la opción en uso (spec `steward-plan-mes`, "Ingresos de la opción"), recibidas o "Por recibir", y los aportes agrupados por persona con su conteo (`2 aportes · 1 pago directo`). Si el mes no tiene plan, los ingresos fijos activos de Ajustes;
- Por pagar, con el conteo de pendientes junto al título;
- Ya pagado, plegable, con plan vs. real y el avatar de quien pagó.

Por pagar MUST agrupar sus ítems por cuándo:
- **Vencido**: los que tienen fecha antes de hoy y no se pagaron, con su título y su detalle en el color de vencido;
- **Esta semana**: los que vencen de hoy a 6 días después;
- **Durante el mes**: los que vencen más adelante y los que no tienen fecha (variables, diezmo).

Cada ítem MUST llevar a la izquierda un bloque con el día y el mes de su fecha ("—" si no tiene). Un ítem de diezmo MUST ir en "Durante el mes" (spec "Diezmo sin vencimiento"). Un grupo sin ítems MUST NOT mostrarse.

Con más de 3 ítems en Por pagar, Hoy MUST mostrar los 3 primeros en el orden de los grupos y una fila "Ver N más · M pendientes en total" con la suma de los ocultos. Tocarla MUST mostrar la lista completa. El total de Falta pagar siempre cuenta todos los ítems, se vean o no.

Una línea por recibir MUST contar con su monto en "Te queda libre"; una recibida, con lo que realmente llegó. "Recibí" MUST abrir el monto de la línea para confirmarlo o cambiarlo antes de guardar. Un gasto variable MUST mostrar lo acumulado contra su presupuesto (`llevas $180.000 de $320.000`).

En modo conectado:
- "Recibí" MUST registrarse en el backend, y los dos miembros ven las mismas líneas y su estado;
- si el backend responde que el ingreso ya se recibió este mes, Hoy MUST mostrar el mensaje y quedar con el ingreso como recibido.

#### Scenario: Datos de ejemplo
- **WHEN** se abre Hoy con los datos de prueba iniciales
- **THEN** muestra "Te queda libre en octubre $3.436.000", "Falta pagar $2.715.000", "Pagado $2.613.000" y "Gastaron $62.000 menos que el plan", y el título "Por pagar" con "4 pendientes"

#### Scenario: Lista corta de Por pagar
- **WHEN** se abre Hoy el 26 oct con los datos de prueba iniciales (4 ítems por pagar)
- **THEN** Por pagar muestra Compra a cuotas bajo "Vencido", Tarjeta Mastercard bajo "Esta semana" y Diezmo · Salario Daniel bajo "Durante el mes", y la fila "Ver 1 más · 4 pendientes en total $140.000"; al tocarla aparece Mercado bajo "Durante el mes"

#### Scenario: Grupo vacío
- **WHEN** no hay ningún ítem vencido
- **THEN** Por pagar no muestra el grupo "Vencido"

#### Scenario: Falta pagar baja al pagar
- **WHEN** se marca pagada la Tarjeta Mastercard por $1.500.000
- **THEN** Falta pagar pasa de $2.715.000 a $1.215.000, Pagado sube $1.500.000 y la barra de Pagado avanza

#### Scenario: Nada pendiente
- **WHEN** todos los ítems del plan del mes están pagados
- **THEN** Falta pagar muestra $0 sin color de alerta y Por pagar dice "Todo pagado este mes."

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
La pestaña **Aporte** de Agregar (spec "Agregar desde un solo botón"), a la que también lleva "+ Aporte" en "Entró este mes", SHALL pedir cuánto primero, y luego quién (Daniel/Esposa), para qué mes (este o el siguiente), cuenta destino opcional y "Aplicar diezmo". "Aplicar diezmo" MUST empezar marcado según el "aplica a aportes" de la regla de quien aporta. Guardar MUST sumar al "Te queda libre" del mes elegido al instante, y con "Aplicar diezmo" MUST agregar al plan de ese mes el ítem "Diezmo · aporte {fecha corta}" (spec `steward-plan-mes`, "Ítems de diezmo"), que aparece en Por pagar.

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

### Requirement: Registrar un gasto
La pestaña **Gasto** de Agregar (spec "Agregar desde un solo botón") SHALL pedir el monto primero, y luego a qué ítem del plan va o "No estaba planeado", nota, quién pagó y desde qué cuenta. Al elegir un ítem variable MUST mostrar lo que lleva contra su presupuesto. Un gasto contra un ítem variable MUST acumularse contra su presupuesto. Un gasto no planeado MUST sumarse a Pagado y restar de "Te queda libre".

En modo conectado, el gasto MUST registrarse en el backend.

#### Scenario: Gasto variable
- **WHEN** se registra $40.000 contra Mercado (llevaba $180.000 de $320.000)
- **THEN** Mercado muestra "llevas $220.000 de $320.000"

#### Scenario: Criterio de cierre de la Etapa 4
- **WHEN** en modo conectado, con el plan de octubre activo, se marca pagado Internet por $100.000 (plan $120.000), se registra un aporte de $500.000 y un gasto no planeado de $85.000
- **THEN** "Vs. plan" baja $20.000 por Internet y sube $85.000 por el gasto, y "Te queda libre" sube $500.000 por el aporte y baja $85.000 por el gasto, y los dos miembros ven las mismas cifras
