## Context

- `mobile/src/data/instancia.ts` crea el adaptador de prueba, y sus pantallas usan `usePuertos`, `useConsulta` y `useAccion` sobre el puerto `Puertos`. Cambiar el adaptador no toca el acceso a datos de las pantallas.
- `frontend/.../http` tiene unas 1.240 líneas. Solo `Api` depende de Angular (`HttpClient`, `inject`). `PuertosConectados` y `superposicion` son TypeScript sin Angular.
- El backend identifica al usuario por correo (`usuario_email_uq`). Valida el token de Google contra un solo client id. Las invitaciones se aceptan solo si el correo de la sesión coincide con el invitado.
- Varias tablas tienen `usuario_id` o `creado_por` con FK `NOT NULL` a `usuario`, y son historia compartida del hogar.
- La v1 guarda en AsyncStorage con la clave `@steward/budget_v3`, y la app nueva comparte con ella el bundle id `com.danieljimenez.steward`.
- App Store Connect ya tiene una ficha 2.0.0 vacía.

Requisitos de Apple revisados el 2026-10-30:
- **4.8:** quien usa Google para la cuenta principal debe ofrecer una opción equivalente que limite los datos a nombre y correo y permita ocultar el correo. Sign in with Apple cumple. La documentación de Expo lo confirma para apps con terceros.
- **5.1.1(v):** quien permite crear cuentas debe ofrecer eliminarlas dentro de la app, con sus datos, sin pedir soporte. Con Sign in with Apple, se revocan los tokens con su REST API.

Decisiones de Daniel (2026-10-30): conectada y al día, capa compartida, Google nativo, reemplazar la v1 en App Store, y empezar limpio conservando los datos de la v1.

## Goals / Non-Goals

**Goals:**
- Los mismos datos y reglas en la PWA y en la app.
- Una sola capa conectada.
- Pasar la revisión de App Store sin perder lo que la v1 tiene en el teléfono.

**Non-Goals:**
- Importar los datos de la v1.
- Android.
- Modo sin conexión.
- Unir cuentas de Apple y Google con correos distintos.

## Decisions

### D1. Capa conectada en `@steward/domain/conectado`, con transporte inyectable

`Api`, `aReglaError`, `PuertosConectados` y `superposicion` se mueven al subpaquete, y `Api` recibe:

```ts
interface Transporte { pedir<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T>; }
```

- **PWA:** un transporte sobre `HttpClient`. Se conservan el interceptor y `conectado.spec.ts`, que comprueba el comportamiento con `HttpTestingController`.
- **App:** un transporte sobre `fetch`, con la URL base y el token. Un 401 cierra la sesión.

Va en su propio subpaquete, como `demo`, para que `rules` y `model` sigan sin saber de HTTP.

**Alternativa descartada: `fetch` en las dos.** Reescribe el interceptor y las pruebas de la PWA sin beneficio para el usuario.

### D2. Sesión en el Keychain, cargada al arrancar

`PuertosConectados` lee el token de forma síncrona, y `SecureStore` es asíncrono. La app lo carga antes de crear los puertos y mantiene una copia en memoria. El token persiste al desinstalar en iOS, así que al abrir se valida con `GET /api/sesion`, como ya hace la capa conectada: un 401 lo borra.

`steward-demo/v1` sigue como base de cálculo, igual que en la PWA, nunca con datos visibles para el usuario.

### D3. Acceso con Google

`@react-native-google-signin/google-signin` con su config plugin y un client iOS nuevo en el proyecto de beauty. `steward.security.google-client-id` pasa a admitir varios ids, y la audiencia del token debe ser uno de ellos. `/api/auth/config` sigue devolviendo el web para la PWA. El id iOS va por configuración de la app.

Primera tarea de la app: comprobar con un build real qué audiencia trae el token en iOS.

### D4. Acceso con Apple

`expo-apple-authentication`, con `usesAppleSignIn`. `POST /api/auth/apple` recibe `{identityToken, nombre?}`, porque el nombre solo llega la primera vez, y verifica firma con `appleid.apple.com/auth/keys`, emisor, audiencia (el bundle id) y vigencia.

`V10` agrega `usuario.apple_sub` (único, nullable). Se busca primero por `sub`:
- si no existe y el token trae un correo real verificado, se enlaza al usuario con ese correo, para que quien ya usa Google en la PWA llegue a su mismo hogar;
- si no, se crea un usuario. Un correo oculto (`privaterelay.appleid.com`) es un usuario nuevo.

