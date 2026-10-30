## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Resumen del mes en Hoy
Hoy SHALL mostrar el mes elegido en su selector (spec "Elegir el mes en Hoy"), que por defecto es el mes en curso:
- "Te queda libre" y las cifras Plan, Pagado y Vs. plan (diferencia acumulada; el ahorro en color positivo);
- Ingresos: las líneas de ingreso de la opción en uso (spec `steward-plan-mes`, "Ingresos de la opción"), recibidas o "Por recibir", y los aportes agrupados por persona con su conteo (`2 aportes · 1 pago directo`). Si el mes no tiene plan, los ingresos fijos activos de Ajustes;
- Por pagar, con el vencimiento;
- Ya pagado, con plan vs. real y el avatar de quien pagó.

Una línea por recibir MUST contar con su monto en "Te queda libre"; una recibida, con lo que realmente llegó. "Recibí" MUST abrir el monto de la línea para confirmarlo o cambiarlo antes de guardar. Un gasto variable MUST mostrar lo acumulado contra su presupuesto (`llevas $180.000 de $320.000`).

En modo conectado:
- "Recibí" MUST registrarse en el backend, y los dos miembros ven las mismas líneas y su estado;
- si el backend responde que el ingreso ya se recibió este mes, Hoy MUST mostrar el mensaje y quedar con el ingreso como recibido.

#### Scenario: Datos de ejemplo
- **WHEN** se abre Hoy con los datos de prueba iniciales
- **THEN** muestra "Te queda libre $3.436.000", "Plan $5.390.000", "Pagado $2.613.000" y "Vs. plan −$62.000" (el artboard dice Pagado $2.890.000, pero no es coherente con su propio plan; ver design D3)

#### Scenario: Plan vs. real en un pago
- **WHEN** Recibo Luz tiene plan $50.000 y se pagó $38.000
- **THEN** su fila en Ya pagado muestra "plan $50.000 · −$12.000" y el monto $38.000

#### Scenario: Recibir con otro monto
- **WHEN** "Salario Daniel" está por recibir con $6.288.000 y se toca "Recibí", se cambia a $6.350.000 y se guarda
- **THEN** la línea queda recibida con $6.350.000 y "Te queda libre" sube $62.000

#### Scenario: Ingreso editado en el plan
- **WHEN** en la opción en uso de octubre la línea "Salario Daniel" está en $6.500.000 y todavía no se recibe
- **THEN** Hoy la muestra por recibir con $6.500.000, y "Te queda libre" la cuenta así
