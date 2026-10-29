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

### Finanzas (ingresos, diezmo, cuentas y créditos)

Todo es del hogar de la sesión. Montos en pesos enteros. El mes es siempre **el mes en curso del backend** (`STEWARD_ZONE`, America/Bogota). Las cifras del diezmo son las del dominio compartido (`packages/domain`): porcentaje de la regla **actual** del dueño sobre el bruto o el neto, al peso más cercano.

| Método y ruta | Qué hace |
|---|---|
| `GET /api/finanzas` | `{mes: {anio, mes}, diezmoEnHoy, categorias, ingresosFijos, reglas, cuentas, planes, movimientos, creditos, cierres}`: lo que la PWA superpone a sus datos de prueba. `ingresosFijos` son los activos de todos los miembros. 404 `SIN_HOGAR` |
| `PUT /api/regla-diezmo` | la regla propia: `{"activa", "porcentaje" (0 < p ≤ 100, hasta 2 decimales), "base": "BRUTO" \| "NETO", "aplicaAportes"}` |
| `POST /api/ingresos-fijos` | `{"nombre", "bruto", "neto", "diaPago", "cuentaId"?}` → 201; bruto ≥ neto > 0, día de 1 a 31; 404 `CUENTA_NO_ENCONTRADA` si la cuenta no es del hogar |
| `PUT /api/ingresos-fijos/{id}` | edita un ingreso propio y activo; 404 `INGRESO_NO_ENCONTRADO` si es de otra persona o de otro hogar |
| `DELETE /api/ingresos-fijos/{id}` | 204; lo desactiva (lo ya recibido lo sigue nombrando) |
| `POST /api/ingresos-fijos/{id}/recibido` | "Recibí" (cualquier miembro) → 201 con el movimiento del mes; genera diezmo si el dueño tiene la regla activa. 409 `YA_RECIBIDO` |
| `GET /api/diezmo/pendientes` | `[{id, monto, detalle, usuarioId, fecha}]`, p. ej. `700000` y `10% de Salario Daniel · recibido 25 oct` |
| `POST /api/diezmo/entregas` | `{"obligaciones": [ids], "cuentaId"?}` → 201 con un movimiento por la suma; los ids que no están pendientes se ignoran. 409 `SIN_DIEZMO` si no queda ninguno |
| `POST /api/cuentas` | `{"nombre", "titular": "YO" \| "CONJUNTA", "saldo"}` → 201; nace sin cuadrar, y su saldo estimado suma solo lo registrado después |
| `POST /api/cuentas/cuadre` | "Cuadrar todas": `{"saldos": [{"cuentaId", "saldoBanco"}]}` → 200 con las cuentas cuadradas hoy. Por cada una, la diferencia contra el saldo estimado queda como ajuste `AJUSTE_CUADRE` "Gastos sin registrar" (negativa si entró dinero). Todas o ninguna: 404 `CUENTA_NO_ENCONTRADA` si una no es del hogar |
| `POST /api/transferencias` | "Mover dinero": `{"desde", "hacia", "monto"}` → 201 con la `TRANSFERENCIA`. 400 `MISMA_CUENTA` |
| `POST /api/creditos` | `{"nombre", "entidad", "saldo", "totalOriginal", "cuota", "tasaEM" (0 a 10, hasta 2 decimales), "diaPago"}` → 201. Total original ≥ saldo. Si el mes en curso tiene plan y no está cerrado, su Opción A gana "Cuota {nombre}" enlazada al crédito |
| `PUT /api/creditos/{id}/saldo` | `{"saldo"}` → el crédito, actualizado hoy. 404 `CREDITO_NO_ENCONTRADO` |
| `POST /api/creditos/{id}/probar` | "Probarlo como opción": `{"anio", "mes", "abono"}` → 201 con `{planId, escenarioId}`. Crea el mes copiando el anterior si no tiene plan, y duplica la principal con "Abono extra {crédito}". 409 `MES_NO_BORRADOR` |
| `POST /api/creditos/{id}/abonos` | `{"monto", "usuarioId", "origen"}` → 201 con el `ABONO_CREDITO`; baja el saldo. 400 `ABONO_MAYOR` si supera el saldo |
| `POST /api/pagos` | "Marcar pago": `{"itemId", "monto", "usuarioId", "origen": {"tipo": "CUENTA" \| "EXTERNA" \| "NINGUNO", "cuentaId"?}}` → 201. El ítem tiene que estar en la opción principal del mes en curso (404 `ITEM_NO_ENCONTRADO`). Un variable se registra como `GASTO`. Un fijo ya pagado: 409 `YA_PAGADO` con "Ya lo pagó {nombre} el {dd mmm}". Pagar un ítem enlazado a un crédito baja su saldo en la parte de capital (la cuota menos el interés del mes) |
| `POST /api/gastos` | `{"itemId"?, "monto", "nota" (≤ 120), "usuarioId", "origen"}` → 201; sin `itemId` es "No estaba planeado" |
| `POST /api/aportes` | `{"usuarioId", "monto", "mes": {"anio", "mes"}, "cuentaId"?, "aplicaDiezmo"}` → 201; el mes es el en curso o el siguiente. Con diezmo, genera la obligación `10% del aporte · 26 oct` |

`GET /api/finanzas` trae `planes` y `movimientos` desde dos meses antes del mes en curso. Los planes vienen con sus opciones e ítems (con `creditoId` si son la cuota de un crédito) y su `estado` efectivo: un Borrador con opción elegida se lee Activo al llegar su mes.

