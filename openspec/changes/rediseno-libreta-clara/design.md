## Context

- **PWA**: tokens en `frontend/src/styles.css` (Tailwind v4 `@theme`: `--color-acento`, `--font-mono`, etc.). Las pantallas viven en `features/{acceso,hoy,planear,cuentas,ajustes}` y los componentes comunes en `shared/components` (`monto`, `kpi`, `fila`, `hoja`, `segmentado`…). El shell está en `core/layout`.
- **Registros de Hoy**: tres hojas con ruta hija, `aporte-hoja.ts`, `gasto-hoja.ts` y `pagar-hoja.ts` (`/hoy/aporte`, `/hoy/gasto`, …).
- **App**: tokens en `mobile/src/ui/tokens.ts` (fuentes JetBrains Mono cargadas con `@expo-google-fonts`) y pestañas en `app/(app)/(tabs)/_layout.tsx` con Hoy, Planear y Cuentas.
- **Paridad**: la app la exige (spec `steward-mobile-app`) y la verifican las pruebas de paridad (`paridad.spec.ts`, `mobile/test`).
- **Canvas**: el rediseño está en https://claude.ai/artifact/3L586EunT3GFHHFHsPKG42; cada artboard es la referencia de su pantalla.

## Goals / Non-Goals

**Goals:**
- Cambiar los tokens y las fuentes en un solo lugar por plataforma, para que la mayoría de las pantallas cambien sin tocar su plantilla.
- Una hoja Agregar que reúna las tres hojas actuales sin duplicar su lógica.
- Mantener los datos de prueba y los números de las specs: solo cambia cómo se ven.

**Non-Goals:**
- Funciones que el canvas dibuja y la app no tiene. Se implementa lo que ya existe con el layout nuevo; lo nuevo, en otro cambio.
- Avisos y notificaciones (cambio `avisos-pagos`), incluida la campana de Hoy.
- Cambios de dominio o backend, salvo un helper puro de agrupamiento en el dominio (D4).

## Decisions

- **D1 · Tokens con los mismos nombres.**
  - Se cambian los valores de `--color-fondo`, `--color-superficie`, `--color-texto`, `--color-secundario`, `--color-acento`, etc., y se agregan los de estado y los seis de categoría (`--color-cat-*`).
  - Se hace igual en `tokens.ts`.
  - Así las clases existentes (`bg-acento`, `text-secundario`) toman el color nuevo sin tocar cada pantalla.
  - *Alternativa:* nombres nuevos (`bosque`, `tinta`). Obliga a reescribir todas las plantillas a la vez.
  - Los colores de categoría no son tokens: cada categoría guarda el suyo, en el demo y en el backend. El dominio da a las del sistema el color de su tipo (`colorCategoria` y `COLOR_CATEGORIA` en `rules/colores.ts`) al leerlas del backend y al cargar un estado guardado; las propias conservan el suyo. Así no hace falta migrar datos.
- **D2 · Montos con Inter tabular.**
  - `--font-mono` deja de usarse para montos: el componente `monto` y la utilidad `monto` pasan a `font-sans tabular-nums`.
  - Space Grotesk entra como `--font-display`, para títulos y la cifra principal.
  - En la app, `@expo-google-fonts/space-grotesk` reemplaza a JetBrains Mono, y `fonts.mono` se elimina.
  - *Alternativa:* conservar el mono en tablas densas (plan anual). Se descarta: el canvas usa Inter tabular también en WAno.
- **D3 · Agregar como hoja con pestañas que monta las hojas actuales.**
  - La hoja `agregar-hoja` tiene un `segmentado` (Gasto · Aporte · Pago) y monta el contenido de `gasto-hoja`, `aporte-hoja` y `pagar-hoja`.
  - Esos contenidos se extraen a componentes sin el marco de hoja, y la lógica de cada uno no cambia.
  - Rutas:
    - nueva: `/hoy/agregar?tipo=gasto|aporte|pago&item=<id>`;
    - `/hoy/aporte`, `/hoy/gasto` y las de pagar redirigen a ella.
  - En móvil, el + abre la hoja sobre la pantalla actual, como un outlet auxiliar o una hoja global del shell, no una ruta de Hoy. Así guardar te deja donde estabas.
  - En la app, la pestaña central es un botón que abre un modal (`router.push('/agregar')` con presentación `modal`) y no una pantalla de pestaña.
  - *Alternativa:* una hoja nueva que reescriba los tres formularios. Duplica las reglas ya probadas.
- **D4 · Agrupar por cuándo en el dominio.**
  - Una función pura `grupoPorPagar(item, hoy): 'VENCIDO' | 'SEMANA' | 'MES'` en `packages/domain`, usada por la PWA y la app.
  - El orden de Por pagar pasa a ser grupo y, dentro de él, fecha.
  - El tope de 3 se aplica después de ordenar.
  - Es la única pieza de dominio del cambio.
- **D5 · Diezmo como hoy, no como tarjeta.**
  - El canvas dibuja "Disponible para diezmar · $700.000" con "Entregado", pero la spec vigente `steward-hoy` ("Diezmo como gasto en Hoy", escenario "Recibir no crea tarjeta") lo prohíbe.
  - Se mantiene el diezmo como ítem en "Durante el mes".
  - Si Daniel quiere la tarjeta, es un cambio de regla aparte.
- **D6 · Por plataforma y por pantalla.**
  - El cambio se aplica en este orden:
    1. tokens y fuentes;
    2. shell y navegación;
    3. Hoy y Agregar;
    4. el resto de pantallas por grupo del canvas (entrar, planear, cuentas, ajustes).
  - Cada grupo con sus specs de componentes al día, en la PWA y luego en la app.
  - Un PR por grupo si conviene, sobre `main`.

## Risks / Trade-offs

- **[Pruebas que buscan textos o clases viejas]** ("Ejecución", "+ Gasto", la fuente mono) → se actualizan por grupo de pantallas; los números de los escenarios no cambian.
- **[El + en móvil tapa contenido inferior]** → padding inferior del contenido igual a la barra más el desborde del botón, y verificación a 390 px.
- **[Contraste]** de tinta suave #63675F sobre #F6F5F1 en textos de 11–12 px → comprobar 4.5:1 y oscurecer el gris si no pasa.
- **[La app necesita build nuevo]** por las fuentes nativas → versión 2.3.0 a TestFlight, con confirmación de Daniel.
- **[El canvas no es la fuente de las cifras]** → los textos de ejemplo del canvas (Transporte $64.000, etc.) no se copian; mandan los datos de prueba y las specs.

## Migration Plan

- Sin datos ni API que migrar.
- Despliegue de la PWA con `infra/deploy.ps1 -Action Frontend` y de la app con EAS (`testflight`), los dos con confirmación de Daniel.
- **Rollback**: redesplegar la versión anterior de la PWA; en TestFlight queda la 2.2.4.

## Open Questions

- ¿Daniel quiere la tarjeta "Disponible para diezmar" del canvas (D5)? No cambia este cambio: sería uno aparte.
