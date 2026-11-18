## Context

- **Datos**: el backend ya guarda todo lo que tiene fecha:
  - `dia_pago` de ítems e ingresos fijos (V2, V8);
  - `dia_corte` y `dia_pago` de tarjetas (V12);
  - `dia_pago` de créditos (V5, V12);
  - el estado del cuadre de cuentas.
- **Infraestructura existente**:
  - el correo sale por la API `contact` (`infrastructure/out/mail`, `steward.contact-api-url`);
  - la imagen nativa de GraalVM es la que corre en producción (`gradlew check` corre el contrato en AOT);
  - no hay tareas programadas.
- **PWA**: tiene service worker de Angular (`core/actualizacion.ts` usa `SwUpdate`).
- **App**: no tiene `expo-notifications`.
- **Rediseño**: este cambio va después de `rediseno-libreta-clara` y usa sus tokens y su shell (la campana en Hoy y Agregar en el menú lateral).

## Goals / Non-Goals

**Goals:**
- Una sola regla de "qué se avisa y cuándo" en el backend, que alimenta el push, el correo y la pantalla Avisos en modo conectado.
- Envío idempotente: un reinicio o una corrida repetida no duplica avisos.
- Que todo funcione en la imagen nativa sin librerías con reflexión pesada.

**Non-Goals:**
- Responsable por pago ("A quien paga") y aviso propio por ítem: no existen en el modelo (ver la propuesta).
- Android y Google Play: la app solo se distribuye en iPhone.
- SMS o WhatsApp.

## Decisions

- **D1 · El backend calcula; el dominio solo para el modo demo.**
  - `AvisosUseCase.proximos(hogar, hoy, dias)` calcula los avisos con las reglas del requisito "Qué se avisa", y sirve tanto a `GET /api/avisos/proximos` como al programador.
  - En modo conectado, la PWA y la app leen esa lista mediante un `AvisosPort` nuevo del dominio.
  - En modo demo, `packages/domain` tiene la misma regla en TS, con pruebas que usan los mismos casos que el contrato del backend.
  - *Alternativa:* calcular en el cliente también en modo conectado. Se descarta: el push y el correo necesitan el backend de todos modos, y dos fuentes se desvían.
- **D2 · Programador cada 15 minutos con registro de enviados.**
  - Un `@Scheduled(cron = "0 */15 * * * *", zone = "America/Bogota")` busca a las personas a las que les toca un momento, sea a las 8:00 o al terminar su no molestar.
  - Reúne sus avisos de ese momento en un mensaje y lo envía por cada canal activo.
  - Para no repetir, guarda cada aviso en `aviso_enviado (usuario_id, clave, momento)` con restricción única, donde `clave = tipo:item:mes` y `momento = ANTES|DIA|VENCIDO|POSPUESTO|SEMANAL`. Inserta antes de enviar y se salta lo que ya existe.
  - El VPS corre una sola instancia, así que no hace falta un lock distribuido.
  - *Alternativa:* una cola con tareas por aviso. Sobra para dos usuarios.
- **D3 · Push de la app por la API de Expo.**
  - `WebClient` a `https://exp.host/--/api/v2/push/send` con `categoryId: "pago"`, que define las acciones en la app.
  - Los recibos se revisan en la corrida siguiente (`/getReceipts`); `DeviceNotRegistered` quita el dispositivo.
  - Usa el token de acceso de Expo si el proyecto lo exige.
  - *Alternativa:* APNs directo con HTTP/2 y JWT. Más código y manejo de certificados, sin beneficio aquí.
- **D4 · Web Push con la criptografía del JDK.**
  - La firma VAPID es un JWT ES256 con `java.security`; el cifrado del contenido sigue RFC 8291 (ECDH P-256, HKDF y AES-128-GCM, `aes128gcm`) con `javax.crypto`.
  - Son unas 200 líneas en `infrastructure/out/push`, probadas contra los vectores del RFC.
  - *Alternativa:* `nl.martijndwars:web-push` con BouncyCastle. Pide configuración de reflexión para la imagen nativa y arrastra una dependencia grande.
