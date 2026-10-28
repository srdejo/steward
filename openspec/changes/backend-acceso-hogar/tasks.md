# Tasks

## 1. Esqueleto

- [x] 1.1 Desde `develop`, crear la rama `feature/backend-acceso-hogar`. Confirmar:
  - qué distribución de GraalVM compila Java 26 con Spring Boot 4.1 (GraalVM CE o Liberica NIK), y su imagen Docker;
  - la distribución y la glibc del VPS (`ssh nolost-vps "lsb_release -rs; ldd --version"`), para la imagen de ejecución.
  
  Si ninguna distribución soporta 26, fijar el toolchain en Java 25 (D2). Verificar: las dos imágenes, con su tag exacto, quedan en `backend/docs/DECISIONS.md`.
- [x] 1.2 Crear `backend/` con Gradle wrapper (`gradlew.bat`), paquete `co.com.srdejo.steward` y las dependencias de D1:
  - webflux, validation, data-r2dbc, r2dbc-postgresql, flyway con su driver JDBC, actuator, security y oauth2-resource-server;
  - el plugin `org.graalvm.buildtools.native`;
  - `application.yml` con `DB_*`, `DB_POOL_MAX` (3), `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `CONTACT_API_URL`, `STEWARD_PUBLIC_URL`, el puerto 8099 y el perfil `dev`;
  - `V1__acceso_hogar.sql` con las tablas de D3.
  
  Verificar: `gradlew.bat bootRun` contra la base `steward` en `127.0.0.1:5433` aplica la migración y `GET /actuator/health` responde `{"status":"UP"}`.
- [x] 1.3 Escribir `backend/Dockerfile.native` (dos etapas: build con GraalVM y ejecución con el Debian 13 del VPS, usuario sin privilegios; D2) y `scripts/native-build.ps1` (imagen `steward-native` y binario en `backend/build/native/nativeCompile/steward`; con `-Run`, contenedor con `--cpus=1` y `--memory=160m`, D12).
  - Se escriben ahora, pero no se compila: la compilación nativa es solo para desplegar (D2).
  - Quitar el endpoint temporal `/api/_smoke`: el esqueleto ya se probó en JVM.
  
  Verificar: `docker build --check -f backend/Dockerfile.native backend` sin advertencias, y el parser de PowerShell sin errores en `native-build.ps1`.
- [x] 1.4 Commit del esqueleto.

## 2. Base común del backend

- [x] 2.1 `domain/exception` (`DomainException` con `codigo` y su estado) y `ControllerAdvisor` con el formato de errores de la spec `steward-backend-plataforma`: 400 con `campos`, 401, 404, 409 y 500 sin detalles. Verificar: tests de slice WebFlux para cada estado, incluido el escenario "Error inesperado" sin traza en el cuerpo.
- [x] 2.2 `SecurityConfig`:
  - rutas públicas de D4, las demás autenticadas;
  - 401 en el formato estándar;
  - `ITokenPort` (HS256, TTL configurable de 7 días) y `ICurrentUserPort`;
  - `IClockPort` con zona `America/Bogota`.
  
  Verificar: tests de "Ruta protegida sin sesión", token vencido (reloj fijo a 8 días), token alterado y token firmado con otra clave → 401.
- [x] 2.3 Base de los tests de contrato (D8): clase base con `WebTestClient.bindToServer()` y la base `steward_test` limpia entre tests, que admite `-Dcontract.baseUrl` para apuntar a un proceso externo; perfil `contract` con el decoder de Google de llave local y el `LoggingMailAdapter`. Verificar: un test de contrato de `/actuator/health` pasa en JVM.
- [x] 2.4 `backend/README.md` (comandos, perfiles, variables, tests y build nativo) y `backend/docs/ARCHITECTURE.md` (capas, puertos y la regla de D10 sobre `srdejo-platform`). Commit.

## 3. Acceso

- [x] 3.1 `domain/model/Usuario`, `IUsuarioPersistencePort` con su adaptador R2DBC (`DatabaseClient`, `Persistable`, búsqueda por `lower(email)`) y `IGoogleIdentityPort` con `GoogleIdentityAdapter` (D5). Verificar: tests de integración del adaptador (correo único sin distinguir mayúsculas) y tests del validador de Google: emisor, audiencia, vencido y `email_verified`.
- [x] 3.2 `AuthUseCase` y la API:
  - `GET /api/auth/config`;
  - `POST /api/auth/google` (primera vez crea el usuario; 401 si el token es inválido; 503 `GOOGLE_NO_CONFIGURADO` sin client id);
  - `GET /api/sesion` (usuario, `tieneHogar` y `hogarConfigurado`);
  - `PATCH /api/perfil` (nombre de 1 a 60 caracteres; inicial).
  
  Verificar: tests de contrato de los escenarios de `steward-auth` ("Primera vez", "Token de otra app", "Mayúsculas", "Token vencido", "Hogar sin terminar", "Cambio de nombre").
- [x] 3.3 Documentar los endpoints de acceso en `backend/README.md`. Commit.

## 4. Hogar e invitaciones

- [x] 4.1 `Hogar`, `Miembro`, `IHogarPersistencePort` y `HogarUseCase`, con su API:
  - `POST /api/hogar` (crear; 409 `YA_TIENE_HOGAR`);
  - `GET /api/hogar` (404 `SIN_HOGAR`);
  - `PATCH /api/hogar` (nombre);
  - `POST /api/hogar/onboarding-completo`;
  - `DELETE /api/hogar/miembros/yo` (salir; si es el último, se borran el hogar y sus invitaciones).
  
  Verificar: tests de contrato de "Crear", "Segundo hogar", "Dos miembros", "Terminar onboarding" y "Sale uno de dos".
- [x] 4.2 `Invitacion`, `IInvitacionPersistencePort` (`token_hash` y filtro por `hogar_id`) e `ITokenGeneratorPort` (32 bytes de `SecureRandom` en Base64URL y SHA-256). `IMailPort` con `ContactMailAdapter` (`POST /api/send`, timeout de 5 s, plantilla con el nombre de quien invita y el del hogar) y `LoggingMailAdapter` en `dev` y `contract`. Verificar: test del adaptador de correo contra un servidor HTTP falso (enviado, error 500 y timeout), y test de que en la base no queda el token en claro.
- [x] 4.3 `InvitacionUseCase` y su API:
  - `POST /api/hogar/invitaciones` (201 con `correoEnviado`; 409 `YA_ES_MIEMBRO`; con una pendiente para ese correo, la reenvía);
  - `POST /api/hogar/invitaciones/{id}/reenviar` y `POST /api/hogar/invitaciones/{id}/enlace` (los dos rotan el token y extienden 7 días);
  - `GET /api/invitaciones/{token}` (público; 404 `INVITACION_NO_VALIDA`);
  - `POST /api/invitaciones/{token}/aceptar` (en una transacción; 409 `YA_TIENE_HOGAR` sin consumirla).
  
  Verificar: tests de contrato de "Invitación pendiente", "Correo caído", "Reenviar" (el enlace anterior da 404), "Enlace vencido", "Unirse" y "Ya tiene hogar".
- [x] 4.4 Aislamiento: verificar con tests de contrato el escenario "Invitación ajena" y "Peticiones simultáneas": dos hogares, 50 pares de `GET /api/hogar` concurrentes, cada respuesta con su propio hogar.
- [x] 4.5 Documentar los endpoints de hogar e invitaciones en `backend/README.md`. Commit.

## 5. Preparado para imagen nativa (en JVM)

- [x] 5.1 Tarea de Gradle que corre la batería de contrato con la app en modo AOT de Spring en la JVM (`processAot` y `spring.aot.enabled=true`), sin GraalVM. Los *hints* que falten se agregan en `infrastructure/configuration` (D2). Verificar: todos los tests de contrato pasan en modo AOT, igual que en el modo normal (spec "Preparado para imagen nativa").
- [x] 5.2 Commit.

## 6. PWA en modo conectado

- [x] 6.1 En `packages/domain`, agregar el parámetro opcional `titular` a `crearAdaptadorDemo` (D9). Verificar: los tests del dominio siguen en verde, y un test nuevo comprueba que, con `titular`, "tú" y la inicial salen de ese usuario.
- [x] 6.2 En `frontend/`:
  - `src/app/config/modo.ts` con `fileReplacements`: `production` → conectado y la configuración `demo` → demo;
  - `proxy.conf.json` hacia `localhost:8099` para `ng serve -c conectado`.
  
  Verificar: `ng build -c production` y `ng build -c demo` compilan, y un test confirma qué proveedor de puertos usa cada modo.
- [x] 6.3 `core/datos/http/`:
  - `SesionPort` y la parte de miembros e invitaciones de `HogarPort` sobre `HttpClient`;
  - interceptor de `Bearer` que, ante un 401, borra la sesión y abre Acceso;
  - `providePuertosConectados()`, que compone los puertos con el adaptador demo (con `titular`) y une los `suscribir`.
  
  Verificar: tests con `HttpTestingController` del mapeo de cada endpoint y de errores (409 y 404 con su `codigo`), y un test de que el 401 lleva a Acceso.
- [x] 6.4 Acceso con Google Identity Services: script de GIS cargado si `GET /api/auth/config` trae client id, `credential` a `POST /api/auth/google`, y Face ID y correo deshabilitados con "Próximamente" en modo conectado. Verificar: tests de "Google real, primera vez" (con GIS simulado) y "Opciones aún no disponibles", y "Primera vez" y "Hogar ya configurado" siguen pasando en modo demo.
- [x] 6.5 Onboarding paso 1 (crea o renombra el hogar), paso 5 (invitaciones reales, aviso de copiar el enlace y "el enlace anterior deja de servir" al reenviar) y terminar (onboarding completo en el backend). Verificar: tests de "Hogar creado en el backend" y "Correo no enviado"; los escenarios demo del onboarding siguen pasando.
- [x] 6.6 Invitación recibida en modo conectado: consulta por token, estado "Esta invitación ya no es válida" y login con Google antes de Unirme, volviendo a la invitación. Ajustes: miembros reales, salir del hogar y sin "Probar desde cero". Verificar: tests de "Unirse sin sesión", "Enlace no válido" y "Modo conectado" (`steward-ui-shell`).
- [x] 6.7 Actualizar `frontend/README.md` (modos, `ng serve -c conectado` y cómo pasa un módulo del adaptador demo al HTTP). Commit.

## 7. Entorno local e integración

- [x] 7.1 En el workspace, conectar `infra/local-secrets/steward.env` al programa `steward` de `local-deploy.ps1`, como en recaudo, con:
  - `GOOGLE_CLIENT_ID`: **el mismo client id de beauty** (D5), copiado de `~/apps/beauty/.env` en el VPS. No se crea un OAuth client nuevo;
  - `JWT_SECRET` propio de steward, generado;
  - `CONTACT_API_URL`;
  - `STEWARD_PUBLIC_URL=http://steward.test`.
  
  En ese mismo OAuth client de beauty, Daniel agrega `http://steward.test` como origen autorizado de JavaScript. Verificar: `.\infra\local-deploy.ps1 -Project steward` desde PowerShell nativo, sin `2>&1`, termina en `[OK]`; `http://steward.test/actuator/health` da UP y `http://steward.test/` sirve la PWA (escenario "Mismo origen").
