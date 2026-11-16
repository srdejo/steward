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
| `POST /api/auth/google` | no | `{"idToken"}` de Google, con audiencia el client web o el iOS → `{token, usuario, tieneHogar, hogarConfigurado}`. La primera vez crea el usuario. 401 `GOOGLE_TOKEN_INVALIDO`; 503 `GOOGLE_NO_CONFIGURADO` |
| `POST /api/auth/apple` | no | `{"identityToken", "nombre"?}` de Sign in with Apple → igual que Google. Busca por el identificador de Apple y, la primera vez, por su correo verificado; si no, crea el usuario. 401 `APPLE_TOKEN_INVALIDO` |
| `GET /api/sesion` | sí | `{usuario, tieneHogar, hogarConfigurado}` |
| `PATCH /api/perfil` | sí | `{"nombre"}` (1 a 60) → usuario con su nueva inicial |

`usuario` = `{id, nombre, email, inicial}`. La sesión es un JWT de 7 días que el cliente envía en `Authorization: Bearer`; cerrar sesión es borrarlo en el cliente.

### Hogar

El hogar siempre es el del usuario de la sesión: no va en la URL. Un usuario pertenece a un solo hogar.

| Método y ruta | Qué hace |
|---|---|
| `POST /api/cuenta/eliminar` | "Eliminar mi cuenta": cuerpo opcional `{"appleAuthorizationCode"}` → 204. Sale de su hogar (si era el último miembro, el hogar se borra), borra su regla, sus proyecciones y sus invitaciones pendientes, y borra el usuario; si quedan registros suyos en un hogar compartido, lo anonimiza como "Ex miembro". Con el código, revoca su acceso con Apple; un fallo de Apple no la impide. Su sesión deja de valer (401) |
| `POST /api/hogar` | `{"nombre"}` (1 a 60) → 201 con el hogar; 409 `YA_TIENE_HOGAR` |
| `GET /api/hogar` | `{id, nombre, configurado, miembros, invitaciones}`; 404 `SIN_HOGAR` |
| `PATCH /api/hogar` | `{"nombre"}` → el hogar renombrado |
| `POST /api/hogar/onboarding-completo` | 204; desde ahí `hogarConfigurado` es verdadero para todos los miembros |
| `DELETE /api/hogar/miembros/yo` | 204; sus ingresos fijos se desactivan y sus cuentas propias se quitan (la regla de diezmo es suya y se conserva). Si era el último miembro, se borran el hogar y todo lo suyo |

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

### Finanzas (ingresos, diezmo, cuentas y créditos)

Todo es del hogar de la sesión. Montos en pesos enteros. El mes es siempre **el mes en curso del backend** (`STEWARD_ZONE`, America/Bogota). El diezmo es un gasto del plan: cada ingreso con regla tiene su ítem de tipo `DIEZMO` en la categoría del sistema "Diezmo", con el monto que sugiere la regla de su dueño (porcentaje sobre el bruto o el neto, al peso más cercano, como el dominio compartido `packages/domain`), y se marca con "Marcar pago" como cualquier ítem (cambio `diezmo-como-gasto`).

