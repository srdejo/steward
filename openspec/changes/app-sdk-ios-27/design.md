## Context

- La app (Expo SDK 57, React Native 0.86.3) se compila en EAS Build; hoy EAS usa una imagen con Xcode 26 y el SDK de iOS 26.5.
- Apple exige el SDK de iOS 27 desde abril de 2027 (ITMS-90725, compilación 27 de la 2.3.0).
- AGENTS.md pide leer la documentación versionada de Expo antes de escribir código para la app.

## Goals / Non-Goals

**Goals:** que la próxima versión de la app se compile con Xcode 27 y se acepte en App Store Connect, sin cambiar lo que hace la app.

**Non-Goals:** funcionalidades nuevas, Android, iPad.

## Decisions

- **D1 · Xcode 27 estable, no beta.** Se usa la imagen de EAS con la versión estable de Xcode 27: con una beta de Xcode no se puede enviar a revisión.
- **D2 · Subir Expo en el mismo cambio.** Primero se comprueba en las notas de Expo qué versión del SDK soporta Xcode 27. Si basta con la imagen nueva y Expo SDK 57, solo se cambia `ios.image`; si no, se sube Expo con su guía de actualización.
- **D3 · Imagen fija en `eas.json`.** Se pone la imagen con Xcode 27 por nombre, y no `latest`, para que una compilación no cambie de Xcode sin que se note.

## Risks / Trade-offs

- **[Expo nuevo rompe un módulo nativo]** → Antes de subir, pruebas de la app (`jest`, `tsc`) y una prueba en el iPhone de lo nativo (acceso, push con acciones, fuentes).
- **[Llegar tarde a abril de 2027]** → Hacerlo en la próxima versión de la app y, en todo caso, antes de marzo de 2027.
