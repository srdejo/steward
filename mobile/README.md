# Presupuesto Hogar · app (Expo)

App de Presupuesto Hogar en Expo SDK 57 con expo-router y React Native 0.86. Tiene las mismas pantallas y flujos que la PWA de `../frontend`, en su versión móvil: barra inferior Hoy · Planear · Cuentas, y Aporte, Marcar pago y Registrar gasto como hojas (`formSheet`).

> **Esta rama (`feature/presupuesto-hogar`) no se publica.** La app reescrita solo se construye con los perfiles `development` o `preview` de EAS (distribución interna). La v1 publicada en App Store (1.0.2) sigue en `main`. La versión de `app.json`, `bundleIdentifier`, `package` y `projectId` no cambian.

Hoy funciona en **modo demo**: los datos de prueba se guardan en el teléfono (AsyncStorage, clave `steward-demo/v1`) y se restablecen desde Ajustes. Los datos de la v1 (`@steward/budget_v3`) nunca se leen ni se tocan.

## Comandos

```bash
npm install
npx expo start                 # dev client / Expo Go
npm test                       # Jest + Testing Library
npm run typecheck
npx expo export --platform web # comprobación rápida de que Metro compila
eas build --profile preview --platform ios   # build interno; nunca `eas submit` desde esta rama
```

## Estructura

```text
src/
├── app/              rutas de expo-router
│   ├── _layout.tsx   fuentes, datos, sesión y rutas protegidas (acceso · onboarding · app)
│   ├── acceso.tsx, face-id.tsx, onboarding/[paso].tsx, invitacion/[token].tsx
│   └── (app)/        (tabs)/hoy · planear · cuentas, hojas aporte · pagar/[itemId] · gasto, y detalle
├── data/             puertos (DatosProvider, useConsulta, useAccion), sesión, miembros
└── ui/               tokens del HANDOFF y componentes (Monto, MontoInput, Segmentado, Hoja, …)
test/                 setup de Jest, adaptador de prueba con reloj fijo y pruebas de recorrido
```

Las reglas de negocio no están aquí: viven en `../packages/domain` (`@steward/domain`), que también usa la PWA. Se importan por ruta de TypeScript (`tsconfig.json`), Metro las ve con `watchFolders` (`metro.config.js`) y Jest las transforma con `babel.config.js`.

## Cambiar el adaptador de datos

Las pantallas solo usan `usePuertos()`, `useConsulta()` y `useAccion()` de `src/data/puertos.tsx`. Para conectar el backend, `src/data/instancia.ts` crea un adaptador HTTP que cumpla `Puertos` en lugar del demo. Las pantallas no cambian.
