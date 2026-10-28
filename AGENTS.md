# Estructura

- `packages/domain/`: dominio compartido de Presupuesto Hogar (modelo, reglas, puertos, adaptador de prueba). Las reglas de negocio van aquí, no en las apps.
- `frontend/`: PWA Angular 22. Se despliega con `infra/` del workspace; ver `docs/DEPLOYMENT.md`.
- `mobile/`: app Expo. En `main`, la v1 publicada en App Store; en `develop`, el diseño nuevo (solo TestFlight, 1.1.0); de `develop` pasa a `main` cuando esté listo. Comandos de npm/expo/eas se corren dentro de `mobile/`.
- `backend/`: API de la versión en la nube (Spring Boot 4.1 reactivo, Java 25). Día a día en JVM; imagen nativa (GraalVM) solo para desplegar. `gradlew check` corre también el contrato en modo AOT. Ver `backend/README.md` y `backend/docs/`.
- Correos: siempre por la API `contact` del workspace. Google: el OAuth client de beauty (ver `docs/DEPLOYMENT.md`).

# Expo HAS CHANGED (mobile/)

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.