| Método y ruta | Qué hace |
|---|---|
| `GET /api/finanzas` | `{mes: {anio, mes}, categorias, ingresosFijos, reglas, cuentas, planes, movimientos, creditos, cierres, anuales, proyecciones, tarjetas}`: lo que la PWA superpone a sus datos de prueba. `ingresosFijos` son los activos de todos los miembros. 404 `SIN_HOGAR` |
| `PUT /api/regla-diezmo` | la regla propia: `{"activa", "porcentaje" (0 < p ≤ 100, hasta 2 decimales), "base": "BRUTO" \| "NETO", "aplicaAportes"}` |
| `POST /api/ingresos-fijos` | `{"nombre", "bruto", "neto", "diaPago", "cuentaId"?}` → 201; bruto ≥ neto > 0, día de 1 a 31; 404 `CUENTA_NO_ENCONTRADA` si la cuenta no es del hogar |
| `PUT /api/ingresos-fijos/{id}` | edita un ingreso propio y activo; 404 `INGRESO_NO_ENCONTRADO` si es de otra persona o de otro hogar |
| `DELETE /api/ingresos-fijos/{id}` | 204; lo desactiva (lo ya recibido lo sigue nombrando) |
| `POST /api/ingresos-fijos/{id}/recibido` | "Recibí" un ingreso fijo en un mes sin plan (cualquier miembro): cuerpo opcional `{"monto", "mes": {"anio", "mes"}}` (por defecto el neto y el mes en curso; también el siguiente, otro mes da 400) → 201 con el movimiento del mes. No genera obligación de diezmo. 409 `YA_RECIBIDO` |
| `POST /api/planes/{id}/escenarios/{escenarioId}/ingresos/{ingresoId}/recibido` | "Recibí" una línea de ingreso de la opción principal de su plan, del mes en curso o el siguiente (otro mes da 400): cuerpo opcional `{"monto"}` (por defecto el de la línea) → 201 con el movimiento, con `ingresoPlanId` y, si la línea sale de un ingreso fijo, su `ingresoFijoId`, su bruto y su cuenta. 409 `YA_RECIBIDO` (por línea, y por ingreso fijo en el mes); 404 `INGRESO_NO_ENCONTRADO` si la línea no es de la opción principal |
| `POST /api/cuentas` | `{"nombre", "titular": "YO" \| "CONJUNTA", "saldo"}` → 201; nace sin cuadrar, y su saldo estimado suma solo lo registrado después |
| `POST /api/cuentas/cuadre` | "Cuadrar todas": `{"saldos": [{"cuentaId", "saldoBanco"}]}` → 200 con las cuentas cuadradas hoy. Por cada una, la diferencia contra el saldo estimado queda como ajuste `AJUSTE_CUADRE` "Gastos sin registrar" (negativa si entró dinero). Todas o ninguna: 404 `CUENTA_NO_ENCONTRADA` si una no es del hogar |
| `POST /api/transferencias` | "Mover dinero": `{"desde", "hacia", "monto"}` → 201 con la `TRANSFERENCIA`. 400 `MISMA_CUENTA` |
| `POST /api/creditos` | `{"nombre", "entidad", "diaPago", "metodo"?: "TASA" \| "PLAN" \| "MANUAL", "tasaEM" (0 a 10, hasta 2 decimales), ...}` → 201. Con la tasa (por defecto) o a mano: `"saldo", "totalOriginal", "cuota"` (total original ≥ saldo; a mano la tasa queda en 0). Con el plan de pagos: `"valorFinanciado", "numeroCuotas" (1 a 600), "cuotasPagadas"` (menos que el número de cuotas): la cuota es la cuota fija con esa tasa y el saldo, el de la tabla (cambio `tarjetas-y-creditos`). Si el mes en curso tiene plan y no está cerrado, su Opción A gana "Cuota {nombre}" enlazada al crédito |
| `PUT /api/creditos/{id}/metodo` | "¿Cómo baja el saldo?": `{"metodo", "saldo", "cuota", "tasaEM", "numeroCuotas"?, "cuotasPagadas"?, "valorFinanciado"?}` → el crédito, con las mismas reglas que al crearlo. La cuota nueva pasa a sus ítems "Cuota ..." de los meses en Borrador. 404 `CREDITO_NO_ENCONTRADO` |
| `DELETE /api/creditos/{id}` | "Eliminar crédito" → 204. En una transacción, sus cuotas y abonos quedan sin crédito, se borran sus ítems sin movimientos de los planes no cerrados desde el mes en curso, los demás ítems quedan sin enlace y se borra el crédito (cambio `credito-escritorio-y-eliminar`). 404 `CREDITO_NO_ENCONTRADO` |
| `PUT /api/creditos/{id}/saldo` | "Corregir con extracto": `{"saldo"}` → el crédito, actualizado hoy. 404 `CREDITO_NO_ENCONTRADO` |
| `POST /api/creditos/{id}/probar` | "Probarlo como opción": `{"anio", "mes", "abono"}` → 201 con `{planId, escenarioId}`. Crea el mes copiando el anterior si no tiene plan, y duplica la principal con "Abono extra {crédito}". 409 `MES_NO_BORRADOR` |
| `POST /api/creditos/{id}/abonos` | `{"monto", "usuarioId", "origen"}` → 201 con el `ABONO_CREDITO` (su `capital` es el monto); baja el saldo. 400 `ABONO_MAYOR` si supera el saldo |
| `POST /api/pagos` | "Marcar pago": `{"itemId", "monto", "usuarioId", "origen": {"tipo": "CUENTA" \| "EXTERNA" \| "NINGUNO", "cuentaId"?}, "mes"?: {"anio", "mes"}}` → 201. `mes`: por defecto el mes en curso; también el siguiente, con la fecha de hoy (otro mes da 400). El ítem tiene que estar en la opción principal de ese mes (404 `ITEM_NO_ENCONTRADO`). Un variable se registra como `GASTO`. Un fijo ya pagado: 409 `YA_PAGADO` con "Ya lo pagó {nombre} el {dd mmm}". Pagar un ítem enlazado a un crédito baja su saldo según su método: con la tasa, la cuota menos el interés del mes; con el plan de pagos, al saldo de la tabla para esa cuota (y suma una cuota pagada); a mano, nada. Lo que bajó queda en el `capital` del pago. Pagar la línea de una tarjeta que se paga completa deja lo pagado como su `pagoMonto` |
| `POST /api/gastos` | `{"itemId"?, "monto", "nota" (≤ 120), "usuarioId", "origen", "mes"?}` → 201; sin `itemId` es "No estaba planeado". `mes` como en los pagos |
| `POST /api/aportes` | `{"usuarioId", "monto", "mes": {"anio", "mes"}, "cuentaId"?, "aplicaDiezmo"}` → 201; el mes es el en curso o el siguiente. Con `aplicaDiezmo`, si ese mes tiene plan abierto su opción principal gana, en la misma transacción, el ítem "Diezmo · aporte 26 oct" (`aporteId`) con el porcentaje de la regla de quien aporta (10 % sin regla); si no tiene plan, lo gana al crearse |
| `PATCH /api/registros/{id}` | Corregir un `PAGO`, `GASTO`, `INGRESO_FIJO` o `APORTE`: `{"monto"?, "origen"?, "nota"?}` (la nota, solo en gastos) → el movimiento. El monto de la cuota de un crédito no se corrige (400). Corregir un aporte recalcula su ítem de diezmo si no está ajustado a mano ni tiene pagos. 404 `REGISTRO_NO_ENCONTRADO`; 400 `DATOS_INVALIDOS` con otros tipos; 409 `MES_CERRADO` |
| `DELETE /api/registros/{id}` | 204. Un pago o abono con `capital` se lo devuelve al saldo del crédito (y un pago de cuota descuenta la cuota pagada); un aporte se lleva su ítem de diezmo si no tiene pagos. Lo ya cuadrado no cambia el saldo de la cuenta. Mismos errores que `PATCH` |
| `GET /api/tarjetas` | Las tarjetas del hogar: `[{id, nombre, diaCorte, diaPago, uso, pagoTipo: COMPLETA \| FIJO, pagoMonto}]`. `pagoMonto` es el pago fijo o, si se paga completa, el último valor pagado. Las tarjetas no llevan deuda ni compras |
| `POST /api/tarjetas` | `{"nombre" (≤ 40), "diaCorte", "diaPago" (1 a 31), "uso" (≤ 40), "pagoTipo", "pagoMonto" (> 0 con FIJO), "itemId"?}` → 201. Si el mes en curso tiene plan y no está cerrado, su opción principal gana la línea "Tarjeta {nombre} · {uso}" en Tarjetas (si su día de pago de este mes no ha pasado) (FIJO, vence el día de pago, `tarjetaId`); con `itemId`, ese ítem de Créditos sin tarjeta ni crédito pasa a ser su línea (404 `ITEM_NO_ENCONTRADO`). Cada mes nuevo trae la línea de cada tarjeta con su `pagoMonto` |
| `PUT /api/tarjetas/{id}` | Los mismos datos (sin `itemId`) → la tarjeta. Sus líneas en los meses en Borrador toman el nombre, el día y el monto nuevos. 404 `TARJETA_NO_ENCONTRADA` |
| `DELETE /api/tarjetas/{id}` | 204. Sus ítems quedan sin `tarjetaId`; los pagos no cambian |
| `POST /api/hogar/empezar-de-nuevo` | "Empezar de nuevo" → 204. Cada cuenta parte del saldo estimado que tenía (su último cuadre, sin marcarla cuadrada) y se borran los movimientos, planes, cierres, planes anuales y proyecciones del hogar. Miembros, ingresos fijos, reglas, categorías, cuentas y créditos (con su saldo) se conservan |

