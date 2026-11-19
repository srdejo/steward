## Why

Al subir la 2.3.0 (compilación 27) el 2026-11-19, App Store Connect avisó con **ITMS-90725**: la app se compiló con el SDK de iOS 26.5 y, **desde abril de 2027**, solo se aceptan apps compiladas con el SDK de iOS 27 (Xcode 27 o posterior). La entrega fue válida; sin este cambio, la primera versión que se suba desde abril de 2027 será rechazada.

## What Changes

- Compilar la app en EAS con una imagen que tenga **Xcode 27** (perfil `testflight` y `production` de `mobile/eas.json`, campo `ios.image`).
- Subir el SDK de Expo a la primera versión que soporte Xcode 27 y el SDK de iOS 27 (hoy la app está en Expo SDK 57 con React Native 0.86.3), con sus dependencias (`npx expo install --fix`) y leyendo antes sus notas de versión.
- Volver a probar en un iPhone lo que depende de lo nativo: el acceso con Apple y con Google, la llave de acceso, las notificaciones con sus acciones ("Ya lo pagué", "Recordar mañana") y las fuentes.
- Una versión nueva de la app a TestFlight y al App Store, compilada con el SDK de iOS 27, **antes de abril de 2027**.
- No cambia el comportamiento de la app: no hay requisitos nuevos ni modificados.

**Cuándo:** en la próxima versión de la app, con margen antes de abril de 2027. Xcode 27 (SDK de iOS 27) salió con iOS 27 en 2026; la compilación 27 usó Xcode 26 porque es la imagen por defecto de EAS. Falta comprobar qué imagen de EAS trae Xcode 27 y si Expo SDK 57 lo soporta.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna: es un cambio de herramientas de compilación (`skip_specs`).

## Impact

- `mobile/eas.json` (imagen de compilación), `mobile/package.json` y `package-lock.json` (Expo y sus módulos), y lo que pida la guía de actualización de Expo (por ejemplo `app.json` o plugins).
- La rama `release/1.0.x` (v1) no se toca: la v1 ya no se distribuye.
- Backend y PWA: sin cambios.
