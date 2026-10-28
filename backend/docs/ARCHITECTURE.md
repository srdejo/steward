# Arquitectura del backend

Un solo módulo Gradle con capas hexagonales, como el arquetipo reactivo del workspace (`denti-caja`, `agent-project`). Paquete raíz `co.com.srdejo.steward`.

| Capa | Paquete | Qué contiene | Depende de |
|---|---|---|---|
| Dominio | `domain/model` | records del negocio (`Usuario`, `Sesion`, `EstadoHogar`…) | nada |
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
- **Sin `@Profile` en los beans**: lo que cambia entre entornos va en propiedades leídas al arrancar, porque la preparación AOT de la imagen nativa congela las condiciones de los beans (`docs/DECISIONS.md`). `gradlew aotTest` lo verifica.

## Código común y `srdejo-platform`

Seguridad (`SecurityConfig`, `JwtTokenAdapter`, `GoogleIdentityAdapter`), errores (`ControllerAdvisor`, `DomainException`) y correo están escritos aquí, tomando `denti-caja` como referencia, porque la librería `srdejo-platform` todavía no existe. Viven solo en `infrastructure` y el dominio los ve a través de puertos de `domain/spi`. Cuando `srdejo-platform` publique su 0.1.0, el reemplazo cambia `infrastructure` y `BeanConfiguration` sin tocar `domain` ni `application` (design D10 del cambio `backend-acceso-hogar`).
