# @steward/domain

Dominio compartido de Presupuesto Hogar. Es TypeScript puro, sin dependencias de runtime, y lo usan la PWA (`frontend/`) y la app (`mobile/`). Cada app lo importa por ruta de TypeScript (`@steward/domain` → `packages/domain/src`), sin publicar paquete ni usar workspaces npm (design D1 del cambio `presupuesto-hogar-ui`).

| Carpeta | Qué tiene |
|---|---|
| `src/model/` | Tipos del modelo del `HANDOFF.md` (hogar, ingresos, plan del mes, escenarios, movimientos, cuentas, créditos, cierre, plan anual). Montos en pesos enteros; fechas ISO. |
| `src/format/` | COP (`$1.500.000`, `−$12.000`), entrada de montos, fechas cortas en español. |
| `src/rules/` | Reglas de negocio como funciones puras: libre, vs. plan, diezmo al recibir, aporte implícito, pago duplicado, cuadre, cierre, escenarios, plan anual, simulador de crédito. Las que modifican devuelven un estado nuevo y lanzan `ReglaError` con un `codigo` estable. |
| `src/ports/` | Interfaces asíncronas por módulo (`SesionPort`, `HogarPort`, `IngresosPort`, `MovimientosPort`, `PlanPort`, `CuentasPort`, `CierrePort`) y el agregado `Puertos`. |
| `src/demo/` | Adaptador de prueba: implementa `Puertos` en memoria con `rules/`, guarda en `steward-demo/v1` (nunca toca `@steward/budget_v3` de la v1), y trae la semilla anclada al mes del reloj. |

## Reglas para quien lo usa

- Las pantallas solo hablan con `Puertos` (y usan `format/` y los tipos de `rules/`). `@steward/domain/demo` se importa únicamente desde la configuración de la app, donde se elige el adaptador.
- Para conectar el backend se escribe otro adaptador que cumpla `Puertos` (HTTP) y se registra en lugar del demo. Las pantallas no cambian.

## Para el backend

`src/rules/rules.test.ts` y `src/demo/demo.test.ts` usan las cifras exactas de los specs (libre $3.436.000, diezmo $700.000, "Gastos sin registrar" $220.000, cierre de octubre con $3.166.000…). Son la especificación ejecutable: el backend debe reproducirlos con sus propios tests antes de reemplazar el adaptador demo.

## Comandos

```bash
npm install        # solo TypeScript y Vitest
npm run typecheck
npm test
```
