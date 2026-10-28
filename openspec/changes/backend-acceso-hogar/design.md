# Design

## Context

- **Repo steward (rama `develop`)**:
  - `frontend/` y `mobile/` ya implementan las 22 pantallas contra los puertos de `packages/domain/src/ports`: `SesionPort`, `HogarPort`, `IngresosPort`, etc., agrupados en `Puertos`;
  - hoy los cumple el adaptador de prueba (`providePuertosDemo()` en `frontend/src/app/core/datos/puertos.ts`);
  - `backend/` no existe.
- **Workspace**:
  - el arquetipo de los backends es reactivo: Java 26, Spring Boot 4.1, WebFlux + R2DBC, Flyway por JDBC y un módulo hexagonal (cambio paraguas `migrar-portafolio-arquetipo-rx`);
  - la referencia más completa es `denti-caja/backend`: `GoogleIdentityAdapter` (ID token de GIS verificado contra el JWKS de Google), `JwtTokenAdapter` (HMAC con Nimbus), `ContactMailAdapter` (`POST /api/send` a `contact` por loopback) y `ControllerAdvisor`;
  - en denti-caja, la PWA guarda el JWT en `localStorage` y lo envía como `Bearer`.
- **Plataforma común**: `srdejo-platform` y su piloto nativo (`optimizar-recursos-plataforma-comun`, fases 3 y 5) no han empezado. No hay GraalVM instalado en el PC, pero sí Docker.
- **Infra**:
  - `local-deploy.ps1` ya tiene la entrada `steward` con capas opcionales: puerto 8099, base `steward` y `steward.test`; arranca el `bootJar` en `local-java` (JDK 26);
  - la Postgres local está en `127.0.0.1:5433`;
  - en el VPS, `BackendEnabled = $false`.
- **Google**: steward usa el OAuth client de beauty. Falta autorizar `http://steward.test` como origen.

## Goals / Non-Goals

**Goals:**
- Un backend listo para nativo: cada dependencia se elige pensando en la imagen nativa y la batería de contrato pasa en el modo AOT de Spring. El día a día es en JVM. El binario se compila solo para desplegar, porque la compilación nativa pide de 4 a 8 GB de RAM y tumbó Docker en el PC de desarrollo (2026-10-28).
- Que la PWA cambie de adaptador solo en sesión y hogar, sin tocar pantallas fuera de Acceso, Onboarding 1 y 5, Invitación y Ajustes → Hogar.
- Dejar el código común aislado detrás de puertos, para cambiarlo por los starters de `srdejo-platform` sin tocar el dominio.

**Non-Goals:**
- Desplegar en el VPS, medir allí y aplicar el apagado por inactividad: es la Etapa 9.
- Refresh tokens y revocación de sesión.
- La app Expo.

## Decisions

### D1. Estructura del backend
`backend/`, un proyecto Gradle (wrapper con `gradlew.bat`, como espera `local-deploy.ps1`), paquete `co.com.srdejo.steward`, con las capas del arquetipo:

| Capa | Contenido |
|---|---|
| `domain/model` | `Usuario`, `Hogar`, `Miembro`, `Invitacion` (records, sin Spring) |
| `domain/api` + `domain/usecase` | `AuthUseCase` (login con Google, sesión, perfil), `HogarUseCase` (crear, nombrar, onboarding, salir), `InvitacionUseCase` (invitar, reenviar, enlace, consultar, aceptar) |
| `domain/spi` | `IUsuarioPersistencePort`, `IHogarPersistencePort`, `IInvitacionPersistencePort`, `IGoogleIdentityPort`, `ITokenPort`, `IMailPort`, `ICurrentUserPort`, `IClockPort`, `ITokenGeneratorPort` |
| `application` | handlers, DTOs (records) y mappers |
| `infrastructure` | `input/rest` (controllers), `out/r2dbc`, `out/mail`, `security` y `configuration/BeanConfiguration` |

- **Sin MapStruct ni Lombok.** Los DTO y el modelo son `record`, y el mapeo se escribe a mano: son pocos tipos. Así hay menos generación de código y menos reflexión para la imagen nativa. Se aparta de denti-caja a propósito.
- **Sin springdoc.** Su UI usa reflexión y recursos que complican la imagen nativa. El contrato vive en los tests (D8) y en el puerto TypeScript. Se puede agregar más adelante solo en el perfil `dev`.