- [x] 7.2 En el workspace, dejar lista la producción nativa **sin encenderla y sin compilar** (D13):
  - `infra/vps/steward/steward.service` nativa: `ExecStart` del enlace `steward` con `-Xmx64m`, `MemoryHigh=128M`, `MemoryMax=160M`, sin `SuccessExitStatus=143` y con el comentario de variables en `CONTACT_API_URL`;
  - `setup-vps.sh` sin cambios de comportamiento, salvo lo que la unit nativa necesite;
  - en `infra/deploy.ps1`, la entrada steward con `BackendMode = "Native"`. El modo `Native`:
    - construye con `steward/scripts/native-build.ps1`;
    - sube el binario a `releases/`, con `chmod +x` y repunte atómico de `steward` y `steward.prev`;
    - reinicia y espera el health por loopback (30 s);
    - si no hay UP, hace rollback automático y no publica la web;
    - deja los últimos 3 binarios;
  - `-Action Rollback` para steward en modo nativo.
  
  `BackendEnabled` sigue en `$false` y no se toca el VPS. Verificar:
  - `bash -n` de los scripts remotos generados;
  - `.\infra\deploy.ps1 -Projects steward -WhatIf` con `BackendEnabled` en `$true` solo en memoria (parámetro de prueba), que muestra los pasos nativos en orden, rollback incluido;
  - con la configuración real, `-WhatIf` sigue mostrando solo la página "Próximamente";
  - `-WhatIf` de otro proyecto con jar (denti-caja) da la misma salida que antes.
