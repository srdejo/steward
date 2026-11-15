# Proposal

## Why

Hoy las tarjetas de crédito son ítems sueltos del plan ("Tarjeta Mastercard") en una categoría aparte, "Tarjetas y cuotas". La app no sabe cuándo corta ni cuándo se paga cada tarjeta, ni para qué se usa. Con varias tarjetas, eso es justo lo que hace falta para no pagar tarde ni comprar el día equivocado.

Los créditos tienen un solo modo de bajar el saldo: tasa efectiva mensual y cuota. No sirve para una compra a cuotas del almacén (24 cuotas a cierta tasa efectiva anual) ni para un crédito cuyo saldo solo se conoce por el extracto. Tampoco hay forma de ver cuánto se deberá en unos meses ni cuánto se pagará en intereses.

Fuente: canvas de diseño *Presupuesto Hogar v3*. Artboards `TarjetasWeb`, `CreditosWeb`, `TarjetasMovil`, `CreditosMovil`, `CreditoMetodo` y `Credito`, más los ajustes en `HoyWeb`, `Main`, `Anual`, `AnualBase`, `AnualCambios` y `MesVacio` (Créditos en lugar de "Tarjetas y cuotas").

## What Changes

- **Tarjetas y Créditos, dos categorías.** "Tarjetas y cuotas" se separa: las líneas de las tarjetas van en **Tarjetas** (#7C4DDB) y las compras a cuotas y los préstamos, en **Créditos**. Los hogares tienen cinco categorías del sistema: Diezmo, Gastos fijos, Variables, Tarjetas y Créditos.
- **Tarjetas** (nueva pestaña en Cuentas):
  - Cada tarjeta tiene nombre, día de corte, día de pago, un uso opcional ("Mercado", "Gasolina") y cómo se paga: **completa** (el valor del extracto) o **pago fijo** de un monto.
  - La tarjeta es la línea del plan. Cada mes trae su ítem en Tarjetas ("Tarjeta Nu · Mercado"), con el pago fijo o, si se paga completa, con el último valor pagado. No se registran compras: el valor real se escribe al marcar el pago.
  - Arriba se ve "Por pagar este ciclo" (el próximo pago de cada tarjeta) y un calendario de las próximas 5 semanas con cortes y pagos. Cada tarjeta muestra su próximo pago y su próximo corte, con la urgencia en color, y una ayuda: hasta qué día se paga lo que se compre y cuál es el mejor día para una compra grande.
  - Una tarjeta con pago fijo avisa que el saldo que queda genera intereses.
  - **No se lleva lo que se debe en cada tarjeta.** No hay "Deben en tarjetas" ni "debes $X".
  - En Hoy, el pago de una tarjeta dice "Corte 13 · valor del extracto" o "Corte 15 · pago fijo".
- **Créditos con método:**
  - **Con la tasa:** saldo, tasa, cuota y día de pago, como hoy. La tasa se puede escribir efectiva mensual o **efectiva anual**, y se convierte.
  - **Con el plan de pagos:** valor financiado, número de cuotas y tasa efectiva anual (0 % = sin intereses). La app calcula la cuota y la tabla de forma aproximada. Al pagar la cuota *k*, el saldo queda en lo que dice la tabla para *k* ("Cuota 4 de 12").
  - **Lo actualizo a mano:** el saldo se escribe cuando llega el extracto. Si el día de pago ya pasó y no se actualizó, se recuerda.
  - **"Corregir con extracto"** en cualquier método: se escribe el saldo y la app recalcula desde ahí.
- **Créditos: cómo baja y proyección.**
  - Tabla de créditos con método, día de pago, cuota, lo que se debe hoy y cuándo termina.
  - Indicadores: "Deben en créditos", "Pagan al mes", "Deberán al cerrar {año}" e "Intereses en {año siguiente}".
  - "Cuánto deberían al final de cada mes": los próximos 6 meses por crédito, con el total y sus barras.
  - El detalle muestra la próxima cuota con lo que va a capital y a intereses, las próximas cuotas en tabla y "¿Y si abonas?", que ya existe.
- **Móvil (PWA angosta y app):** pestañas Cuentas · Tarjetas · Créditos en Cuentas. Tarjetas muestra las próximas fechas en lista; Créditos, tarjetas con el progreso de cuotas. "¿Cómo baja el saldo?" se elige en una hoja.
- **Datos existentes (migración):**
  - Los ítems de "Tarjetas y cuotas" pasan a Créditos, en los planes y en el plan anual.
  - Cada compra a cuotas ("cuota 4 de 12") se convierte en un crédito con plan de pagos, sin intereses, enlazado a sus ítems.
  - Las tarjetas no se crean solas: sus ítems siguen como gastos de Créditos hasta que se agrega la tarjeta y se enlaza con ese ítem, que pasa a Tarjetas (migración `V13`, que crea la categoría Tarjetas).
- **App móvil:** versión 2.2.0 en TestFlight.

**No se incluye:**
- Subir el PDF o la foto del plan de pagos: la tabla se calcula con el número de cuotas y la tasa efectiva anual.
- Llevar la deuda de cada tarjeta o registrar sus compras.
- Avisos que dependen de la historia ("el extracto pasó el plan dos meses seguidos").

## Capabilities

### New Capabilities

- `steward-tarjetas`: las tarjetas de crédito, con corte, pago, uso y cómo se paga, su línea en el plan y el calendario de fechas.

### Modified Capabilities

- `steward-plan-mes`: "Categorías del hogar": cinco categorías del sistema; Tarjetas tiene las líneas de las tarjetas y Créditos, las cuotas y los préstamos.
- `steward-cuentas`:
  - "Cuentas, cuadre y créditos": las pestañas Tarjetas y Créditos dejan de ser provisionales.
  - "Detalle de crédito con simulador": método, próximas cuotas y corregir con extracto.
  - "Agregar crédito": se elige el método, y se acepta la tasa efectiva anual.
  - Nuevo requisito: "Proyección de créditos".
- `steward-mobile-app`: "Paridad con la PWA", con las pestañas de Cuentas en la app, y "Distribución solo por TestFlight", con la versión 2.2.0.

## Impact

- **Dominio** (`packages/domain`):
  - Modelo: `Tarjeta`; `Credito` gana `metodo`, `numeroCuotas`, `cuotasPagadas` y `valorFinanciado`; `ItemPlan` gana `tarjetaId`.
  - Reglas: `rules/tarjetas.ts` (fechas, calendario, ítem del plan) y en `rules/credito.ts` amortización, plan de pagos, proyección y EA↔EM.
  - El pago de la cuota según el método, en `ejecucion.ts`.
  - Puertos `TarjetasPort` y `CuentasPort`, adaptadores demo y conectado, y la semilla, que ahora sigue el canvas: Nu · Mercado, Mastercard con pago fijo, Visa · Gasolina y la compra a cuotas como crédito.
- **Backend:**
  - Migración `V12`: tabla `tarjeta`, columnas nuevas de `credito` e `item_plan.tarjeta_id`, unión de categorías y conversión de las compras a cuotas.
  - `TarjetaController` (`/api/tarjetas`), cambios en el caso de uso de créditos y en `NacimientoMes` (la línea de cada tarjeta), y contrato.
- **PWA:** pestañas Tarjetas y Créditos de Cuentas (escritorio y móvil), hoja "¿Cómo baja el saldo?", detalle de crédito y detalle de pago de tarjeta en Hoy.
- **App:** `(tabs)/cuentas.tsx` con pestañas, pantallas de tarjetas y de método de crédito, `credito/[id].tsx` y la versión 2.2.0.
- Las cifras de la semilla cambian (Variables $400.000, Tarjetas $2.620.000, Créditos $875.000), así que se actualizan las pruebas de paridad de las dos apps.
