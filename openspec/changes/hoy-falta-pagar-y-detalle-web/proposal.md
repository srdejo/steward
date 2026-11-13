# Proposal

## Why

Hoy muestra "Te queda libre", Plan, Pagado y Vs. plan, pero no dice cuánto falta por pagar en el mes. Hay que sumar mentalmente la lista Por pagar. En la PWA de escritorio, Hoy es la misma columna del móvil estirada, sin aprovechar el ancho para ver el detalle de cada pago (categoría, vencimiento, de qué cuenta salió, quién pagó). El canvas de diseño "Presupuesto Hogar v3" ya trae los dos ajustes: `Main.dc.html` (móvil) y el nuevo `HoyWeb.dc.html` (web).

## What Changes

- **Falta pagar en Hoy (móvil y PWA):**
  - La tarjeta "Te queda libre" cambia la cifra **Plan** por **Falta pagar**, destacada en el color de alerta. Falta pagar es la suma de lo pendiente de Por pagar. Las otras dos cifras siguen siendo Pagado y Vs. plan.
  - El encabezado de "Por pagar" muestra ese total junto al título.
  - Por pagar muestra los primeros 3 pendientes y una fila "Ver N más · M pendientes en total" con el monto de los ocultos. Tocarla despliega la lista completa.
- **Hoy detallado en la PWA de escritorio (≥ `lg`), según `HoyWeb.dc.html`:**
  - **Encabezado:**
    - Mes con flechas anterior y siguiente, dentro de los meses que ya permite el selector de Hoy.
    - Botones "+ Aporte" y "+ Gasto".
  - **Cuatro tarjetas con subtítulo:**
    - Te queda libre: "de $X que entraron".
    - Falta pagar: "N pendientes · K vencidos".
    - Pagado: "N pagos · P% de lo planeado".
    - Vs. plan: "gastaste menos/más de lo planeado".
  - **Tabla Por pagar:** Gasto con detalle, Categoría con su color, Vence (rojo si venció, ámbar si vence en ≤ 7 días), Falta y el botón "Marcar pagado".
  - **Tabla Ya pagado:** Gasto, Plan, Real, Dif., Quién (avatar) y Desde (cuenta de origen). También incluye los gastos no planeados.
  - **Columna lateral:**
    - Ingresos, con las mismas líneas y acciones que hoy.
    - Por categoría: real / plan con barra de avance.
    - Cuentas: saldo y estado de cuadre, con enlace a Cuadrar.
  - Por debajo de `lg`, la PWA sigue con el Hoy de una columna (igual al móvil).
- El canvas todavía dibuja la tarjeta "Disponible para diezmar" en ambos artboards. Esa tarjeta **no** se trae: la spec vigente ("Diezmo como gasto en Hoy") la descarta, y el diezmo sigue como un ítem más de Por pagar y Ya pagado.

## Capabilities

### New Capabilities
<!-- Ninguna: todo cae en capacidades existentes. -->

### Modified Capabilities
- `steward-hoy`: el requirement "Resumen del mes en Hoy" cambia sus cifras (Falta pagar en lugar de Plan) y suma el total y la lista corta de Por pagar. Se agrega el requirement "Hoy detallado en escritorio" para la vista web ancha.

## Impact

- `packages/domain/src/rules/ejecucion.ts`: `ResumenMes` gana:
  - `faltaPagar`, `vencidos` y `ingresosRecibidos` (o el total que entró);
  - el avance por categoría;
  - la cuenta de origen de cada pagado.

  Pruebas en `rules.test.ts`.
- `frontend/src/app/features/hoy/hoy-page.ts`: la vista de una columna se ajusta y se agrega la vista de escritorio con tablas y columna lateral. Pruebas en `hoy.spec.ts` y `paridad.spec.ts`.
- `mobile/src/app/(app)/(tabs)/hoy.tsx`: KPI Falta pagar, total en el encabezado y "Ver N más". Pruebas en `test/app.test.tsx`.
- Backend: sin cambios. Todo sale del estado que ya se descarga y de `resumenMes` en el dominio compartido.
- Cambia el escenario "Datos de ejemplo" de la spec: deja de mostrar "Plan $5.390.000" y pasa a "Falta pagar".