- **D5 · Acciones del aviso con un identificador firmado.**
  - El contenido del aviso lleva `accion = base64url(json{u,h,item,mes,accion,exp}) + "." + HMAC-SHA256`, con la clave `AVISOS_SECRET`.
  - `POST /api/avisos/accion` lo valida sin sesión, lo cual habilita el service worker y las acciones de iOS sin la app abierta.
  - "Ya lo pagué" llama al mismo caso de uso que Marcar pago, con el valor del plan, sin cuenta y con la persona del identificador. El aviso de duplicado se vuelve un no-op.
  - *Alternativa:* exigir sesión. En segundo plano la app y el service worker no siempre tienen el token.
- **D6 · Preferencias con valores por defecto en código.**
  - La tabla `preferencia_aviso (usuario_id PK, dias_antes, tipos_apagados text[], correo, no_molestar)` solo tiene fila cuando la persona guarda algo.
  - Sin fila, rigen los valores por defecto del requisito "Avisos · Configurar".
- **D7 · Aviso de lo que marca el otro.**
  - Al registrarse un pago o un aporte, el caso de uso publica un evento en memoria (`Sinks.Many`).
  - El servicio de avisos lo envía de inmediato al otro miembro, respetando su no molestar y sus tipos, y lo deja en `aviso_enviado` con `momento = ACTIVIDAD`.
- **D8 · La app.**
  - `expo-notifications` con la categoría `pago` y sus acciones `pagado` y `manana`, que se ejecutan sin abrir la app y llaman a `/api/avisos/accion`.
  - El permiso se pide al activar en Configurar.
  - El token se registra con `getExpoPushTokenAsync({ projectId })` y se quita en `cerrarSesion`.
  - Necesita la capacidad Push Notifications en el perfil de Apple (EAS) y un build nuevo.
  - Antes de escribir código se lee la documentación de Expo SDK 57.
- **D9 · La PWA.**
  - `SwPush.requestSubscription({ serverPublicKey })`.
  - El clic y las acciones se manejan en un `ngsw` extendido (`importScripts` de un `avisos-sw.js` propio) que hace `fetch` a `/api/avisos/accion` o abre `/avisos`.
  - En iOS se detecta `navigator.standalone` para mostrar el texto de la pantalla de inicio.

## Risks / Trade-offs

- **[Días de pago 29–31 en meses cortos]** → se usa el último día del mes, la misma regla que ya aplica el plan.
- **[El programador corre mientras se despliega]** → la tabla de enviados evita duplicados; un momento perdido durante un reinicio se recupera en la corrida siguiente, porque se envía todo lo que tocaba y no se envió ese día.
- **[Web Push en iOS es limitado]** (solo PWA instalada, acciones no siempre visibles) → el texto en Configurar lo dice, y tocar el aviso siempre abre Avisos.
- **[Expo cambia su API o pide token]** → el cliente queda detrás de un puerto (`EnvioPushPort`), con el token por variable de entorno.
- **[Un identificador de acción filtrado permite marcar un pago]** → solo esa acción sobre ese ítem y mes, por 7 días y sin datos sensibles; el pago se puede corregir o borrar.

## Migration Plan

1. V17 crea `dispositivo_aviso`, `preferencia_aviso` y `aviso_enviado`, sin tocar datos existentes.
2. Variables nuevas en el VPS: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `AVISOS_SECRET` y, si hace falta, `EXPO_ACCESS_TOKEN`. Las genera Daniel; no se leen ni se imprimen desde aquí.
3. Respaldo, backend, PWA y app (versión siguiente a la del rediseño), cada paso con confirmación de Daniel.
4. Rollback:
   - el programador se apaga con `steward.avisos.habilitados=false`;
   - las tablas nuevas no afectan nada más.

## Open Questions

- ¿El proyecto de Expo exige token de acceso para el push? Se confirma al configurar el envío; solo agrega una variable.