`GET /api/finanzas` trae `planes` y `movimientos` desde dos meses antes del mes en curso. Los planes vienen con sus opciones, cada una con sus líneas de ingreso (`ingresos`: `[{id, nombre, monto, usuarioId, tipo: FIJO | EXTRA | OTRO, ingresoFijoId}]`) e ítems (con `creditoId` si son la cuota de un crédito, `tarjetaId` si son la línea de una tarjeta, e `ingresoFijoId` o `aporteId` si son de diezmo), y su `estado` efectivo: un Borrador con opción elegida se lee Activo al llegar su mes. Las entregas de diezmo registradas antes del diezmo como gasto (`DIEZMO_ENTREGADO`) siguen en `movimientos` como historia.

**Saldo estimado.** Cada movimiento trae `seq`, su orden de registro, y cada cuenta `seqCuadre`, el del último movimiento incluido en su `saldoCuadre`. El saldo estimado es `saldoCuadre` más lo registrado con `seq` mayor. Por eso `movimientos` también trae lo de meses anteriores que todavía cuenta en el saldo de alguna cuenta. Los créditos traen sus últimos 6 pagos (cuotas y abonos), que salen de lo registrado (design D1, D2 y D4 de `backend-cuentas-creditos`), y su `metodo`, `numeroCuotas`, `cuotasPagadas` y `valorFinanciado`.