- [ ] 7.3 Recorrido de la Etapa 2 en `steward.test` (JVM, `.\infra\local-deploy.ps1 -Project steward`), con dos cuentas de Google:
  1. Daniel entra, crea "Nuestra casa" e invita al correo de la segunda cuenta;
  2. la segunda cuenta abre el enlace (del correo, o del log si contact no corre en local), entra con Google y se une;
  3. los dos ven dos miembros en Ajustes;
  4. el enlace usado da "ya no es válida".
  
  Verificar: el criterio de cierre de la Etapa 2 del ROADMAP, sin errores en la consola.
- [x] 7.4 Documentación:
  - `docs/DEPLOYMENT.md`: backend en local (JVM), variables y modo AOT. Una lista **"Antes de encender el VPS"**, que es la primera compilación nativa real y se hace solo para desplegar:
    - `native-build.ps1` con Docker y nada más abierto, por la memoria;
    - tests de contrato contra el binario con `-Dcontract.baseUrl`;
    - medición con `-Run` (RSS < 120 MB y arranque < 2 s), con las cifras en `DECISIONS.md`;
    - si se quiere, ensayo de `steward.test` sobre el binario: el modo `local-deploy -Native` de D12, que se construye en ese momento.
    
    La sección "VPS" se reescribe con el despliegue nativo de D13:
    - binario sin JDK, con `releases/` y enlaces `steward` y `steward.prev`;
    - unit con `MemoryHigh` y `MemoryMax`;
    - tabla del `.env` (`CONTACT_API_URL` en lugar de `CONTACT_URL`);
    - pasos de `deploy.ps1` con health por loopback y rollback automático;
    - pasos para encenderlo por primera vez.
    
    Debe quedar claro que encenderlo es una decisión aparte. Una sección "Google" deja claro que:
    - steward usa el OAuth client de beauty;
    - los orígenes autorizados son `https://steward.srdejo.com.co` y `http://steward.test`;
    - `GOOGLE_CLIENT_ID` es el mismo valor en `~/apps/beauty/.env`, `~/apps/steward/.env` y `local-secrets/steward.env`;
    - el `JWT_SECRET` no se comparte con beauty;
    - un cambio en ese client afecta a las dos apps;
  - `docs/ROADMAP.md`: marcar la Etapa 2, con la decisión WebFlux + R2DBC y "nativo solo para desplegar". En la Etapa 9, la lista "Antes de encender el VPS";
  - `AGENTS.md`: `backend/` deja de estar "por construir".
  
  Verificar: los comandos documentados se ejecutan tal cual.
- [x] 7.5 En el workspace, anotar en `openspec/changes/optimizar-recursos-plataforma-comun/tasks.md` (junto a la 4.1 y la fase 5) que steward está lista para nativo (pasa el contrato en modo AOT) y es candidata a adoptar los starters. Anotar también que el piloto nativo puede apoyarse en `steward/scripts/native-build.ps1` y en la lección de memoria: compilar solo, con `-J-Xmx5g`. Verificar: la nota cita este cambio y `DECISIONS.md`.
- [x] 7.6 Verificación final:
  - tests de `backend` (JVM y modo AOT), `packages/domain` y `frontend` en verde;
  - `openspec validate backend-acceso-hogar --strict` pasa.
  
  Commit en la rama; merge a `develop` y push solo si Daniel lo pide.