### D2. GraalVM: compilar en Docker, solo para desplegar, con la versión que soporte el JDK del proyecto
La compilación nativa no forma parte del día a día ni de la verificación de este cambio (Goals). Se ejecuta al preparar un despliegue al VPS.
- **Plugin:** `org.graalvm.buildtools.native` en `build.gradle`; Spring Boot 4.1 genera el AOT (`processAot`) y los *hints*.
- **Compilación:** `backend/Dockerfile.native`, de dos etapas:
  1. **build:** imagen con GraalVM para Linux x86-64 que corre `./gradlew nativeCompile`, con caché de Gradle montada;
  2. **runtime:** imagen `debian:trixie-slim`, la misma distribución y versión que el VPS (Debian 13) (misma glibc y mismas librerías del sistema). Solo copia el binario, sin JVM ni Gradle, y corre como usuario sin privilegios.
  
  `scripts/native-build.ps1` construye la imagen `steward-native` y deja también el binario en `backend/build/native/nativeCompile/steward`, para subirlo al VPS en la Etapa 9. La regla de glibc es la de `optimizar-recursos` D4.
- **Versión:** la primera tarea confirma qué distribución compila Java 26 con Spring Boot 4.1 (GraalVM CE o Liberica NIK). Si ninguna estable soporta 26, el proyecto fija el toolchain en **Java 25** (LTS), que Boot 4.1 soporta. La JVM de `local-java` corre igual ese bytecode. La decisión queda en `backend/docs/DECISIONS.md`.
- **Hints propios:** solo se escriben donde el AOT de Spring no llega, como un recurso de plantilla de correo o una clase por reflexión de Nimbus. Se registran con `RuntimeHintsRegistrar` en `infrastructure/configuration`.
- *Alternativa:* compilar con GraalVM en Windows. Se descarta porque produce un binario de Windows; el VPS necesita uno de Linux.
- *Alternativa:* GitHub Actions. Queda para la Etapa 9 si el build local resulta lento: aquí basta con el PC.

### D3. Persistencia: R2DBC con SQL explícito y ids UUID
Migración `V1__acceso_hogar.sql`:

| Tabla | Columnas | Restricciones |
|---|---|---|
| `usuario` | `id uuid`, `email text`, `nombre text`, `creado_en timestamptz` | índice único sobre `lower(email)` |
| `hogar` | `id uuid`, `nombre text`, `configurado boolean`, `diezmo_en_hoy text` (por defecto `SEPARADO`), `creado_en` | — |
| `miembro` | `hogar_id`, `usuario_id`, `unido_en date`, `diezmo_aportes boolean` | **UNIQUE(`usuario_id`)**: un hogar por usuario, garantizado por la base |
| `invitacion` | `id uuid`, `hogar_id`, `email`, `token_hash`, `estado` (`PENDIENTE`/`ACEPTADA`), `creada_por`, `enviada_en`, `expira_en`, `aceptada_por`, `aceptada_en` | índice parcial único (`hogar_id`, `lower(email)`) donde `estado = 'PENDIENTE'` |

- **Ids:** UUID generados por la app. Las entidades R2DBC implementan `Persistable`, por la lección de `agent-project`.
- **Consultas:** con `DatabaseClient` y SQL a mano, no con repositorios derivados. Las consultas por hogar llevan siempre `hogar_id = :hogar` (D6). Es SQL simple, predecible en nativo y fácil de revisar.
- **Pool:** `DB_POOL_MAX` 3 por defecto, por la convención del Postgres compartido.
- **Flyway:** usa su propia conexión JDBC, como el arquetipo.
- **`diezmo_en_hoy`:** queda en el hogar porque es su atributo. Su lectura y escritura siguen en el adaptador demo hasta la Etapa 3; la columna ya existe para no migrar después.

