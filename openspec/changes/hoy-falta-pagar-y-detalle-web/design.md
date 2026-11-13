# Design

## Context

- Hoy, en la PWA (`frontend/src/app/features/hoy/hoy-page.ts`) y en la app (`mobile/src/app/(app)/(tabs)/hoy.tsx`), pinta lo que devuelve `resumenMes(estado, ref, hoy)` de `packages/domain/src/rules/ejecucion.ts`.
- En modo conectado, el adaptador (`conectado/puertos-conectados.ts`) también calcula `resumenMes` en el dispositivo, sobre el estado que descargó. Por eso todo lo nuevo sale del dominio compartido y el backend no cambia.
- `ItemEjecucion` ya trae `pendiente`, `categoriaNombre`, `pagos`, `diferencia` y `pagadoPor`.
- `vistaCuenta` (en `rules/cuentas.ts`) ya da el saldo estimado y el texto del cuadre ("cuadrada hoy", "sin cuadrar desde 20 sep").
- El shell de la PWA ya cambia a menú lateral desde `lg` (1024 px), como dice la spec `steward-ui-shell`. La vista ancha de Hoy solo ocupa el `<main>`.
- La fuente de diseño es el canvas "Presupuesto Hogar v3", en sus artboards `Main.dc.html` y `HoyWeb.dc.html`.

## Goals / Non-Goals

**Goals:**
- Una sola fuente para cada cifra: Falta pagar, vencidos, conteo de pagos, avance por categoría y cuenta de origen se calculan en el dominio. Las dos apps solo los pintan, y la prueba de paridad lo vigila.
- La vista de escritorio reutiliza las mismas hojas hijas (pagar, gasto, aporte, recibir, registro) y las mismas rutas.

**Non-Goals:**
- La tarjeta "Disponible para diezmar" del canvas no se trae (ver proposal).
- No se rediseña el menú lateral del shell. El canvas dibuja uno con el nombre del hogar y los avatares, pero ese diseño queda para otro cambio.
- En la app móvil no hay vista de tablas: tablet y horizontal siguen en una columna.
- Los textos de detalle de una columna no cambian, salvo lo que pide la spec.

## Decisions

### D1. `ResumenMes` crece en el dominio, no en las pantallas

Se agregan campos derivados a `ResumenMes`:

- `faltaPagar: Pesos`: la suma de `porPagar[].pendiente`.
- `vencidos: number`: los ítems que cumplen la regla de vencido de la spec. Para calcularla hace falta `hoy`, que `resumenMes` ya recibe.
- `pagos: number`: la cantidad de movimientos PAGO o GASTO del mes con ítem, más los no planeados.
- `porCategoria: { categoriaId, nombre, color, plan, real }[]`: en el orden de las categorías, solo las que tienen ítems en la opción. `real` es la suma de lo pagado de sus ítems.
- En `ItemEjecucion`:
  - `vencido: boolean`;
  - `desde: string | null`: el nombre de la cuenta del último pago, o "Su cuenta" si fue externo;
  - `vence: { texto, tono }`: el texto de la columna Vence de la tabla web, con tono `alerta`, `aviso` o `normal`. Se calcula junto a `detalle`, con las mismas reglas, y así ninguna pantalla interpreta el texto de `detalle`.

`Plan` (`r.plan`) se mantiene en el resumen, porque Planear y "P% de lo planeado" lo usan. Solo deja de pintarse como KPI.

**Alternativa descartada:** calcular estos valores en cada pantalla con `computed`/`useMemo`. Se duplicaría la regla de vencido en Angular y en React, y podrían separarse.

**Efecto lateral:** hoy `urgente(i)` en las dos pantallas usa una regex sobre `i.detalle`. Se reemplaza por `i.vencido || i.vence.tono !== 'normal'`, y la regex se borra.

### D2. Lista corta como estado local de la pantalla

La lista corta ("Ver N más") es solo de presentación: el dominio entrega la lista completa y cada pantalla corta a 3 con un `signal` o `useState` (`verTodo`). El valor de "Ver N más" es `faltaPagar - suma(primeros 3)`. El estado no se recuerda al cambiar de mes ni al volver a Hoy, así que siempre arranca corto.

### D3. Escritorio en la misma página, con `@if` por ancho

`HoyPage` decide la vista con un `signal` de ancho (`matchMedia('(min-width: 1024px)')`, con listener) y pinta una de las dos plantillas. Las dos comparten las consultas y las hojas hijas (`<router-outlet />`). Se descarta mostrar u ocultar con clases `lg:hidden` / `hidden lg:block`, porque montaría dos veces las tablas y los `data-testid` en el DOM, y la prueba de paridad y las de Playwright encontrarían duplicados.

La plantilla de escritorio va en un componente hijo `HoyEscritorio` (`features/hoy/hoy-escritorio.ts`), que recibe `resumen`, `cuentas` e `ingresos` como inputs. Así `hoy-page.ts` no se infla y el componente se puede probar solo. Las cuentas salen de `p.cuentas.cuentas()` (lo mismo que pinta Cuentas).

Las flechas del mes llaman a `MesDeHoy.elegir()` con la clave anterior o siguiente dentro de `mesHoy.opciones`. Si no hay mes anterior o siguiente, la flecha queda `disabled`.

### D4. Tablas accesibles y angostas

Las tablas Por pagar y Ya pagado son `<table>` reales, con `<th scope="col">`, y van dentro de un contenedor con `overflow-x: auto`. Entre 1024 y unos 1180 px de ancho útil, la columna lateral cae debajo (flex-wrap, como en el artboard). Tocar una fila es un enlace en la celda del nombre, y "Marcar pagado" es otro enlace a la misma ruta hija. Así no se pone un `click` sobre `<tr>`.

### D5. Móvil

En `hoy.tsx`:
- el `Kpi` "Plan" pasa a "Falta pagar", con `color={colors.negativo}` si es mayor que cero;
- el encabezado de Por pagar suma un `Monto`;
- la lista se corta con `useState`.

El componente `Kpi` gana un prop opcional de énfasis (peso 600 y tamaño 14), igual que en el artboard, y se agrega a `frontend/src/app/shared/components/kpi.ts` con la misma API.

## Risks / Trade-offs

- [Los escenarios con cifras cambian] Hoy, "Datos de ejemplo" y `demo.test.ts` afirman "Plan $5.390.000". → Se cambian a Falta pagar $2.715.000, calculado con la semilla. Las pruebas de dominio fijan además `faltaPagar`, `vencidos` y `porCategoria`.
- [Paridad web/móvil] `paridad.spec.ts` compara textos de una columna. → Se corre a 390 px, donde la PWA sigue en una columna, así que no se rompe. La vista de escritorio se prueba aparte.
- [Rendimiento] `porCategoria` y `desde` recorren ítems y cuentas en cada consulta. → Son decenas de elementos por mes: es despreciable.
- [El cuadre de "Cuentas" en Hoy] Muestra saldos estimados (≈). → Se usa `vistaCuenta`, y Cuentas y Hoy no pueden diferir.

## Migration Plan

No hay datos ni API que migrar. Se despliega la PWA con `infra/deploy.ps1 -Projects steward -Action Frontend`, y la app sale en un build de TestFlight 2.0.0. La reversión es volver a desplegar la versión anterior de la PWA, porque el backend no cambia.
