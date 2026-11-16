# steward-backend-plataforma Specification

## Purpose
Define la base del backend de steward: qué expone sin sesión, cómo responde los errores, cómo versiona su esquema, cómo se compila a imagen nativa y cómo se publica junto a la web en el entorno local.

## Requirements

### Requirement: Superficie pública mínima
El backend SHALL responder sin sesión solo:
- `GET /actuator/health`;
- el login con Google y su configuración pública (el client id de Google, o su ausencia);
- el acceso de desarrollo, que solo existe si está encendido en la configuración (spec `steward-auth`);
- la consulta de una invitación por su token.

Cualquier otra ruta bajo `/api` sin una sesión válida MUST responder 401. `GET /actuator/health` MUST devolver `{"status":"UP"}` sin detalles internos cuando la app y su base responden.

#### Scenario: Salud
- **WHEN** se pide `GET /actuator/health` con la base disponible
- **THEN** responde 200 con `{"status":"UP"}` y nada más

#### Scenario: Ruta protegida sin sesión
- **WHEN** se pide `GET /api/hogar` sin cabecera `Authorization`
- **THEN** responde 401 con el formato de error estándar

### Requirement: Formato de error estándar
Todo error de la API SHALL responder JSON con `codigo` (identificador estable en mayúsculas) y `mensaje` (texto en español para mostrar a la persona). Los estados MUST ser:

| Estado | Cuándo |
|---|---|
| 400 | datos inválidos; incluye `campos`, con el mensaje de cada campo |
| 401 | sin sesión o con sesión inválida |
| 404 | el recurso no existe o no es del hogar de quien pregunta |
| 409 | conflicto con el estado actual |
| 500 | error inesperado; sin detalles internos ni trazas |

#### Scenario: Validación
- **WHEN** se crea un hogar con nombre vacío
- **THEN** responde 400 con `codigo` `DATOS_INVALIDOS` y `campos.nombre` con su mensaje

#### Scenario: Error inesperado
- **WHEN** falla la base durante una petición
- **THEN** responde 500 con `codigo` `ERROR_INTERNO`, sin la traza ni el SQL en el cuerpo

### Requirement: Esquema versionado
El esquema de la base SHALL crearse y evolucionar solo con migraciones versionadas, que se aplican al arrancar. Contra una base vacía, el arranque MUST dejar el esquema completo. Una migración ya aplicada MUST NOT cambiar; los cambios van en migraciones nuevas.

#### Scenario: Base vacía
- **WHEN** el backend arranca contra la base `steward` recién creada
- **THEN** aplica las migraciones y `GET /actuator/health` responde UP

### Requirement: Preparado para imagen nativa
El backend SHALL poder compilarse a imagen nativa con GraalVM sin cambios de código: todo lo que necesita en tiempo de ejecución (configuración, recursos y reflexión) MUST resolverse en la preparación AOT de Spring. La batería completa de tests de contrato MUST pasar con la app corriendo en modo AOT en la JVM, igual que en el modo normal. El día a día y el despliegue local usan la JVM; la compilación nativa se hace solo para desplegar en el VPS.

#### Scenario: Contrato en modo AOT
- **WHEN** los tests de contrato corren contra la app levantada en modo AOT (`spring.aot.enabled=true`)
- **THEN** todos pasan, igual que en el modo normal

### Requirement: Publicación local con la web
`local-deploy.ps1 -Project steward` SHALL publicar en `http://steward.test` la PWA y la API en el mismo origen: `/api/` y `/actuator/health` van al backend (en la JVM) y el resto, a la PWA. En el VPS, la PWA y la API también van en el mismo origen, `https://steward.srdejo.com.co`.

#### Scenario: Mismo origen
- **WHEN** después de `local-deploy.ps1 -Project steward` se abre `http://steward.test/actuator/health`
- **THEN** responde `{"status":"UP"}`, y `http://steward.test/` sirve la PWA

### Requirement: Despliegue nativo al VPS preparado
El backend SHALL estar encendido en el VPS como binario nativo, sin JDK, detrás de `https://steward.srdejo.com.co` y con el acceso de desarrollo apagado. El despliegue tiene que:
- conservar en el VPS la versión anterior;
- comprobar la salud por loopback después de reiniciar;
- volver solo a la versión anterior si no responde UP, sin publicar la web nueva;
- limitar la memoria del servicio a 160 MB.

Una versión con migraciones MUST respaldar la base antes de desplegar. La página "Próximamente" deja de publicarse.

#### Scenario: Backend reservado
- **WHEN** después de `deploy.ps1 -Projects steward` se abre `https://steward.srdejo.com.co/actuator/health`
- **THEN** responde `{"status":"UP"}`, y `https://steward.srdejo.com.co/` sirve la PWA en modo conectado

#### Scenario: Versión nueva que no arranca
- **WHEN**, con el backend encendido, se despliega un binario que no responde UP en 30 s
- **THEN** el servicio vuelve a la versión anterior, que responde UP, el deploy termina en error y la web publicada no cambia

#### Scenario: Sin acceso de desarrollo en producción
- **WHEN** se llama `POST https://steward.srdejo.com.co/api/auth/dev`
- **THEN** no hay acceso de desarrollo: solo se entra con Google

### Requirement: Binario nativo medido
Antes de encenderlo, el binario nativo SHALL pasar la batería completa de tests de contrato corriendo como binario, y MUST cumplir el presupuesto de `optimizar-recursos-plataforma-comun` con los límites del VPS (1 CPU, 160 MB): menos de 120 MB de RSS en reposo, tras un login y un `GET /api/hogar`, y menos de 2 s de arranque. Las cifras medidas SHALL quedar en `backend/docs/DECISIONS.md`, y la memoria real en el VPS, en `infra/PORTS.md`.

#### Scenario: Contrato contra el binario
- **WHEN** los tests de contrato corren contra el binario levantado con `native-build.ps1 -Run -Profile contract`
- **THEN** todos pasan

#### Scenario: Dentro del presupuesto
- **WHEN** el binario corre con 1 CPU y 160 MB, después de un login y un `GET /api/hogar`
- **THEN** su RSS queda por debajo de 120 MB y arrancó en menos de 2 s
