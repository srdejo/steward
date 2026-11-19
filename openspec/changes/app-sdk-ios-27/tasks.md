# Tasks

## 1. Compilación con Xcode 27 (en la próxima versión, antes de abril de 2027)

- [ ] 1.1 Comprobar en EAS que hay una imagen de compilación con Xcode 27 estable, y en las notas de Expo qué versión del SDK lo soporta.
- [ ] 1.2 Si hace falta, subir Expo siguiendo su guía (`npx expo install expo@<versión>` y `npx expo install --fix`), leyendo antes la documentación versionada. Correr `jest` y `tsc` de la app.
- [ ] 1.3 Poner la imagen con Xcode 27 por nombre en `ios.image` de los perfiles `testflight` y `production` de `mobile/eas.json` (design D3).

## 2. Entrega

- [ ] 2.1 Con confirmación de Daniel: subir la versión de la app y compilar en EAS con envío a TestFlight. Revisar que App Store Connect ya no muestre ITMS-90725.
- [ ] 2.2 Prueba de Daniel en el iPhone: acceso con Apple y Google, llave de acceso, notificaciones con "Ya lo pagué" y "Recordar mañana", y fuentes.
- [ ] 2.3 Publicar la versión en el App Store **antes de abril de 2027**.
