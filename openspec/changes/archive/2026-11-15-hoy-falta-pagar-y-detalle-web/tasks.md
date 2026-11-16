# Tasks

## 1. Dominio: cifras nuevas del resumen

- [x] 1.1 En `packages/domain/src/rules/ejecucion.ts`, agregar `faltaPagar`, `vencidos`, `pagos` y `porCategoria` a `ResumenMes`, y `vencido`, `desde` y `vence { texto, tono }` a `ItemEjecucion` (design D1). Verificar con `npm run typecheck` en `packages/domain`.
- [x] 1.2 Pruebas en `rules.test.ts`. Verificar con `npm test` en `packages/domain`. Deben cubrir:
  - con la semilla: `faltaPagar` = 2.715.000 y `vencidos` = 1 (Compra a cuotas, día 20, con hoy 26 oct);
  - el diezmo y Mercado no cuentan como vencidos;
  - `desde` da "Davivienda" para un pago desde la cuenta y "Su cuenta" para uno externo;
  - `porCategoria` tiene real ≤ plan y real > plan;
  - pagar la Mastercard baja `faltaPagar` a 1.215.000.
- [x] 1.3 Actualizar `demo.test.ts` ("la semilla da los totales de Hoy") para que afirme también `faltaPagar`, y verificar `npm test` en `packages/domain`.

## 2. PWA: una columna

- [x] 2.1 En `shared/components/kpi.ts`, agregar el prop de énfasis (design D5). En `hoy-page.ts`:
  - cambiar el KPI Plan por Falta pagar, con tono negativo si es mayor que cero;
  - poner el total junto a "Por pagar";
  - agregar la lista corta con "Ver N más · M pendientes en total" y su monto;
  - cambiar `urgente()` por `i.vencido || i.vence.tono !== 'normal'`.

  Verificar a 390 px con `npm start` en `frontend`.
- [x] 2.2 En `hoy.spec.ts`, actualizar "Datos de ejemplo" y agregar las pruebas de lista corta (3 visibles, "Ver 1 más · 4 pendientes en total $140.000", que despliega Mercado) y de "Nada pendiente" sin color de alerta. Verificar con `npm test` en `frontend`.

## 3. PWA: Hoy detallado en escritorio

- [x] 3.1 Agregar en `HoyPage` el `signal` de ancho con `matchMedia('(min-width: 1024px)')` y `DestroyRef`, y elegir con `@if` entre la vista de una columna y `<app-hoy-escritorio>` (design D3). Verificar que a 1280 px solo se monta la vista de escritorio, con una prueba que revise que no haya `data-testid` duplicados.
- [x] 3.2 Crear `features/hoy/hoy-escritorio.ts`. Verificar con una prueba de componente que renderice la semilla. Debe tener:
  - el encabezado, con flechas que siguen `mesHoy.opciones` y quedan deshabilitadas en los extremos, y "+ Aporte" y "+ Gasto" hacia las rutas hijas;
  - las cuatro tarjetas con los subtítulos de la spec.
- [x] 3.3 Agregar la tabla Por pagar: `<table>` con `<th scope="col">`, el color de la categoría, Vence con su tono, Falta y el enlace "Marcar pagado" a `pagar/:id` (o `gasto?item=` si es variable), en un contenedor con `overflow-x: auto` (design D4). Verificar con una prueba de que "Venció el 20" aparece en rojo y de que "Marcar pagado" abre la hoja.
- [x] 3.4 Agregar la tabla Ya pagado, con Plan, Real, Dif. ("—" si es 0), Quién y Desde. Los no planeados van con Plan "—" y cada fila abre su registro. Verificar con una prueba de que Pensión dice "Davivienda" y Recibo Luz "Su cuenta".
- [x] 3.5 Agregar la columna lateral con:
  - Ingresos, que reutiliza las mismas filas y acciones que una columna;
  - Por categoría, con barra `min(100, real/plan)`;
  - Cuentas, desde `p.cuentas.cuentas()`, con su estado de cuadre y un enlace a `/cuentas/cuadrar`.

  Verificar con una prueba de "Gastos fijos real / plan" y del texto de cuadre de una cuenta.
- [ ] 3.6 Revisar a mano en 1024, 1280 y 1440 px que la columna lateral cae debajo cuando falta ancho y que no hay scroll horizontal en la página (solo dentro de las tablas). Documentar la vista en `frontend/README.md`.

## 4. App móvil

- [x] 4.1 En `mobile/src/ui/base.tsx`, agregar al `Kpi` el prop de énfasis. En `mobile/src/app/(app)/(tabs)/hoy.tsx`:
  - el KPI Falta pagar;
  - el `Monto` en el encabezado de Por pagar;
  - la lista corta con `useState`;
  - `urgente` desde `i.vencido` / `i.vence.tono`.

  Verificar con `npm run typecheck` en `mobile`.
- [x] 4.2 En `mobile/test/app.test.tsx`, actualizar los totales de Hoy y agregar las pruebas de lista corta y "Ver 1 más". Verificar con `npm test` en `mobile`.

## 5. Integración

- [x] 5.1 Correr `paridad.spec.ts` (a 390 px) y verificar que la PWA y la app muestran los mismos textos de Hoy (Falta pagar, total, "Ver 1 más").
- [x] 5.2 Verificar en modo conectado que Falta pagar y Desde se actualizan con un pago del otro miembro. Se verificó con el adaptador HTTP de prueba (`conectado.spec.ts`), no contra un backend local: el backend no cambia y el cálculo es del dominio sobre las finanzas descargadas.
- [x] 5.3 Pasar `openspec validate hoy-falta-pagar-y-detalle-web --strict` sin errores.
