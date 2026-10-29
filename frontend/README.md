# Presupuesto Hogar · PWA

PWA de Presupuesto Hogar en Angular 22 (standalone, signals, zoneless), con Tailwind 4 y service worker. Una sola base responsive: por debajo de 1024 px se ve como app móvil, con barra inferior Hoy · Planear · Cuentas; desde 1024 px, con menú lateral.

Tiene dos **modos de datos** (`src/app/config/modo.ts`):

| Modo | Build | Qué viene del backend | Qué sigue con datos de prueba |
|---|---|---|---|
| **conectado** | `production` (lo que publica `local-deploy.ps1`) y `conectado` | sesión (Google), hogar, miembros, invitaciones, categorías, ingresos fijos, regla de diezmo, "Diezmo en Hoy", las cuentas con su cuadre y "Mover dinero", los créditos, el plan de cada mes con sus opciones (duplicar, quitar, probar un abono, Comparar y Usar, mientras el mes está en Borrador) y todo lo registrado ("Recibí", "Entregado", pagos, gastos, aportes, ajustes de cuadre, transferencias y abonos) y los cierres de mes (un mes cerrado queda en solo lectura y su sobrante pasa al siguiente) | el plan anual. "Crear meses desde este plan" avisa "llega en una próxima versión" |
| **demo** | `demo` y `development` (`npm start`) | nada | todo |

**Al pasar a la Etapa 4, el plan de prueba desaparece en modo conectado.** Hoy y Planear muestran solo los planes reales. Un hogar que todavía no tiene el plan del mes en curso (por ejemplo, "Jimenez Navarro" en `steward.test`) ve en Hoy "Este mes no tiene plan" y lo crea desde Planear, con "Empezar desde cero" o "Solo fijos e ingresos". Sigue de prueba el plan anual (incluidos los aportes proyectados).

**Al pasar a la Etapa 5, los créditos de prueba también desaparecen.** Cuentas muestra "Sin créditos." hasta que se agregan con "+ Agregar" en Créditos. La cuota de un crédito entra sola al plan del mes en curso (si ya tiene plan) y a los meses que se creen después.

Los datos de prueba viven en el navegador (`localStorage`, clave `steward-demo/v1`) y se restablecen desde Ajustes. Mientras algún módulo los use, se ve el aviso "Datos de prueba". En modo conectado no existe "Probar desde cero" y la sesión es un JWT en `localStorage` (`steward/sesion`).

## Comandos

```bash
npm install
npm start                                       # http://localhost:4200, modo demo
npx ng serve -c conectado                       # modo conectado con proxy de /api a localhost:8099 (backend con bootRun)
npm test                                        # Vitest (ng test)
npx ng build frontend --configuration production   # dist/frontend/browser, modo conectado
npx ng build frontend --configuration demo         # solo datos de prueba, sin backend
```

Para el entorno local del workspace: `.\infra\local-deploy.ps1 -Project steward` (desde PowerShell nativo) publica el build en `http://steward.test`.

## Estructura

```text
src/app/
├── core/
│   ├── datos/       PUERTOS (token), providePuertosDemo() / providePuertosConectados(), consulta()
│   │   └── http/    cliente del backend (Api), token de sesión, interceptor Bearer/401 y PuertosConectados
│   ├── sesion/      SesionActual, guards y el cargador de Google Identity Services
│   └── layout/      Shell responsive, avatares del hogar, miembros
├── features/        acceso · hoy · planear · cuentas · ajustes (una pantalla por artboard)
└── shared/components/  monto, monto-input, segmentado, interruptor, hoja, encabezado, fila, kpi, icono, avatar
```

Las reglas de negocio no están aquí: viven en `../packages/domain` (`@steward/domain`), compartido con la app Expo e importado por ruta de TypeScript (`tsconfig.json` → `paths`).

## Pasar un módulo del adaptador de prueba al backend

Las pantallas solo hablan con `PUERTOS` (`Puertos` de `@steward/domain`), así que no cambian. En modo conectado, `PuertosConectados` (`core/datos/http/puertos-conectados.ts`) decide qué puerto va por HTTP y cuál sigue con el adaptador de prueba.

**Datos mezclados.** Las vistas (Hoy, Planear, Cuentas, el Cierre) se calculan con las reglas del dominio sobre un solo `EstadoHogar`. Por eso lo real no se compone pantalla por pantalla, sino que se **superpone** al estado de prueba en cada lectura:
- `GET /api/finanzas` trae ingresos, reglas, cuentas, créditos, "Diezmo en Hoy", los planes y los movimientos reales;
- `superposicion.ts` los pone en lugar de los de prueba, con los ids reales y el orden real de registro (`seq`): así el saldo estimado de cada cuenta (último cuadre más lo registrado después) es el mismo que usa el backend al cuadrar;
- el adaptador de prueba los ve al leer y nunca los guarda.

`PuertosConectados` relee las finanzas al iniciar sesión y después de cada escritura real.

Para pasar otro módulo, por ejemplo el plan anual en la Etapa 8:

1. Agregar sus llamadas a `Api` (`core/datos/http/api.ts`), con los tipos del contrato del backend (`backend/README.md`).
2. En `PuertosConectados`, cambiar sus escrituras para que vayan por HTTP y relean las finanzas.
3. En `superposicion.ts`, superponer esa parte del estado con lo real.
4. Probarlo con `HttpTestingController` como en `core/datos/http/conectado.spec.ts`. Ahí `GET /api/finanzas` lo responde `finanzasPrueba` (`testing/conectado.ts`), que cada test deja como quedaría en el backend.

Los errores del backend (`{codigo, mensaje}`) llegan a las pantallas como `ReglaError`, igual que los del adaptador de prueba.
