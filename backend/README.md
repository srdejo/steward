# Presupuesto Hogar · backend

API de steward en Spring Boot 4.1 reactivo (WebFlux + R2DBC), Java 25 y Postgres. Sigue el arquetipo hexagonal del workspace; la estructura está en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) y las decisiones, en [`docs/DECISIONS.md`](docs/DECISIONS.md). El plan está en el cambio OpenSpec `backend-acceso-hogar`.

## Comandos

```powershell
.\gradlew.bat bootRun                 # perfil dev, base steward en 127.0.0.1:5433, puerto 8099
.\gradlew.bat test                    # unitarios + contrato (levanta la app con el perfil contract)
.\gradlew.bat aotTest                 # contrato con la app en modo AOT: lo que necesita la imagen nativa, sin GraalVM
.\gradlew.bat check                   # test + aotTest
.\gradlew.bat bootJar                 # lo que publica local-deploy.ps1
```

Desde la raíz del workspace, `.\infra\local-deploy.ps1 -Project steward` lo publica en `http://steward.test` junto a la PWA.

El primer build descarga el JDK 25 si no está instalado (foojay).

## Perfiles y variables

| Variable | Por defecto | Qué es |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME` | `localhost`, `5433`, `steward` | Postgres (R2DBC para la app, JDBC para Flyway) |
| `DB_USERNAME`, `DB_PASSWORD` | `postgres` | credenciales |
| `DB_POOL_MAX` | `3` | conexiones máximas: el Postgres del VPS es compartido |
| `JWT_SECRET` | en `dev`, uno de desarrollo | secreto de la sesión (64+ caracteres); propio de steward, no se comparte con beauty |
| `GOOGLE_CLIENT_ID` | vacío | el client id de **beauty** (mismo OAuth client). Vacío = login con Google deshabilitado |
| `CONTACT_API_URL` | `http://127.0.0.1:3000` | API `contact` del workspace, por donde salen **todos** los correos |
| `STEWARD_PUBLIC_URL` | `http://steward.test` | origen de los enlaces de invitación |
| `STEWARD_DEV_LOGIN` | `false` (`true` en `dev`) | acceso de desarrollo sin Google; nunca en el VPS |
| `STEWARD_MAIL_MODO` | `contact` (`log` en `dev`) | `log` escribe el enlace de invitación en el log en vez de enviarlo |

Nada se decide con `@Profile` en los beans: la imagen nativa congela esas condiciones al compilar. Los perfiles solo cambian propiedades (`docs/DECISIONS.md`).

| Perfil | Uso |
|---|---|
| `dev` | por defecto en local |
| `prod` | VPS |
| `contract` | **solo tests**: base `steward_test`, secreto conocido, Google con una llave RSA de prueba (`src/test/resources/contract/`) |

## Tests

- **Contrato** (`src/test/java/.../contract`): caja negra por HTTP con `WebTestClient` contra la base `steward_test` de la Postgres local (sin H2). Crear la base una vez: `docker exec local-postgres psql -U postgres -c "CREATE DATABASE steward_test"`. Con `-Dcontract.baseUrl=http://localhost:18099` la misma batería prueba un proceso externo (el binario nativo, antes de desplegar).
- **Unitarios**: adaptadores y casos de uso con dobles de los puertos.

## Imagen nativa (solo para desplegar)

El día a día es en JVM. La compilación nativa se hace solo antes de desplegar al VPS, porque pide de 4 a 8 GB de RAM:

```powershell
.\scripts\native-build.ps1          # imagen steward-native y backend\build\native\nativeCompile\steward
.\scripts\native-build.ps1 -Run     # además la levanta con 1 CPU y 160 MB, como el VPS (puerto 18099)
```

Compilar sin nada más pesado abierto. Ver `docs/DEPLOYMENT.md` del repo ("Antes de encender el VPS").

## API

Errores: `{"codigo": "...", "mensaje": "..."}`; la validación agrega `campos`. Sin sesión o con sesión inválida: 401 `NO_AUTENTICADO`.

### Acceso

| Método y ruta | Sesión | Qué hace |
|---|---|---|
| `GET /api/auth/config` | no | `{"googleClientId": "..." | null, "devLogin": true | false}` |
| `POST /api/auth/dev` | no | **Solo local** (`STEWARD_DEV_LOGIN=true`, encendido en `dev` y `contract`): `{"email", "nombre"}` → la misma sesión que Google. Apagado (VPS): 404 |
| `POST /api/auth/google` | no | `{"idToken"}` de Google Identity Services → `{token, usuario, tieneHogar, hogarConfigurado}`. La primera vez crea el usuario. 401 `GOOGLE_TOKEN_INVALIDO`; 503 `GOOGLE_NO_CONFIGURADO` |
| `GET /api/sesion` | sí | `{usuario, tieneHogar, hogarConfigurado}` |
| `PATCH /api/perfil` | sí | `{"nombre"}` (1 a 60) → usuario con su nueva inicial |

`usuario` = `{id, nombre, email, inicial}`. La sesión es un JWT de 7 días que el cliente envía en `Authorization: Bearer`; cerrar sesión es borrarlo en el cliente.

### Hogar

El hogar siempre es el del usuario de la sesión: no va en la URL. Un usuario pertenece a un solo hogar.