### D5. Eliminar la cuenta

`POST /api/cuenta/eliminar` (con `{appleAuthorizationCode?}`), en una transacción:

1. Sale del hogar con la regla de `DELETE /api/hogar/miembros/yo`. Si era el último miembro, el hogar se borra con todo lo suyo.
2. Se borran su regla de diezmo, sus invitaciones creadas pendientes y sus proyecciones.
3. Si quedan registros suyos en un hogar compartido, la fila de `usuario` se anonimiza: `nombre = 'Ex miembro'`, correo reservado no entregable con su id, y `apple_sub` nulo. Si no quedan, se borra.

Los registros compartidos se conservan: son parte del presupuesto de los otros, y borrarlos cambiaría sus cifras y saldos.

**Revocación de Apple:** sin guardar tokens. Quien entró con Apple se autentica otra vez al eliminar, y el backend cambia ese `authorizationCode` por un token y lo revoca, con la llave `.p8` en variables del VPS. Si Apple falla, la cuenta se elimina igual, se registra el error y no se reintenta; reentrar crea una cuenta nueva y vacía.

La misma acción va en Ajustes de la PWA, con confirmación que pide escribir ELIMINAR y explica qué se borra y qué queda.

**Alternativa descartada: borrar los registros del usuario.** Rompe los saldos y los cierres del otro miembro.

### D6. Pantallas

Se portan una a una desde `features/` de la PWA: mismos puertos, mismos textos y las mismas pruebas de escenario donde aplique. Se conservan las rutas de Expo Router y `ui/`. Nuevas: hojas de ingreso, de gasto, de registro y de registros; detalle de cuenta. `MesDeHoy` usa AsyncStorage.

Acceso: solo Google y Apple, sin Face ID ni correo.

### D7. Invitaciones

No hacen falta universal links: la app lista `misInvitaciones` del correo de la sesión, y el enlace por correo sigue abriendo la PWA. Quien oculta su correo con Apple no coincide con el invitado, así que la pantalla sin hogar muestra su correo de la sesión para que le inviten con ese.

### D8. Aviso a quien viene de la v1

Al primer ingreso, si existe `@steward/budget_v3` y no se ha mostrado el aviso, se explica que esta versión empieza de cero y guarda en la nube, y que los datos anteriores siguen en el teléfono. Solo se comprueba que la clave existe: nunca se escribe ni se borra, y se recuerda con una clave propia.

### D9. Distribución

`app.json` en 2.0.0, un build con el perfil `production`. Primero TestFlight para los dos teléfonos, y el envío a revisión solo con confirmación de Daniel. Las correcciones de la v1 dejan de poder publicarse mientras la ficha 2.0.0 sea la editable.

## Risks / Trade-offs

- **[Quienes usan la v1 pierden de vista sus datos]** → El aviso lo explica y los datos quedan en el teléfono. Una importación futura sigue siendo posible, pero una desinstalación los borra.
- **[Una app pública abre el backend a desconocidos]** → Cada hogar está aislado, pero el VPS se midió para dos personas. Vigilar memoria y base al publicar; no se agregan límites nuevos en este cambio.
- **[Correo oculto y usuarios duplicados]** → Quien use Apple con correo oculto y Google con su correo tendrá dos cuentas. Se documenta en la pantalla sin hogar.
- **[Rechazo en revisión]** → Se revisan la ficha, la privacidad y una cuenta de revisión antes de enviar. Apple puede pedir acceso sin cuenta (5.1.1(v)): la app es un presupuesto compartido en la nube, y la cuenta es parte de su función.
- **[Mover la capa conectada rompe la PWA en producción]** → Va primero y sola, con `conectado.spec.ts` sin cambios de comportamiento.
- **[Las reglas 4.8 y 5.1.1(v) se leyeron de un resumen]** → Verificarlas en la página original antes de enviar a revisión.

## Migration Plan

1. Capa conectada compartida; desplegar la PWA sola.
2. Backend con `V10`: `usuario.apple_sub`, aditiva, con backup antes.
3. Pantallas, acceso y aviso de la app.
4. TestFlight en los dos teléfonos con los datos reales.
5. Envío a revisión, con confirmación.

**Rollback:** antes de publicar, la v1 sigue en la tienda. Una vez aprobada, la 2.0.0 no se puede despublicar sin afectar a quienes ya actualizaron: se corrige con otra versión.

## Open Questions

- ¿Cuántas personas usan la v1? App Store Connect lo dice, y conviene saberlo antes del envío: define cuánto urge una importación.
