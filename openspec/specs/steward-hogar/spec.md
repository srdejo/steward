# steward-hogar Specification

## Purpose
Define el hogar compartido en el backend: cómo se crea y se nombra, quiénes son sus miembros, cómo se invita y se acepta por correo con un token de un solo uso, y cómo se sale, con el aislamiento entre hogares.

## Requirements

### Requirement: Un hogar por usuario
Un usuario SHALL pertenecer como máximo a un hogar. Un usuario sin hogar MUST poder crear uno con un nombre (1 a 60 caracteres) y quedar como su primer miembro. El hogar nace sin terminar el onboarding. Crear un hogar teniendo ya uno MUST responder 409 con `codigo` `YA_TIENE_HOGAR`.

#### Scenario: Crear
- **WHEN** un usuario sin hogar crea "Nuestra casa"
- **THEN** el hogar existe con ese nombre, él es el único miembro y `hogarConfigurado` es falso

#### Scenario: Segundo hogar
- **WHEN** un miembro de "Nuestra casa" intenta crear otro hogar
- **THEN** responde 409 `YA_TIENE_HOGAR` y no se crea nada

### Requirement: Ver y nombrar el hogar
Un miembro SHALL poder consultar su hogar:
- nombre y estado del onboarding;
- miembros, con nombre, inicial, fecha de unión y cuál es él;
- invitaciones pendientes y vigentes, con correo, fecha de envío y vencimiento.

Cualquier miembro MUST poder cambiar el nombre del hogar y marcar el onboarding como terminado. Consultar sin tener hogar MUST responder 404 con `codigo` `SIN_HOGAR`.

#### Scenario: Dos miembros
- **WHEN** Daniel consulta su hogar después de que Esposa se unió
- **THEN** ve a los dos miembros, Daniel marcado como el usuario actual, y la fecha de unión de Esposa

#### Scenario: Terminar onboarding
- **WHEN** un miembro marca el onboarding como terminado
- **THEN** su sesión y la de los demás miembros muestran `hogarConfigurado` verdadero

### Requirement: Invitar por correo
Un miembro SHALL poder invitar a un correo válido.
- La invitación MUST tener un token aleatorio de un solo uso, imposible de adivinar, que vence a los 7 días.
- El backend SHALL enviar el correo con el enlace `{origen}/invitacion/{token}`, con el nombre de quien invita y el del hogar, siempre a través del servicio `contact` del workspace. El backend MUST NOT entregar correos por su cuenta (sin SMTP propio).
- Si el envío falla, la invitación MUST quedar creada igual, y la respuesta SHALL indicarlo con `correoEnviado` en falso para que se pueda copiar el enlace.
- Invitar a un correo que ya es miembro MUST responder 409 con `codigo` `YA_ES_MIEMBRO`.
- Invitar de nuevo a un correo con una invitación pendiente MUST reenviar esa misma invitación, sin crear otra.

#### Scenario: Invitación pendiente
- **WHEN** Daniel invita a `esposa@ejemplo.com`
- **THEN** la invitación aparece pendiente, con vencimiento a 7 días, y a ese correo llega el enlace

#### Scenario: Correo caído
- **WHEN** Daniel invita y el servicio de correo no responde
- **THEN** la invitación queda pendiente, la respuesta trae `correoEnviado` falso y el enlace se puede copiar

### Requirement: Reenviar y copiar el enlace
Un miembro SHALL poder reenviar una invitación pendiente de su hogar. El reenvío extiende el vencimiento a 7 días desde ese momento y envía el correo de nuevo. Un miembro también SHALL poder obtener el enlace de una invitación pendiente para copiarlo. El backend no guarda el token en claro, así que reenviar u obtener el enlace MUST generar un enlace nuevo, y el anterior MUST dejar de servir. Reenviar una invitación aceptada, vencida o de otro hogar MUST responder 404.

#### Scenario: Reenviar
- **WHEN** a los 6 días se reenvía la invitación de Esposa
- **THEN** vence 7 días después del reenvío, llega un correo con un enlace nuevo y el enlace anterior responde 404