| Método y ruta | Qué hace |
|---|---|
| `POST /api/hogar` | `{"nombre"}` (1 a 60) → 201 con el hogar; 409 `YA_TIENE_HOGAR` |
| `GET /api/hogar` | `{id, nombre, configurado, miembros, invitaciones}`; 404 `SIN_HOGAR` |
| `PATCH /api/hogar` | `{"nombre"}` → el hogar renombrado |
| `POST /api/hogar/onboarding-completo` | 204; desde ahí `hogarConfigurado` es verdadero para todos los miembros |
| `DELETE /api/hogar/miembros/yo` | 204; sus ingresos fijos se desactivan y sus cuentas propias se quitan (la regla de diezmo es suya y se conserva). Si era el último miembro, se borran el hogar y todo lo suyo |
| `PUT /api/hogar/diezmo-en-hoy` | `{"modo": "SEPARADO" \| "AGRUPADO"}` → 204 |

`miembros` = `[{usuario, unidoEn, esActual}]`; `invitaciones` = las pendientes y vigentes, `[{id, email, estado, enviadaEn, expiraEn}]`.

### Invitaciones

El token de una invitación sirve una vez y vence a los 7 días. En la base solo queda su SHA-256, así que **reenviar y copiar el enlace generan un enlace nuevo y el anterior deja de servir**. El correo sale por `contact`; si falla, la invitación queda igual y la respuesta trae `correoEnviado: false` para copiar el enlace. En los perfiles `dev` y `contract` el enlace se escribe en el log en vez de enviarse.

| Método y ruta | Sesión | Qué hace |
|---|---|---|
| `POST /api/hogar/invitaciones` | sí | `{"email"}` → 201 `{invitacion, enlace, correoEnviado}`; si ya había una pendiente para ese correo, la reenvía (200). 409 `YA_ES_MIEMBRO` |
| `POST /api/hogar/invitaciones/{id}/reenviar` | sí | enlace nuevo, 7 días más y correo otra vez; 404 si está aceptada, vencida o es de otro hogar |
| `POST /api/hogar/invitaciones/{id}/enlace` | sí | enlace nuevo para copiar, sin correo |
| `GET /api/invitaciones/{token}` | no | `{hogar, invitadoPor, miembros, email}`; 404 `INVITACION_NO_VALIDA` si no existe, venció o ya se usó (sin distinguir) |
| `POST /api/invitaciones/{token}/aceptar` | sí | `{"nombre", "diezmoAportes"}` → la sesión, ya con hogar; 409 `YA_TIENE_HOGAR` sin consumir la invitación |
| `GET /api/mis-invitaciones` | sí | pendientes y vigentes para el correo de la sesión: `[{id, hogar, invitadoPor, miembros, email}]`. Así quien entra sin el enlace también puede unirse |
| `POST /api/mis-invitaciones/{id}/aceptar` | sí | `{"nombre", "diezmoAportes"}` → la sesión, ya con hogar; 404 `INVITACION_NO_VALIDA` si no es para su correo, venció o ya se usó; 409 `YA_TIENE_HOGAR` |

Con `diezmoAportes: true`, quien se une queda con su regla de diezmo: 10 % del bruto, aplicada a los aportes (si ya tenía regla, solo se activan los aportes).

### Finanzas (ingresos, diezmo y cuentas)

Todo es del hogar de la sesión. Montos en pesos enteros. El mes es siempre **el mes en curso del backend** (`STEWARD_ZONE`, America/Bogota). Las cifras del diezmo son las del dominio compartido (`packages/domain`): porcentaje de la regla **actual** del dueño sobre el bruto o el neto, al peso más cercano.

| Método y ruta | Qué hace |
|---|---|
| `GET /api/finanzas` | `{mes: {anio, mes}, diezmoEnHoy, ingresosFijos, reglas, cuentas, movimientos}`: lo que la PWA superpone a sus datos de prueba. `ingresosFijos` son los activos de todos los miembros; `movimientos`, los del mes en curso. 404 `SIN_HOGAR` |
| `PUT /api/regla-diezmo` | la regla propia: `{"activa", "porcentaje" (0 < p ≤ 100, hasta 2 decimales), "base": "BRUTO" \| "NETO", "aplicaAportes"}` |
| `POST /api/ingresos-fijos` | `{"nombre", "bruto", "neto", "diaPago", "cuentaId"?}` → 201; bruto ≥ neto > 0, día de 1 a 31; 404 `CUENTA_NO_ENCONTRADA` si la cuenta no es del hogar |
| `PUT /api/ingresos-fijos/{id}` | edita un ingreso propio y activo; 404 `INGRESO_NO_ENCONTRADO` si es de otra persona o de otro hogar |
| `DELETE /api/ingresos-fijos/{id}` | 204; lo desactiva (lo ya recibido lo sigue nombrando) |
| `POST /api/ingresos-fijos/{id}/recibido` | "Recibí" (cualquier miembro) → 201 con el movimiento del mes; genera diezmo si el dueño tiene la regla activa. 409 `YA_RECIBIDO` |
| `GET /api/diezmo/pendientes` | `[{id, monto, detalle, usuarioId, fecha}]`, p. ej. `700000` y `10% de Salario Daniel · recibido 25 oct` |
| `POST /api/diezmo/entregas` | `{"obligaciones": [ids], "cuentaId"?}` → 201 con un movimiento por la suma; los ids que no están pendientes se ignoran. 409 `SIN_DIEZMO` si no queda ninguno |
| `POST /api/cuentas` | `{"nombre", "titular": "YO" \| "CONJUNTA", "saldo"}` → 201; nace sin cuadrar. Cuadrar y mover llegan en la Etapa 5 |
