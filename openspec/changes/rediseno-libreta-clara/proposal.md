## Why

El canvas "Presupuesto Hogar · Rediseño" (https://claude.ai/artifact/3L586EunT3GFHHFHsPKG42) define un sistema visual nuevo, **Libreta clara**, y rehace las pantallas de móvil y web. Busca que cada pantalla tenga un número protagonista y que los pagos se lean por cuándo vencen. Hoy la web y la app siguen el diseño anterior (fondo #FAFAF7, acento #2E4A3B, montos en JetBrains Mono) y registran gastos, aportes y pagos desde botones separados. Este cambio aplica el rediseño en la PWA y en la app. Los avisos de pagos van en el cambio aparte `avisos-pagos`.

## What Changes

- **Tokens nuevos** en la PWA (`styles.css`) y en la app (`mobile/src/ui/tokens.ts`):
  - fondo #F6F5F1, superficie #FFFFFF sin bordes, tinta #1A1D1A / #63675F;
  - acción "bosque" #1F4D3B, entra #2F7A4F, atención #8A5200, vencido #B3261E;
  - un color fijo por categoría en todas las pantallas: Ingresos, Gastos fijos, Variables, Créditos y tarjetas, Ahorro y Diezmo.
- **Tipografía**: Inter con cifras tabulares para la UI y los montos, y Space Grotesk para títulos y la cifra principal. **BREAKING (visual)**: JetBrains Mono deja de usarse en los montos.
- **Navegación**:
  - los destinos pasan a llamarse **Hoy**, **Planear**, **Cuentas** y **Ajustes**; las rutas no cambian;
  - en móvil, la barra inferior tiene cinco espacios: Hoy, Planear, el botón central **+**, Cuentas y Ajustes;
  - en web, el menú lateral tiene los cuatro destinos más el botón **Agregar**.
- **Un solo botón + para todo**: una hoja "Agregar" con pestañas Gasto, Aporte y Pago, con el monto primero. Reemplaza los accesos separados "+ Gasto" y "+ Aporte" de Hoy. Sus reglas no cambian.
- **Hoy**:
  - la tarjeta verde "Te queda libre en {mes}" con la barra Pagado / Falta pagar;
  - "Por pagar" agrupado en **Vencido**, **Esta semana** y **Durante el mes**, cada pago con un bloque de fecha a la izquierda;
  - "Disponible para diezmar" como tarjeta propia;
  - "Ya pagado" plegable.
- **El resto de las pantallas** con el layout del canvas: acceso, Face ID, onboarding de 5 pasos, invitación, Planear, plan del mes, año, cierre, Cuentas (cuentas, tarjetas y créditos), cuadrar, detalle de crédito, cómo baja el saldo y Ajustes, en móvil y web.
- **Fuera de alcance**:
  - la campana de avisos en Hoy y las pantallas MPush, MAvisos y WAvisos, que van en `avisos-pagos`;
  - todo lo que el canvas dibuja y la app aún no hace (por ejemplo, subir un PDF del plan de pagos si no existe). Se dibuja como hoy o se omite, sin funciones nuevas.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities
- `steward-ui-shell`: "Navegación principal" (nombres, barra de cinco espacios con +, Agregar en el menú lateral) y "Fidelidad al diseño" (tokens, tipografías y canvas de referencia nuevos).
- `steward-hoy`: "Resumen del mes en Hoy" (Por pagar agrupado por cuándo, la tarjeta del resumen) y un requisito nuevo, "Agregar desde un solo botón".

## Impact

- **PWA (`frontend/`)**:
  - `styles.css` (tokens, fuentes);
  - el shell de navegación;
  - todas las páginas de `features/` (acceso, hoy, planear, cuentas, ajustes);
  - la hoja de agregar nueva, que reúne las de gasto, aporte y pago;
  - specs de componentes con textos o estructura que cambian.
- **App (`mobile/`)**:
  - `ui/tokens.ts`, fuentes (Space Grotesk en lugar de JetBrains Mono);
  - `(tabs)/_layout.tsx` con el + central y la pestaña Ajustes;
  - las pantallas de `app/(app)`;
  - versión nueva para TestFlight (2.3.0).
- **Dominio y backend**: sin cambios. El agrupamiento por cuándo se calcula en el dominio a partir de los vencimientos que ya existen.
- **Diseño de referencia**: el canvas del rediseño reemplaza a "Presupuesto Hogar v3" como fuente de verdad visual.
