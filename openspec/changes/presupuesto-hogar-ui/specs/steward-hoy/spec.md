# Spec Delta

## Purpose

Define la ejecución del mes en curso: la pantalla Hoy y los tres registros rápidos (aporte, pago y gasto), con las reglas de diezmo y de aporte implícito del handoff.

## ADDED Requirements

### Requirement: Resumen del mes en Hoy
Hoy SHALL mostrar solo el mes en curso:
- "Te queda libre" y las cifras Plan, Pagado y Vs. plan (diferencia acumulada; el ahorro en color positivo);
- Ingresos: los fijos recibidos o "Por recibir", y los aportes agrupados por persona con su conteo (`2 aportes · 1 pago directo`);
- Por pagar, con el vencimiento;
- Ya pagado, con plan vs. real y el avatar de quien pagó.

Un gasto variable MUST mostrar lo acumulado contra su presupuesto (`llevas $180.000 de $320.000`).

#### Scenario: Datos de ejemplo
- **WHEN** se abre Hoy con los datos de prueba iniciales
- **THEN** muestra "Te queda libre $3.436.000", "Plan $5.390.000", "Pagado $2.613.000" y "Vs. plan −$62.000" (el artboard dice Pagado $2.890.000, pero no es coherente con su propio plan; ver design D3)

#### Scenario: Plan vs. real en un pago
- **WHEN** Recibo Luz tiene plan $50.000 y se pagó $38.000
- **THEN** su fila en Ya pagado muestra "plan $50.000 · −$12.000" y el monto $38.000

### Requirement: Diezmo al recibir
Marcar como recibido un ingreso fijo con regla de diezmo, o registrar un aporte con "Aplicar diezmo" activo, SHALL crear una obligación de diezmo igual al porcentaje por la base de la regla. Hoy MUST mostrarla en la tarjeta "Disponible para diezmar", con el botón "Entregado". Según el ajuste "Diezmo en Hoy" se muestra una tarjeta por ingreso (Separado) o una sola (Agrupado). Entregar MUST registrar el movimiento y quitar la tarjeta.

#### Scenario: Salario recibido
- **WHEN** Salario Daniel (bruto $7.000.000, diezmo 10 % del bruto) se marca recibido
- **THEN** aparece "Disponible para diezmar $700.000 · 10% de Salario Daniel"

#### Scenario: Entregado
- **WHEN** en esa tarjeta se toca "Entregado"
- **THEN** la tarjeta desaparece y queda un movimiento de diezmo entregado por $700.000

### Requirement: Registrar un aporte
"+ Aporte" SHALL abrir una hoja con quién (Daniel/Esposa), cuánto, para qué mes (este o el siguiente), cuenta destino opcional y "Aplicar diezmo". Guardar MUST sumar al "Te queda libre" del mes elegido al instante.

#### Scenario: Aporte para el mes siguiente
- **WHEN** se registra un aporte de Esposa por $500.000 para noviembre
- **THEN** el "Te queda libre" de octubre no cambia y el plan de noviembre muestra el aporte

### Requirement: Marcar un pago
Tocar un ítem de Por pagar SHALL abrir Marcar pago con el valor prellenado con el plan, quién pagó y desde qué cuenta (opcional, incluida "Su cuenta"). Un pago desde una cuenta externa ("Su cuenta") MUST contar además como aporte implícito de quien pagó en ese mes. Si el ítem ya estaba pagado, MUST avisar "Ya lo pagó {nombre} el {dd mmm}" en lugar de registrarlo otra vez.

#### Scenario: Pago directo
- **WHEN** Esposa marca pagada la Tarjeta Mastercard por $1.500.000 desde "Su cuenta"
- **THEN** la tarjeta pasa a Ya pagado con el avatar E, y Aportes Esposa sube $1.500.000 y suma un pago directo

#### Scenario: Pago duplicado
- **WHEN** se intenta marcar Recibo Luz, que ya pagó Esposa el 12 oct
- **THEN** se muestra "Ya lo pagó Esposa el 12 oct" y no se crea otro pago

### Requirement: Registrar un gasto
"+ Gasto" SHALL abrir una hoja con monto, a qué ítem del plan va o "No estaba planeado", nota, quién pagó y desde qué cuenta. Un gasto contra un ítem variable MUST acumularse contra su presupuesto. Un gasto no planeado MUST sumarse a Pagado y restar de "Te queda libre".

#### Scenario: Gasto variable
- **WHEN** se registra $40.000 contra Mercado (llevaba $180.000 de $320.000)
- **THEN** Mercado muestra "llevas $220.000 de $320.000"