### D4. Sesión: JWT HMAC de 7 días, en `localStorage`, como el resto del workspace
- **Firma:** `ITokenPort` firma con HS256 y `JWT_SECRET` de 64 o más caracteres. Claims: `sub` (id de usuario), `iat` y `exp` (7 días); `jti` no hace falta.
- **Validación:** `SecurityWebFilterChain` con `oauth2ResourceServer().jwt()` y un `NimbusReactiveJwtDecoder` con la misma clave. `ICurrentUserPort` lee el `sub` del `ReactiveSecurityContextHolder`.
- **Rutas públicas:** `/actuator/health`, `POST /api/auth/google`, `GET /api/auth/config` y `GET /api/invitaciones/{token}`.
- *Por qué 7 días y no 12 h como denti-caja:* es un presupuesto que se abre pocas veces por semana desde el teléfono, y no hay refresh en esta etapa. El riesgo de un token en `localStorage` se acota con la CSP del vhost y sin HTML de usuarios. El TTL es configurable (`steward.security.jwt-ttl`).
- *Alternativa:* cookie HttpOnly. Protege mejor contra XSS, pero la app Expo necesita bearer y habría dos mecanismos. Queda para cuando llegue `platform-security`, que lo decidirá para todas las apps.
- *Alternativa:* refresh tokens. Se pospone porque exige guardar estado de sesión.

### D5. Google: ID token de GIS verificado contra el JWKS
Igual que `denti-caja/GoogleIdentityAdapter`: `NimbusReactiveJwtDecoder.withJwkSetUri(GOOGLE_JWKS)` con validadores de emisor, audiencia (`GOOGLE_CLIENT_ID`), vigencia y `email_verified`.
- **Misma cuenta de Google que beauty.** Steward no tiene OAuth client propio: usa el client "Aplicación web" de beauty.
  - `GOOGLE_CLIENT_ID` es el mismo valor en `~/apps/beauty/.env`, `~/apps/steward/.env` (ya puesto el 2026-10-26) y `infra/local-secrets/steward.env`.
  - En ese client, los orígenes autorizados de JavaScript incluyen `https://steward.srdejo.com.co` (ya está) y `http://steward.test` (lo agrega Daniel en la tarea 7.1).
  - GIS solo usa el client id: no hay client secret que compartir.
  - La sesión de steward es independiente de la de beauty: cada app tiene su propio `JWT_SECRET`, y un token de una no sirve en la otra.
  - *Consecuencia:* la pantalla de consentimiento de Google muestra el nombre y el logo que tenga ese client. Cambiarlos, o rotar el client, afecta a las dos apps. Queda escrito en `docs/DEPLOYMENT.md`.
- **Acceso de desarrollo (local).** Google no acepta `http://steward.test` como origen: solo dominios públicos o `localhost`. Para el recorrido local, `POST /api/auth/dev` (`{email, nombre}`) emite la misma sesión que Google.
  - Se enciende con la propiedad `steward.security.dev-login`: apagada por defecto, encendida en los perfiles `dev` y `contract`. `local-deploy.ps1` la pone con `STEWARD_DEV_LOGIN=true`.
  - El VPS corre con el perfil `prod` y sin esa variable, así que queda apagada. Apagada, la ruta responde 404 como si no existiera y no crea nada.
  - Es una propiedad leída al arrancar, no un `@Profile`, por la regla de AOT (D2). Al arrancar con el acceso encendido, el backend lo avisa en el log con WARN.
  - `GET /api/auth/config` devuelve `devLogin`; la PWA muestra "Entrar como…" (correo y nombre) solo si es verdadero.
  - *Alternativa:* Google con `ng serve` en `http://localhost:4200`. Se descarta para el recorrido porque no pasa por `steward.test` ni por `local-java`, y exige dos cuentas de Google.
- Sin client id, `GET /api/auth/config` responde `{"googleClientId": null}` y el login responde 503 (spec).
- En la PWA, el botón de Google Identity Services se carga con `https://accounts.google.com/gsi/client` cuando hay client id, y entrega el `credential` (ID token) a `POST /api/auth/google`.
- Los tests usan un decoder con llave RSA local (`GoogleIdentityAdapter.validator(...)` aplicado a tokens firmados en el test). Así no se depende de Google.

### D6. Aislamiento: el hogar se resuelve siempre desde el usuario de la sesión
No hay tenant en la URL. Cada caso de uso:
1. obtiene el usuario de `ICurrentUserPort`;
2. carga su `miembro` (o responde `SIN_HOGAR`);
3. pasa ese `hogarId` a cada consulta.

Las rutas son de "mi hogar" (`/api/hogar`, `/api/hogar/invitaciones/{id}`), y cada consulta de invitación por id filtra por `hogar_id`. Si una invitación es de otro hogar, el resultado es vacío y la respuesta, 404. No hace falta un `WebFilter` de tenant: el usuario sale del `SecurityContext`, que viaja en el `Context` de Reactor. El test de peticiones simultáneas de la spec cubre la propagación.