**Categorías.** El hogar tiene cinco categorías del sistema: Diezmo, Gastos fijos, Variables, Tarjetas y Créditos. V12 pasó lo de "Tarjetas y cuotas" a Créditos (ítems, celdas y eventos del anual) y convirtió cada serie de compras a cuotas en un crédito con plan de pagos sin intereses; V13 creó Tarjetas y le pasó las líneas de las tarjetas (`tarjeta_id`). La línea de una tarjeta nueva entra al mes en curso solo si su día de pago no ha pasado.

En un mes Cerrado no se registra nada: 409 `MES_CERRADO`. **El backend no calcula "Te queda libre", "Vs. plan" ni los aportes implícitos**: los calcula el cliente con `packages/domain` sobre estos datos (design D3 de `backend-plan-mes-hoy`).

### Plan del mes y categorías

| Método y ruta | Qué hace |
|---|---|
| `POST /api/categorias` | `{"nombre"}` (1 a 40) → 201, después de las del sistema (Diezmo, Gastos fijos, Variables, Tarjetas, Créditos). 400 `RESERVADA` si es "Diezmo"; 409 `DUPLICADA` si ya existe en el hogar |
| `PATCH /api/categorias/{id}` | `{"nombre"}` → la categoría renombrada (también las del sistema, salvo Diezmo: 400 `RESERVADA`) |
| `POST /api/planes` | `{"anio", "mes", "modo": "COPIAR" \| "FIJOS" \| "CERO"}` → 201 con el plan en Borrador y su Opción A. COPIAR trae la opción principal del mes anterior con las cuotas avanzadas; FIJOS deja los variables en $0. En los tres modos, cada crédito con saldo trae su cuota, y la de un crédito en $0 no se copia. También en los tres, la opción nace con una línea de ingreso por ingreso fijo activo (su neto) y por evento de ingreso del anual de ese mes (con COPIAR y FIJOS, además, las líneas `OTRO` del mes anterior), y con un ítem de diezmo por ingreso fijo con regla activa, por evento de ingreso de un miembro con regla y por aporte del mes con diezmo. Los ítems de diezmo del mes anterior no se copian. 409 `YA_EXISTE` |
| `POST /api/planes/{id}/usar` | `{"escenarioId"}` → el plan, con esa opción como la que se ejecuta y las demás archivadas. Cambiar a otra solo en Borrador y si la principal no tiene pagos; si no, 409 `MES_NO_BORRADOR`. Volver a elegir la que está en uso no cambia nada |
| `POST /api/planes/{id}/escenarios` | "+ Duplicar": `{"desde": escenarioId, "nota"?}` → 201 con el plan. La siguiente letra libre, los mismos ítems sin avanzar cuotas y las mismas líneas de ingreso. Solo en Borrador (409 `MES_NO_BORRADOR`); 409 `MUCHAS_OPCIONES` con 26 |
| `DELETE /api/planes/{id}/escenarios/{escenarioId}` | "Quitar opción" → 204; se borra con sus ítems. Solo en Borrador; 409 `ULTIMA_OPCION`, `OPCION_EN_USO` u `OPCION_CON_PAGOS` |
| `POST /api/planes/{id}/escenarios/{escenarioId}/items` | `{"categoriaId", "nombre", "monto", "diaVence"?, "tipo": "FIJO" \| "VARIABLE" \| "CUOTA" \| "CREDITO" \| "DIEZMO", "cuota"?: {"actual", "total"}, "creditoId"?}` → 201. 404 `CATEGORIA_NO_ENCONTRADA` o `CREDITO_NO_ENCONTRADO` |
| `PUT /api/planes/{id}/escenarios/{escenarioId}/items/{itemId}` | edita el ítem; sin `creditoId`, conserva el que tenía, y siempre conserva el ingreso o el aporte de un ítem de diezmo |
| `POST /api/planes/{id}/escenarios/{escenarioId}/items/{itemId}/recalcular` | "Volver a calcular" un diezmo: toma lo que sugiere su línea y deja de estar ajustado a mano. 404 `ITEM_NO_ENCONTRADO` si no viene de una línea |
| `DELETE /api/planes/{id}/escenarios/{escenarioId}/items/{itemId}` | 204; 409 `ITEM_CON_PAGOS` si ya tiene pagos o gastos |
| `POST /api/planes/{id}/escenarios/{escenarioId}/ingresos` | "+ Ingreso": `{"nombre", "monto", "usuarioId"?, "bruto"?, "aplicarDiezmo"?}` → 201 con la línea, de tipo `OTRO` (el bruto, por defecto el monto). Con `aplicarDiezmo` nace su ítem "Diezmo · {nombre}" enlazado (`ingresoPlanId`). 404 `MIEMBRO_NO_ENCONTRADO`; 409 `MES_CERRADO` |
| `PUT /api/planes/{id}/escenarios/{escenarioId}/ingresos/{ingresoId}` | edita nombre, monto, bruto y persona de la línea; conserva su tipo y su ingreso fijo. No toca Ajustes ni las otras opciones. Su ítem de diezmo la sigue (monto sugerido y nombre) si no está ajustado a mano ni tiene pagos |
| `DELETE /api/planes/{id}/escenarios/{escenarioId}/ingresos/{ingresoId}` | 204; se lleva su ítem de diezmo si no tiene pagos. 409 `INGRESO_RECIBIDO` si ya se recibió en su mes |
| `GET /api/meses/{anio}-{mes}/borrado` | Lo que se borra con el plan del mes, para confirmar: `{pagos, gastos, ingresos, cerrado}` |
| `DELETE /api/meses/{anio}-{mes}` | "Borrar plan de {mes}" → 204. Borra los pagos, gastos e ingresos recibidos del mes (cada cuota devuelve su `capital` al crédito), el plan con sus opciones y el cierre. Los aportes, ajustes, transferencias y abonos se conservan. Sirve también para un mes cerrado sin plan. 404 `PLAN_NO_ENCONTRADO` sin plan ni cierre; 400 si el mes no es `2026-10` |

