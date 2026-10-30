## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Resumen del mes en Hoy
Hoy SHALL mostrar solo el mes en curso:
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

## REMOVED Requirements

### Requirement: Diezmo al recibir
**Reason**: El diezmo deja de ser una obligación que nace al recibir: se presupuesta como ítem del plan y se marca al llevarlo.
**Migration**: Sin tarjeta "Disponible para diezmar" ni botón "Entregado". El diezmo de cada ingreso aparece en Por pagar como "Diezmo · {ingreso}" (requirement "Diezmo como gasto en Hoy").
