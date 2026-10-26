# Presupuesto Hogar · PWA

PWA de Presupuesto Hogar en Angular 22 (standalone, signals, zoneless), con Tailwind 4 y service worker. Una sola base responsive: por debajo de 1024 px se ve como app móvil, con barra inferior Hoy · Planear · Cuentas; desde 1024 px, con menú lateral.

Hoy funciona en **modo demo**: los datos de prueba viven en el navegador (`localStorage`, clave `steward-demo/v1`) y se restablecen desde Ajustes.

## Comandos

```bash
npm install
npm start                                       # http://localhost:4200
npm test                                        # Vitest (ng test)
npx ng build frontend --configuration production   # dist/frontend/browser
```

Para el entorno local del workspace: `.\infra\local-deploy.ps1 -Project steward` (desde PowerShell nativo) publica el build en `http://steward.test`.

## Estructura

```text
src/app/
├── core/
│   ├── datos/       PUERTOS (token), providePuertosDemo(), consulta() (resource que se recarga tras cada escritura)
│   ├── sesion/      SesionActual y guards (sin sesión → Acceso; hogar sin configurar → onboarding)
│   └── layout/      Shell responsive, avatares del hogar, miembros
├── features/        acceso · hoy · planear · cuentas · ajustes (una pantalla por artboard)
└── shared/components/  monto, monto-input, segmentado, interruptor, hoja, encabezado, fila, kpi, icono, avatar
```

Las reglas de negocio no están aquí: viven en `../packages/domain` (`@steward/domain`), compartido con la app Expo e importado por ruta de TypeScript (`tsconfig.json` → `paths`).

## Cambiar el adaptador de datos

Las pantallas solo inyectan `PUERTOS` (`core/datos/puertos.ts`) y leen con `consulta()`. Para conectar el backend:

1. Escribir un adaptador HTTP que cumpla `Puertos` de `@steward/domain`.
2. En `app.config.ts`, reemplazar `providePuertosDemo()` por su provider.

Las pantallas no cambian.