### D7. Invitaciones
- **Token:** 32 bytes de `SecureRandom` en Base64URL. En la base se guarda solo su SHA-256 (`token_hash`), como `Sha256TokenHasher` de denti-caja, así que un volcado de la base no sirve para unirse.
  - El enlace para copiar se arma cuando se crea o se reenvía. Como el token en claro no se guarda, "obtener enlace" de una invitación existente **rota el token**: genera uno nuevo y actualiza el hash. Lo mismo pasa al reenviar, y el enlace anterior deja de servir (spec `steward-hogar`).
  - *Alternativa:* guardar el token cifrado para reenviar siempre el mismo enlace. Se descarta: suma una clave de cifrado que custodiar a cambio de poco.
- **Origen del enlace:** `steward.public-url` (`http://steward.test` en local, `https://steward.srdejo.com.co` en el VPS).
- **Correo, siempre por `contact`:** el backend no envía correos por su cuenta: no hay SMTP, `spring-boot-starter-mail` ni credenciales de correo. `IMailPort` tiene una sola implementación real, `ContactMailAdapter`, que llama a `POST {CONTACT_API_URL}/api/send` (WebClient, timeout de 5 s) con destinatario, asunto, el cuerpo HTML y el nombre del remitente "Presupuesto Hogar". `contact` es quien entrega el correo. Si falla, se registra en el log y el caso de uso devuelve `correoEnviado: false`, sin revertir la invitación. En `dev` hay `LoggingMailAdapter`, que escribe el enlace en el log, como `CodeLoggingMailAdapter` de denti-caja.
- **Aceptar:** en una transacción (`TransactionalOperator`): validar el token (hash, `PENDIENTE` y vigencia), insertar el `miembro` y marcar la invitación `ACEPTADA`. Si el usuario ya tiene hogar, el UNIQUE de `miembro.usuario_id` falla; se traduce a 409 `YA_TIENE_HOGAR` y la transacción se revierte sin consumir la invitación.
- **Salir:** en una transacción. Se borra el miembro; si no quedan miembros, se borran las invitaciones y el hogar.

### D8. Tests: contrato caja negra contra Postgres real, reutilizables contra el binario
- **Contrato:** `@SpringBootTest(webEnvironment = RANDOM_PORT)` con `WebTestClient.bindToServer()` contra la base `steward_test` de la Postgres local (`127.0.0.1:5433`). Sin H2: la lección de `agent-project` es que H2 no se comporta como Postgres. La base se limpia entre tests.
- **Binario:** la misma clase de contrato corre contra una URL externa (`-Dcontract.baseUrl=http://localhost:8099`), para probar el binario nativo levantado por `native-build.ps1 -Run`.
- **Login en los tests:** el decoder de Google se reemplaza por uno con llave local (D5), así que el flujo sigue siendo HTTP real. El binario no se puede reconfigurar así: se arranca con el perfil `contract`, que activa ese mismo decoder de prueba y el `LoggingMailAdapter`. Ese perfil no está en los perfiles de producción.
- **Modo AOT en la JVM:** una tarea de Gradle corre la misma batería con la app en modo AOT (`processAot` y `spring.aot.enabled=true`). Hace la misma preparación que la imagen nativa (beans resueltos en build y *hints* de reflexión), pero sin GraalVM y con la memoria de un build normal. Es la red de seguridad del día a día para no descubrir todo al desplegar.
- **Contra el binario:** solo antes de desplegar (lista "Antes de encender el VPS" de `DEPLOYMENT.md`).
- **Unitarios:** los casos de uso se prueban con dobles de los puertos (reloj fijo, tokens deterministas).