### Requirement: Consultar una invitación
Cualquiera con el token SHALL poder consultar la invitación sin sesión. La respuesta incluye:
- nombre del hogar;
- quién invitó;
- nombres de los miembros;
- correo invitado.

Un token inexistente, vencido o ya usado MUST responder 404 con `codigo` `INVITACION_NO_VALIDA`, sin distinguir entre esos casos.

#### Scenario: Enlace vencido
- **WHEN** se abre una invitación enviada hace 8 días y no reenviada
- **THEN** responde 404 `INVITACION_NO_VALIDA`

### Requirement: Aceptar una invitación
Un usuario con sesión y sin hogar SHALL poder aceptar una invitación válida con su nombre y su preferencia de diezmo sobre los aportes.
- Al aceptar, MUST quedar como miembro con fecha de unión de hoy, y la invitación MUST quedar aceptada y no volver a servir.
- Puede aceptar con cualquier cuenta de Google: el token es la prueba de la invitación.
- Si ya pertenece a un hogar, MUST responder 409 `YA_TIENE_HOGAR` sin consumir la invitación.

#### Scenario: Unirse
- **WHEN** Esposa entra con Google desde la invitación de Daniel a "Nuestra casa", escribe su nombre y acepta
- **THEN** queda como miembro, el hogar tiene dos miembros y el mismo enlace responde 404 desde ese momento

#### Scenario: Ya tiene hogar
- **WHEN** un miembro de otro hogar intenta aceptar la invitación
- **THEN** responde 409 `YA_TIENE_HOGAR` y la invitación sigue pendiente

### Requirement: Salir del hogar
Un miembro SHALL poder salir de su hogar. Si quedan otros miembros, el hogar sigue con ellos. Si era el último, el hogar y sus invitaciones pendientes MUST eliminarse. Después de salir, el usuario no tiene hogar y puede crear uno o aceptar una invitación.

#### Scenario: Sale uno de dos
- **WHEN** Esposa sale de "Nuestra casa"
- **THEN** Daniel ve un solo miembro, y Esposa recibe `tieneHogar` falso en su sesión

### Requirement: Aislamiento entre hogares
Cada operación SHALL actuar solo sobre el hogar del usuario de la sesión. Toda referencia a una invitación u otro recurso de un hogar ajeno MUST responder 404, igual que si no existiera. El aislamiento MUST cumplirse también con peticiones simultáneas de usuarios de hogares distintos.

#### Scenario: Invitación ajena
- **WHEN** un miembro del hogar A pide reenviar una invitación del hogar B
- **THEN** responde 404 y la invitación del hogar B no cambia

#### Scenario: Peticiones simultáneas
- **WHEN** miembros de dos hogares consultan su hogar al mismo tiempo, muchas veces
- **THEN** cada respuesta trae solo el hogar de quien la pidió

### Requirement: Invitaciones para mi correo
Un usuario con sesión SHALL poder ver las invitaciones pendientes y vigentes dirigidas a su correo (sin distinguir mayúsculas), aunque no tenga el enlace. Cada una MUST mostrar el hogar, quién invitó y los miembros. El usuario SHALL poder aceptar una de ellas con su nombre y su preferencia de diezmo sobre los aportes, con las mismas reglas que aceptar por enlace:
- la invitación queda aceptada y no vuelve a servir;
- si ya pertenece a un hogar, MUST responder 409 `YA_TIENE_HOGAR` sin consumirla.

Aceptar una invitación que no está dirigida a su correo, que venció o que ya se usó MUST responder 404 `INVITACION_NO_VALIDA`.

#### Scenario: Entra sin el enlace
- **WHEN** Daniel invitó a `sulbey@ejemplo.com` y Sulbey entra con ese correo sin abrir el enlace
- **THEN** ve la invitación de Daniel a "Jimenez Navarro" y, al aceptarla, queda como miembro

#### Scenario: Invitación de otro correo
- **WHEN** un usuario con otro correo intenta aceptar esa invitación por su id
- **THEN** responde 404 `INVITACION_NO_VALIDA` y la invitación sigue pendiente