| `POST /api/cierres` | "Cerrar {mes}": `{"anio", "mes", "filas": [{"nombre", "plan"?, "real"}], "sinRegistrar", "sobrante", "aAhorro", "aSiguiente", "ultimoSeq"}` → 201. La foto la calcula la PWA con `vistaCierre`. El mes es el en curso o uno anterior (400 `DATOS_INVALIDOS`). 400 `REPARTO_INVALIDO` si el reparto no suma el sobrante; 409 `CIERRE_DESACTUALIZADO` si "Sin registrar" no es la suma de los ajustes del mes o hay un movimiento del mes con `seq` mayor que `ultimoSeq`; 409 `MES_CERRADO` si ya estaba cerrado |

### Plan anual

| Método y ruta | Qué hace |
|---|---|
| `POST /api/anuales` | `{"anio"}` → 201 con el anual vacío y su Opción A (año en curso o futuro). 409 `YA_EXISTE`. El anual responde `{anio, estado, opciones: [{id, letra, creadoPor, nota, celdas, eventos, base}], opcionEnUso}` (cambio `anual-opciones-y-meses`; V14 le dio su Opción A a cada año que ya existía) |
| `DELETE /api/anuales/{anio}` | "Borrar plan de {año}" → 204: el anual con sus opciones (celdas, eventos y base), y los aportes proyectados del año. Los meses ya creados no cambian. 404 `ANUAL_NO_ENCONTRADO` |
| `PUT /api/anuales/{anio}/celdas` | `{"categoriaId", "mes", "monto", "opcionId"?}` → 204; reemplaza la celda de la opción (sin `opcionId`, la en uso o la A). 404 `OPCION_NO_ENCONTRADA`. 404 `ANUAL_NO_ENCONTRADO` o `CATEGORIA_NO_ENCONTRADA`; 400 `DATOS_INVALIDOS` en la categoría Diezmo, que el anual calcula con las reglas |
| `POST /api/anuales/{anio}/replicar` | "Replicar en los 12 meses": `{"tipo": "MES", "anio", "mes"}`, `{"tipo": "FIJOS"}` o `{"tipo": "CERO"}`, más `"opcionId"?` → 200 con el anual (lo crea si no existe). Reemplaza las celdas de la opción (por categoría, el total de la opción principal del mes base, sin la cuota de los créditos que ya no pagan ese mes; con FIJOS, el último plan antes del año sin sus ítems variables) y los aportes proyectados del año (lo que cada miembro aportó en el mes base, o su proyección de ese mes); conserva los eventos y guarda `base` en la opción. Ya no se bloquea con los meses creados. 404 `PLAN_NO_ENCONTRADO`; 400 `DATOS_INVALIDOS` si el año pasó |
| `POST /api/anuales/{anio}/eventos` | `{"nombre", "mes", "monto", "tipo": "INGRESO" \| "GASTO", "usuarioId"?, "categoriaId"?, "hasta"?, "enAdelante"?, "opcionId"?}` → 201, en la opción (sin ella, la en uso o la A). `categoriaId` solo en gastos y nunca Diezmo (sin ella, "Eventos del año"). `hasta` (cambio `anual-evento-rango`, V16) es el último mes en que se repite, de `mes` a 12; sin él, `enAdelante` da diciembre y si no, el mismo mes. Al corregir sin `hasta` (la app 2.2.3), se conserva el rango guardado si `enAdelante` no es verdadero. La respuesta trae `hasta` y `enAdelante` (verdadero si va hasta diciembre desde un mes anterior). 400 `DATOS_INVALIDOS`; 404 `CATEGORIA_NO_ENCONTRADA` o `MIEMBRO_NO_ENCONTRADO` |
| `PUT /api/anuales/{anio}/eventos/{id}` | Corrige un evento con los mismos datos que al agregarlo → 200. 404 `EVENTO_NO_ENCONTRADO` |
| `DELETE /api/anuales/{anio}/eventos/{id}` | Quita un evento → 204. 404 `EVENTO_NO_ENCONTRADO` |
| `PUT /api/anuales/{anio}/proyecciones` | `{"usuarioId", "mes", "monto"}` → 204; 0 la quita. 404 `MIEMBRO_NO_ENCONTRADO` |
| `POST /api/anuales/{anio}/opciones` | "+ Duplicar Opción X": `{"desdeId"}` → 201 con la opción nueva (la siguiente letra, a nombre de quien duplica, con copia de celdas, eventos, base y mes base). "+ Nueva opción desde un mes base" (cambio `anual-mes-base-editable`): `{"desde": {"tipo": "MES", "anio", "mes"} | {"tipo": "FIJOS"} | {"tipo": "CERO"}}` → 201 con la opción, su `mesBase` (los gastos de la fuente sin diezmo) y sus celdas llenas desde él; si el año no tenía plan, se crea y la opción es su A. 404 `PLAN_NO_ENCONTRADO`. 404 `OPCION_NO_ENCONTRADA` |
| `PUT /api/anuales/{anio}/opciones/{id}/base` | "Copiar otro mes": `{"desde"}` → 204; reemplaza el mes base (las celdas no cambian) |
| `POST`, `PUT`, `DELETE /api/anuales/{anio}/opciones/{id}/base/items[/{itemId}]` | Un gasto del mes base, con el cuerpo de un ítem del plan → 201, 200 o 204. Si la opción no tenía mes base, primero se copia su plantilla. 404 `ITEM_NO_ENCONTRADO`; 400 `DATOS_INVALIDOS` en la categoría Diezmo |
| `POST /api/anuales/{anio}/opciones/{id}/base/usar` | "Usar este mes en los 12 meses" → 200 con el anual: las celdas de la opción desde su mes base, sin los créditos que ya no pagan ese mes. Los eventos y las proyecciones no cambian. Con mes base, `POST .../meses` toma de ahí sus ítems (V15, `anual_base_item`) |
| `DELETE /api/anuales/{anio}/opciones/{id}` | "Quitar opción" → 204. 409 `OPCION_EN_USO` si es la última o la que está en uso |
| `POST /api/anuales/{anio}/meses` | "Meses con la Opción X": `{"opcionId"?, "actualizar": [3, 4, ...]}` → 200 con `[{anio, mes, accion: CREADO \| ACTUALIZADO}]`, en una transacción. Crea los meses sin plan ni cierre y reemplaza el plan de los de `actualizar`, conservando su estado; uno con pagos, gastos, ingresos recibidos o cierre da 409 `MES_CON_REGISTROS`. Cada mes nace con sus líneas de ingreso y su diezmo como `POST /api/planes`; sus ítems salen del mes base de la opción (o, sin base, del último plan antes del año), ajustados a cada categoría con celdas, más las categorías sin celdas tal cual (si hay base), los eventos de gasto, la línea de cada tarjeta y la cuota de los créditos que pagan ese mes. La opción queda en uso y el anual, `CREADO` |

`GET /api/finanzas` trae `anuales` (solo las celdas tocadas; las demás valen 0) y `proyecciones` desde el año del primer mes que lee.

**Varias opciones solo en Borrador** (design D1 de `backend-opciones-mes`): un mes futuro, o el mes en curso antes de elegir opción. Un mes Activo se edita en su opción en uso, pero no gana opciones ni cambia de opción.

Un mes está **cerrado** si su plan está en Cerrado o tiene su cierre guardado (aunque no tenga plan). En un mes cerrado no se crea el plan, no se cambia, y "Recibí", "Entregado", pagos, gastos y aportes responden 409 `MES_CERRADO`. Cuadrar, mover y abonar siguen funcionando: son de las cuentas. `GET /api/finanzas` trae los cierres desde tres meses antes del mes en curso, para el "Sobrante de {mes}" del primer mes leído (design D3 y D4 de `backend-cierre-mes`).
