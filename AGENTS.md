# Estructura

- `packages/domain/`: dominio compartido de Presupuesto Hogar (modelo, reglas, puertos, adaptador de prueba). Las reglas de negocio van aquí, no en las apps.
- `frontend/`: PWA Angular 22. Se despliega con `infra/` del workspace; ver `docs/DEPLOYMENT.md`.
- `mobile/`: app Expo. En `main`, la v1 publicada en App Store; en `feature/presupuesto-hogar`, el diseño nuevo (sin publicar). Comandos de npm/expo/eas se corren dentro de `mobile/`.
- `backend/`: API de la versión en la nube, por construir.

# Expo HAS CHANGED (mobile/)

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.
