# Presupuesto Hogar · PWA

PWA de Presupuesto Hogar en Angular 22 (standalone, signals, zoneless), con Tailwind 4 y service worker. Una sola base responsive: por debajo de 1024 px se ve como app móvil, con barra inferior Hoy · Planear · Cuentas; desde 1024 px, con menú lateral.

Tiene dos **modos de datos** (`src/app/config/modo.ts`):

| Modo | Build | Qué viene del backend | Qué sigue con datos de prueba |
|---|---|---|---|
| **conectado** | `production` (lo que publica `local-deploy.ps1`) y `conectado` | sesión (Google), hogar, miembros e invitaciones | ingresos y diezmo, plan, movimientos, cuentas, cierre, categorías y "Diezmo en Hoy" |
| **demo** | `demo` y `development` (`npm start`) | nada | todo |

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

Las pantallas solo hablan con `PUERTOS` (`Puertos` de `@steward/domain`), así que no cambian. En modo conectado, `PuertosConectados` (`core/datos/http/puertos-conectados.ts`) decide qué puerto va por HTTP y cuál sigue con el adaptador de prueba. Para pasar un módulo, por ejemplo `ingresos` en la Etapa 3:

1. Agregar sus llamadas a `Api` (`core/datos/http/api.ts`), con los tipos del contrato del backend (`backend/README.md`).
2. En `PuertosConectados`, cambiar el getter `ingresos` por una implementación HTTP del puerto que traduzca las respuestas a los tipos del dominio.
3. Probarlo con `HttpTestingController` como en `core/datos/http/conectado.spec.ts`.

Los errores del backend (`{codigo, mensaje}`) llegan a las pantallas como `ReglaError`, igual que los del adaptador de prueba.