### D9. PWA: adaptador HTTP compuesto con el de prueba
- **Puertos HTTP:** `frontend/src/app/core/datos/http/` implementa `SesionPort` y `HogarPort` con `HttpClient` (y `firstValueFrom`, porque los puertos son `Promise`). Un interceptor agrega el `Bearer` y, ante un 401, borra la sesión y lleva a Acceso.
- **Composición:** `providePuertosConectados()` arma un `Puertos` que toma `sesion` y la parte de miembros e invitaciones de `hogar` del adaptador HTTP; `ingresos`, `plan`, `movimientos`, `cuentas`, `cierre`, `categorias`, `definirDiezmoEnHoy` y `demo` (sin `probarDesdeCero`) vienen del adaptador de prueba; `suscribir` une los avisos de los dos.
- **Usuario en los datos de prueba:** el adaptador demo sigue con sus usuarios de ejemplo. Para que "tú" y las iniciales cuadren en esas pantallas, se le pasa el usuario real como titular de la semilla. Esto pide un parámetro opcional `titular` en `crearAdaptadorDemo`. Es el único cambio en `packages/domain`, aditivo y sin efecto en las reglas.
- **Modo:** una configuración del build (`src/app/config/modo.ts`, reemplazado por `fileReplacements`):
  - `production` → conectado;
  - `demo` → solo demo.
  
  `local-deploy.ps1` sigue usando `production`. `ng serve` usa `demo` por defecto y `proxy.conf.json` hacia `localhost:8099` en la configuración `conectado`.
- **Pantallas que cambian:**
  - Acceso: botón de GIS, y Face ID y correo deshabilitados;
  - Onboarding 1: crea o renombra el hogar;
  - Onboarding 5: invita, y muestra el aviso de copiar el enlace si el correo no salió;
  - Invitación: estado no válido y login antes de Unirme, guardando la ruta de vuelta;
  - Ajustes: sin "Probar desde cero" en modo conectado.
  
  Las demás pantallas no se tocan (spec `steward-ui-shell` "Datos detrás de puertos").

### D10. Código común propio, listo para `srdejo-platform`
Seguridad (`SecurityConfig`, adaptadores de Google y JWT), errores (`ControllerAdvisor` y `DomainException` con `codigo`) y correo viven en `infrastructure` y solo se ven a través de puertos de `domain/spi`. El reemplazo futuro cambia `infrastructure` y `BeanConfiguration`, sin tocar `domain` ni `application`. La tarea final lo anota en el `tasks.md` de `optimizar-recursos-plataforma-comun` del workspace, junto a la tarea 4.1: steward es candidata a adoptar los starters con denti-caja.

### D11. Despliegue local
- `local-deploy.ps1 -Project steward` ya construye `backend/` cuando existe `gradlew.bat`, y arranca el jar en `local-java` en el puerto 8099.
- Se conecta `infra/local-secrets/steward.env` al programa `steward`, con `GOOGLE_CLIENT_ID` (el de beauty, D5), `JWT_SECRET`, `CONTACT_API_URL` y `STEWARD_PUBLIC_URL`, siguiendo el patrón de recaudo y subscription-hub.
- La base `steward` ya existe en local.
- En local corre la JVM. El modo `-Native` de D12 es el ensayo previo al despliegue y se construye en la Etapa 9.

### D12. Simular el VPS en local con el contenedor nativo (solo antes de desplegar)
Todo D12 se usa solo al preparar un despliegue nativo, nunca en el día a día. En este cambio se escribe `native-build.ps1 -Run`. El modo `local-deploy -Native` queda descrito aquí y se construye en la Etapa 9, con la primera compilación nativa.
- **`native-build.ps1 -Run`:** levanta `steward-native` en la red `local-network`, con el nombre `local-steward-native`, el perfil y las variables pedidas, y estos límites:
  - `--cpus=1` (el VPS tiene 1 vCPU), para que el tiempo de arranque sea representativo;
  - `--memory=160m`, el `MemoryMax` que tendría la app en el VPS con un presupuesto de 128 MB (`optimizar-recursos` D2: 1,25 × presupuesto). Si se pasa, el contenedor muere, como pasaría con systemd. Es configurable con `-MemoryMb`;
  - el binario arranca con `-Xmx64m`, porque la imagen nativa toma por defecto un porcentaje de la memoria visible.
- **`local-deploy.ps1 -Project steward -Native`:**
  1. construye la imagen con `native-build.ps1`;
  2. detiene el programa `steward` de `local-java` (`supervisorctl stop`) y levanta `local-steward-native` con los límites anteriores y las variables de `local-secrets/steward.env`;
  3. reescribe `infra/nginx/conf.d/steward-backend.inc` (`set $steward_backend http://local-steward-native:8099;`) y recarga nginx.
  
  Sin `-Native`, el mismo script vuelve a `http://java:8099`, borra el contenedor nativo y arranca el programa en `local-java`. El bloque `steward.test` de `local.conf` pasa a `proxy_pass $steward_backend`, con `resolver 127.0.0.11` (el DNS de Docker) para que nginx no falle si el contenedor no existe al arrancar.
  - *Alternativa:* un alias de red compartido entre `local-java` y el contenedor nativo. Se descarta porque el DNS de Docker devolvería los dos y nginx alternaría entre JVM y binario.
