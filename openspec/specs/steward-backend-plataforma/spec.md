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
`local-deploy.ps1 -Project steward` SHALL publicar en `http://steward.test` la PWA y la API en el mismo origen: `/api/` y `/actuator/health` van al backend (en la JVM) y el resto, a la PWA. Mientras el backend esté reservado en el VPS, el despliegue al VPS MUST seguir publicando la página "Próximamente".

#### Scenario: Mismo origen
- **WHEN** después de `local-deploy.ps1 -Project steward` se abre `http://steward.test/actuator/health`
- **THEN** responde `{"status":"UP"}`, y `http://steward.test/` sirve la PWA

### Requirement: Despliegue nativo al VPS preparado
El despliegue al VPS SHALL estar listo para publicar el backend como binario nativo, sin JDK. Tiene que:
- conservar en el VPS la versión anterior;
- comprobar la salud por loopback después de reiniciar;
- volver solo a la versión anterior si no responde UP, sin publicar la web nueva;
- limitar la memoria del servicio a 160 MB.

Mientras el backend esté reservado, el despliegue MUST NOT subir el binario ni tocar el servicio, y MUST seguir publicando la página "Próximamente".

#### Scenario: Backend reservado
- **WHEN** se ejecuta `deploy.ps1 -Projects steward` con el backend reservado
- **THEN** no se sube ningún binario, el servicio no se toca y `https://steward.srdejo.com.co` sigue mostrando "Próximamente"

#### Scenario: Versión nueva que no arranca
- **WHEN**, con el backend encendido, se despliega un binario que no responde UP en 30 s
- **THEN** el servicio vuelve a la versión anterior, que responde UP, el deploy termina en error y la web publicada no cambia
