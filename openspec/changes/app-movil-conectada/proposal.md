## Why

La app Expo tiene las pantallas del diseño nuevo, pero corre solo con datos de prueba en el teléfono y sin lo de las Etapas 10 a 11.1. Daniel y su esposa usan la PWA para el presupuesto real. La Etapa 12 lleva la app al mismo backend y al mismo diseño, y la publica como 2.0.0 en App Store en lugar de la v1.

Publicar agrega requisitos de Apple que hoy no se cumplen: una opción de acceso equivalente a Google y eliminar la cuenta desde la app.

## What Changes

- La capa conectada de la PWA (`Api`, `PuertosConectados`, `superposicion`) pasa a `@steward/domain/conectado`, sin Angular, y la usan la PWA y la app.
- La app usa el backend de producción, con la sesión en el Keychain. Los datos de prueba dejan de ser accesibles para el usuario.
- La app se pone al día con la PWA: Ejecución y Plan, selector de mes, hojas con "Guardar", chips de categoría, mes en curso editable, borrar plan, corregir y borrar registros, detalle de cuenta, "Empezar de nuevo", y sin Face ID ni "Ocultar montos".
- Acceso nativo con Google y con Apple. El backend acepta el client iOS de Google y gana `POST /api/auth/apple`.
- "Eliminar mi cuenta" en Ajustes, en la app y en la PWA, con `POST /api/cuenta/eliminar`.
- Una vez, la 2.0.0 avisa a quien traiga datos de la v1 que la app empieza de cero; esos datos no se borran ni se importan.
- **BREAKING:** la versión pública de la app deja de ser local: requiere cuenta e internet.
- Versión 2.0.0: primero TestFlight y, con confirmación de Daniel, revisión de App Store.

Fuera de alcance:
- Importar los datos de la v1.
- Android y Google Play.
- Funcionar sin conexión. Sin red, la app muestra el error y permite reintentar.
- Passkeys, biometría y "Ocultar montos" (Etapa 13).
- Notificaciones.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-mobile-app`: conectada al backend, acceso nativo, aviso a quien viene de la v1 y distribución en App Store.
- `steward-auth`: acceso con Apple, varios clients de Google y eliminar la cuenta.
- `steward-ajustes`: "Eliminar mi cuenta".

## Impact

- `packages/domain/`: nuevo `conectado/`, con un transporte HTTP inyectable.
- `frontend/`: `core/datos/http` se reduce a su transporte con `HttpClient`; Ajustes gana "Eliminar mi cuenta".
- `mobile/`: casi todas las pantallas, y dependencias nativas: `@react-native-google-signin/google-signin`, `expo-apple-authentication` y `expo-secure-store`. Requiere un build nuevo; Expo Go no sirve para el acceso.
- `backend/`: migración `V10`, verificación de tokens de Apple, revocación con Apple y eliminar la cuenta.
- Lo hace Daniel: el client iOS de Google, la capability y la llave de Sign in with Apple, las variables del VPS, la política de privacidad y la ficha 2.0.0 en App Store Connect.
- `release/1.0.x` no cambia, pero al publicar la 2.0.0 deja de ser lo que recibe quien instala la app.