- **Medición:** `docker stats --no-stream local-steward-native` (RSS dentro del tope) y el tiempo hasta UP desde el log. Son las cifras de la spec "Imagen nativa", tomadas con las restricciones del VPS.

### D13. Producción en `nolost-vps` con el binario nativo
Este cambio deja hechos la unit nativa y el modo `Native` de `deploy.ps1`, probados con `-WhatIf` (tarea 7.3). Pero **no enciende** el backend en el VPS: `BackendEnabled` sigue en `$false` y no se sube nada. Encenderlo es una decisión aparte (Etapa 9 del ROADMAP), porque publica la PWA a usuarios reales con módulos todavía en datos de prueba. Cuando se encienda, el despliegue es así:

**Qué corre en el VPS**
- Un binario Linux, sin JDK. No se usan `/home/srdejo/opt/jdk-26` ni los drop-ins `java26/`, `jvm/` (`JAVA_TOOL_OPTIONS` y caché AOT) ni `db-pool/` (Hikari): el pool es de R2DBC y se limita con `DB_POOL_MAX=3`.
- Flyway corre dentro del binario al arrancar, contra `127.0.0.1:5432`.
- El VPS no compila nada. El binario sale del PC (`scripts/native-build.ps1`), de la imagen de ejecución alineada con el Debian 13 del VPS (D2): el mismo que se probó con `local-deploy -Native` (D12).

**Archivos en `~/apps/steward/`**

| Archivo | Qué es |
|---|---|
| `releases/steward-<fecha>-<commit>` | cada binario subido |
| `steward` | enlace simbólico a la versión activa |
| `steward.prev` | enlace simbólico a la versión anterior, para el rollback |
| `.env` | variables, permisos 600 (abajo) |
| `frontend/` | la PWA, servida por nginx como hoy |

**Unit `steward.service` (versión nativa, en `infra/vps/steward/`)**
- `ExecStart=/home/srdejo/apps/steward/steward -Xmx64m --spring.profiles.active=prod --server.port=8099 --server.address=127.0.0.1`
- `MemoryHigh=128M` y `MemoryMax=160M`: el presupuesto de `optimizar-recursos` D2, el mismo tope que en local.
- Se mantienen el `EnvironmentFile`, `TZ`, `Restart=always` y el hardening actual. Se quita `SuccessExitStatus=143`, que era de la JVM.
- Daniel la instala una vez con `setup-vps.sh` (sudo). Los reinicios usan la regla de sudoers que ya existe (`systemctl restart steward`).

**`.env` de producción**

| Variable | Valor |
|---|---|
| `DB_URL` | `r2dbc:postgresql://127.0.0.1:5432/steward` (más `DB_USERNAME` y `DB_PASSWORD` del rol `steward`) |
| `DB_POOL_MAX` | `3` |
| `JWT_SECRET` | propio de steward, de 64 o más caracteres |
| `GOOGLE_CLIENT_ID` | el de beauty (D5) |
| `CONTACT_API_URL` | `http://127.0.0.1:3000` |
| `STEWARD_PUBLIC_URL` | `https://steward.srdejo.com.co` |

`CONTACT_API_URL` reemplaza el `CONTACT_URL` que hoy citan la unit y `DEPLOYMENT.md`.

**`deploy.ps1 -Projects steward`, con `BackendMode = "Native"` en la entrada de steward**
1. Si la versión trae migraciones, antes: `-Action Backup`, verificando el `.sql.gz`.
2. Build local: `scripts/native-build.ps1` deja el binario, y `ng build -c production` deja la PWA en modo conectado.
3. `scp` del binario a `releases/`, `chmod +x`, y repunte atómico de los enlaces (`steward.prev` ← activo, `steward` ← nuevo).
4. `sudo systemctl restart steward` y espera de `curl -fs http://127.0.0.1:8099/actuator/health` por SSH (loopback), hasta 30 s.
5. Si no responde UP: rollback automático (`steward` ← `steward.prev`, restart) y el deploy termina en error, sin publicar la web nueva.
6. Si responde: publica la PWA y verifica `https://steward.srdejo.com.co/actuator/health` desde fuera.
7. Deja solo los últimos 3 binarios en `releases/`.