**Saldo estimado.** Cada movimiento trae `seq`, su orden de registro, y cada cuenta `seqCuadre`, el del último movimiento incluido en su `saldoCuadre`. El saldo estimado es `saldoCuadre` más lo registrado con `seq` mayor. Por eso `movimientos` también trae lo de meses anteriores que todavía cuenta en el saldo de alguna cuenta. Los créditos traen sus últimos 6 pagos (cuotas y abonos), que salen de lo registrado (design D1, D2 y D4 de `backend-cuentas-creditos`).

En un mes Cerrado no se registra nada: 409 `MES_CERRADO`. **El backend no calcula "Te queda libre", "Vs. plan" ni los aportes implícitos**: los calcula el cliente con `packages/domain` sobre estos datos (design D3 de `backend-plan-mes-hoy`).

### Plan del mes y categorías

| Método y ruta | Qué hace |
|---|---|
| `POST /api/categorias` | `{"nombre"}` (1 a 40) → 201, después de las del sistema. 400 `RESERVADA` si es "Diezmo"; 409 `DUPLICADA` si ya existe en el hogar |
| `PATCH /api/categorias/{id}` | `{"nombre"}` → la categoría renombrada (también las del sistema) |
| `POST /api/planes` | `{"anio", "mes", "modo": "COPIAR" \| "FIJOS" \| "CERO"}` → 201 con el plan en Borrador y su Opción A. COPIAR trae la opción principal del mes anterior con las cuotas avanzadas; FIJOS deja los variables en $0. En los tres modos, cada crédito con saldo trae su cuota, y la de un crédito en $0 no se copia. 409 `YA_EXISTE` |
| `POST /api/planes/{id}/usar` | `{"escenarioId"}` → el plan, con esa opción como la que se ejecuta y las demás archivadas. Cambiar a otra solo en Borrador y si la principal no tiene pagos; si no, 409 `MES_NO_BORRADOR`. Volver a elegir la que está en uso no cambia nada |
| `POST /api/planes/{id}/escenarios` | "+ Duplicar": `{"desde": escenarioId, "nota"?}` → 201 con el plan. La siguiente letra libre, los mismos ítems sin avanzar cuotas. Solo en Borrador (409 `MES_NO_BORRADOR`); 409 `MUCHAS_OPCIONES` con 26 |
| `DELETE /api/planes/{id}/escenarios/{escenarioId}` | "Quitar opción" → 204; se borra con sus ítems. Solo en Borrador; 409 `ULTIMA_OPCION`, `OPCION_EN_USO` u `OPCION_CON_PAGOS` |
| `POST /api/planes/{id}/escenarios/{escenarioId}/items` | `{"categoriaId", "nombre", "monto", "diaVence"?, "tipo": "FIJO" \| "VARIABLE" \| "CUOTA" \| "CREDITO", "cuota"?: {"actual", "total"}, "creditoId"?}` → 201. 404 `CATEGORIA_NO_ENCONTRADA` o `CREDITO_NO_ENCONTRADO` |
| `PUT /api/planes/{id}/escenarios/{escenarioId}/items/{itemId}` | edita el ítem; sin `creditoId`, conserva el que tenía |
| `DELETE /api/planes/{id}/escenarios/{escenarioId}/items/{itemId}` | 204; 409 `ITEM_CON_PAGOS` si ya tiene pagos o gastos |

| `POST /api/cierres` | "Cerrar {mes}": `{"anio", "mes", "filas": [{"nombre", "plan"?, "real"}], "sinRegistrar", "sobrante", "aAhorro", "aSiguiente", "ultimoSeq"}` → 201. La foto la calcula la PWA con `vistaCierre`. El mes es el en curso o uno anterior (400 `DATOS_INVALIDOS`). 400 `REPARTO_INVALIDO` si el reparto no suma el sobrante; 409 `CIERRE_DESACTUALIZADO` si "Sin registrar" no es la suma de los ajustes del mes o hay un movimiento del mes con `seq` mayor que `ultimoSeq`; 409 `MES_CERRADO` si ya estaba cerrado |

### Plan anual

| Método y ruta | Qué hace |
|---|---|
| `POST /api/anuales` | `{"anio"}` → 201 con el anual vacío (año en curso o futuro). 409 `YA_EXISTE` |
| `PUT /api/anuales/{anio}/celdas` | `{"categoriaId", "mes", "monto"}` → 204; reemplaza la celda. 404 `ANUAL_NO_ENCONTRADO` o `CATEGORIA_NO_ENCONTRADA` |
| `POST /api/anuales/{anio}/eventos` | `{"nombre", "mes", "monto", "tipo": "INGRESO" | "GASTO", "usuarioId"?}` → 201 |
| `PUT /api/anuales/{anio}/proyecciones` | `{"usuarioId", "mes", "monto"}` → 204; 0 la quita. 404 `MIEMBRO_NO_ENCONTRADO` |
| `POST /api/anuales/{anio}/crear-meses` | "Crear meses desde este plan" → los meses creados (`[{anio, mes}]`). Los que tienen plan o están cerrados no cambian |

`GET /api/finanzas` trae `anuales` (solo las celdas tocadas; las demás valen 0) y `proyecciones` desde el año del primer mes que lee.

**Varias opciones solo en Borrador** (design D1 de `backend-opciones-mes`): un mes futuro, o el mes en curso antes de elegir opción. Un mes Activo se edita en su opción en uso, pero no gana opciones ni cambia de opción.

Un mes está **cerrado** si su plan está en Cerrado o tiene su cierre guardado (aunque no tenga plan). En un mes cerrado no se crea el plan, no se cambia, y "Recibí", "Entregado", pagos, gastos y aportes responden 409 `MES_CERRADO`. Cuadrar, mover y abonar siguen funcionando: son de las cuentas. `GET /api/finanzas` trae los cierres desde tres meses antes del mes en curso, para el "Sobrante de {mes}" del primer mes leído (design D3 y D4 de `backend-cierre-mes`).
