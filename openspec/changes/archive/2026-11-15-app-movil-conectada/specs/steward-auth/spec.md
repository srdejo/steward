## ADDED Requirements

### Requirement: Varios clients de Google
El backend SHALL aceptar tokens de Google cuya audiencia sea cualquiera de los clients configurados (web e iOS), con las mismas validaciones de firma, emisor, vigencia y correo verificado. Otra audiencia MUST responder como un token inválido.

#### Scenario: Token de la app
- **WHEN** llega un token válido con la audiencia del client iOS
- **THEN** se inicia sesión

#### Scenario: Otro client
- **WHEN** llega un token válido con la audiencia de otra aplicación
- **THEN** responde que no se pudo verificar la cuenta, y no hay sesión

### Requirement: Acceso con Apple
`POST /api/auth/apple` SHALL recibir un `identityToken` y un nombre opcional, verificar firma, emisor, audiencia y vigencia, e iniciar sesión. El usuario se busca por su identificador de Apple. Si no existe y el token trae un correo verificado que no es oculto, se enlaza al usuario de ese correo. Si no, se crea uno. Un token inválido MUST responder 401 `APPLE_TOKEN_INVALIDO`.

#### Scenario: Primera vez, con correo oculto
- **WHEN** entra alguien con un correo `privaterelay.appleid.com`
- **THEN** se crea un usuario con ese correo y el nombre recibido

#### Scenario: Ya usaba Google
- **WHEN** Daniel, que usa Google con su correo, entra con Apple y comparte ese mismo correo
- **THEN** entra a su misma cuenta y su mismo hogar

#### Scenario: Segunda vez, sin nombre
- **WHEN** vuelve a entrar y Apple no envía el nombre
- **THEN** conserva el nombre que tenía

#### Scenario: Token de otra aplicación
- **WHEN** llega un token con otra audiencia
- **THEN** responde 401 `APPLE_TOKEN_INVALIDO`

### Requirement: Eliminar la cuenta
`POST /api/cuenta/eliminar` SHALL eliminar la cuenta de la sesión:
- sale de su hogar; si era el último miembro, el hogar se borra con todo lo suyo;
- se borran su regla de diezmo, sus proyecciones y sus invitaciones pendientes;
- si quedan registros suyos en un hogar compartido, el usuario se anonimiza como "Ex miembro" y pierde su correo y su identificador de Apple; si no, se borra;
- con un `appleAuthorizationCode`, se revoca su acceso con Apple. Un fallo de Apple MUST NOT impedir la eliminación.

La sesión deja de ser válida. Volver a entrar con la misma cuenta crea una cuenta nueva y vacía.

#### Scenario: Último miembro
- **WHEN** alguien solo en su hogar elimina su cuenta
- **THEN** se borran el usuario, el hogar y todo lo suyo

#### Scenario: Hogar compartido
- **WHEN** Esposa elimina su cuenta y registró gastos en el hogar con Daniel
- **THEN** Daniel conserva los gastos y sus cifras no cambian; los ve a nombre de "Ex miembro", y el correo de Esposa ya no existe

#### Scenario: Sesión anterior
- **WHEN** se usa el token de una cuenta eliminada
- **THEN** responde 401