`-Action Rollback` repite el paso 5 a mano. Una migración aditiva no se deshace.

**Encender por primera vez (cuando se decida)**
1. Subir la unit nativa y correr `setup-vps.sh` (Daniel, con sudo).
2. Completar el `.env` con la tabla de arriba.
3. Poner `BackendEnabled = $true` en `deploy.ps1`.
4. `ssh -t nolost-vps "sudo systemctl enable steward"`.
5. `.\infra\deploy.ps1 -Projects steward`.
6. Medir con `infra/vps/resources/measure.sh` y anotar la memoria real en `PORTS.md`. Así 8099 pasa de reservado a desplegado.

**Después:** con arranques de menos de 2 s, steward puede usar el apagado por inactividad de `optimizar-recursos` D5 (activación por socket). Se evalúa con el tráfico real; no es parte de este cambio.

- *Alternativa:* Docker en el VPS. Se descarta porque el VPS no corre contenedores para las apps y el demonio de Docker consumiría la memoria que se busca ahorrar. El contenedor solo se usa en el PC, para compilar y simular.
- *Alternativa:* seguir con el jar en la JVM. Se descarta porque son unos 300 MB frente a menos de 120 MB, y es la razón por la que el backend está reservado.

## Risks / Trade-offs

- [GraalVM sin soporte estable para Java 26 + Boot 4.1] → D2: fijar el toolchain en Java 25 y dejarlo registrado. El código no usa APIs exclusivas de 26.
- [Algo falla solo en nativo y se descubre al preparar el despliegue] → El contrato en modo AOT de Spring (D8) detecta la mayoría de estos problemas. Lo que quede, como reflexión de una librería que el AOT no ve, se arregla con un *hint* en la lista "Antes de encender el VPS", antes de tocar producción.
- [El build nativo es lento y pesado (4–8 GB de RAM, minutos): el 2026-10-28 dejó al PC sin memoria y tumbó Docker] → Solo se compila para desplegar, con `-J-Xmx5g`, sin otras compilaciones en paralelo y con lo demás cerrado.
- [`steward.test` queda apuntando al backend equivocado tras cambiar de modo] → `local-deploy.ps1` escribe `steward-backend.inc` y recarga nginx en los dos modos, y termina con un `GET /actuator/health` a `steward.test`. El modo activo se imprime en el resumen.
- [El contenedor de Debian no es idéntico al VPS (kernel, systemd)] → Se acepta. Lo que importa para el binario es la glibc y las librerías, y esas coinciden. El kernel y systemd se prueban en la Etapa 9.
- [Token de 7 días en `localStorage`] → D4: CSP, sin HTML de usuarios y TTL configurable. Se revisa con `platform-security`.
- [Pantallas que mezclan datos reales (miembros) y de prueba (Hoy)] → D9, más el aviso "Datos de prueba" visible. Es temporal: cada etapa siguiente pasa un módulo al backend.
- [Steward diverge de denti-caja antes de que exista `srdejo-platform`] → D10: el código común queda en `infrastructure` y detrás de puertos, y la extracción queda anotada en el cambio del workspace.
- [Rotar el token al copiar o reenviar invalida enlaces ya compartidos] → Se acepta. La UI lo advierte al copiar o reenviar ("el enlace anterior deja de servir").

## Migration Plan

1. Rama de trabajo desde `develop`.
2. Esqueleto con todas las dependencias, en JVM.
3. Dominio, persistencia y API con tests de contrato en JVM.
4. Contrato en modo AOT de Spring (listo para nativo, sin compilar).
5. PWA en modo conectado y `local-deploy.ps1 -Project steward`.
6. Recorrido de la Etapa 2 en `steward.test` (JVM) con dos cuentas de Google.
7. Etapa 9, cuando se decida encender: la lista "Antes de encender el VPS" (compilación nativa, contrato contra el binario, medición y ensayo con `-Native`) y después D13.

**Rollback**: no hay nada en producción. En local, sin `backend/` la web vuelve a "Próximamente". La configuración `demo` de la PWA sigue disponible.

