# Arquitectura del backend

Un solo módulo Gradle con capas hexagonales, como el arquetipo reactivo del workspace (`denti-caja`, `agent-project`). Paquete raíz `co.com.srdejo.steward`.

| Capa | Paquete | Qué contiene | Depende de |
|---|---|---|---|
| Dominio | `domain/model` | records del negocio (`Usuario`, `Sesion`, `EstadoHogar`, `IngresoFijo`, `Movimiento`…) | nada |
| | `domain/api` | puertos de entrada (`IAuthServicePort`…) | `model` |
| | `domain/spi` | puertos de salida (persistencia, Google, token, reloj, correo) | `model` |
| | `domain/usecase` | reglas; **sin anotaciones de Spring** | `api`, `spi`, `model` |
| | `domain/exception` | `DomainException` con `codigo` y un `Tipo` sin HTTP | nada |
| Aplicación | `application/dto` | contrato HTTP (records) y su conversión desde el dominio | dominio |
| Infraestructura | `infrastructure/input/rest` | controllers WebFlux | `api`, `dto` |
| | `infrastructure/out/r2dbc` | persistencia con `DatabaseClient` y SQL explícito | `spi` |
| | `infrastructure/security` | seguridad, JWT de sesión, Google, reloj, usuario actual | `spi` |
| | `infrastructure/exceptionhandler` | `ControllerAdvisor`: formato de error único | `exception` |
| | `infrastructure/configuration` | `BeanConfiguration` (conecta casos de uso y adaptadores), propiedades, perfil `contract` | todo |

Sin capa de *handlers*: la conversión entre dominio y DTO es directa (`SesionResponse.de(...)`), así que un handler no agregaría nada.

## Reglas

- **El hogar sale siempre del usuario de la sesión** (`ICurrentUserPort`), nunca de la URL. Cada consulta de un recurso del hogar lleva `hogar_id = :hogar`; si es de otro hogar, el resultado es vacío y la respuesta, 404.
- **Correos solo por `contact`**: `IMailPort` tiene una implementación real que llama a la API `contact` del workspace. El backend no tiene SMTP ni credenciales de correo.
- **Sin Lombok, MapStruct ni springdoc**: records y mapeo a mano. Menos reflexión para la imagen nativa.
- **Nada toca la base antes de que Flyway termine** (lección de `agent-project`).
- **Las reglas del dinero son las del dominio compartido** (`packages/domain`). `FinanzasUseCase` reproduce `marcarRecibido`, `diezmosPendientes` y `entregarDiezmo`, y `CalculoDiezmo` reproduce sus cifras y textos. El contrato usa las mismas cifras que `rules.test.ts`.
- **Las vistas se calculan en el cliente.** El backend guarda los datos y valida las escrituras. "Te queda libre", "Vs. plan", "Pagado", los aportes implícitos y las vistas de las opciones los calcula la PWA, y después la app Expo, con `packages/domain` sobre `GET /api/finanzas`. Así hay una sola implementación de esas fórmulas. El backend reproduce las reglas de escritura: `YA_PAGADO`, `MES_CERRADO`, el avance de cuotas y las cuotas de los créditos de `crearMes`, `RESERVADA`, `DUPLICADA`, las obligaciones de diezmo, que se validan al entregar (design D3 de `backend-plan-mes-hoy`), y la diferencia de un cuadre, que necesita el saldo estimado (design D3 de `backend-cuentas-creditos`). Ese saldo se calcula en SQL con la misma tabla de efectos que `efecto()` de `packages/domain/src/rules/cuentas.ts`; si cambia uno, cambia el otro.
- **Movimientos en una sola tabla**, como el `Movimiento` del dominio: `tipo` y columnas opcionales. La Etapa 4 suma pagos, gastos y aportes; la Etapa 5, ajustes de cuadre, transferencias y abonos.
- **Orden de registro, no fecha.** El saldo estimado suma lo registrado después del último cuadre (`movimiento.seq`, una identidad, y `cuenta.seq_cuadre`). Por eso la lectura de finanzas trae, además de los meses que muestra la app, lo de antes que todavía cuenta en el saldo de alguna cuenta (design D1 y D2 de `backend-cuentas-creditos`). El saldo de un crédito se cambia en la misma sentencia que lo lee, para que dos registros a la vez no lo dejen mal. Las garantías de concurrencia son de la base: el índice `movimiento_recibido_uq` (un "Recibí" por ingreso y mes) y la PK de `diezmo_cubierto` (una obligación se entrega una vez). Sus violaciones se traducen a `YA_RECIBIDO` y `SIN_DIEZMO`.
- **Sin `@Profile` en los beans**: lo que cambia entre entornos va en propiedades leídas al arrancar, porque la preparación AOT de la imagen nativa congela las condiciones de los beans (`docs/DECISIONS.md`). `gradlew aotTest` lo verifica.

## Código común y `srdejo-platform`

Seguridad (`SecurityConfig`, `JwtTokenAdapter`, `GoogleIdentityAdapter`), errores (`ControllerAdvisor`, `DomainException`) y correo están escritos aquí, tomando `denti-caja` como referencia, porque la librería `srdejo-platform` todavía no existe. Viven solo en `infrastructure` y el dominio los ve a través de puertos de `domain/spi`. Cuando `srdejo-platform` publique su 0.1.0, el reemplazo cambia `infrastructure` y `BeanConfiguration` sin tocar `domain` ni `application` (design D10 del cambio `backend-acceso-hogar`).
