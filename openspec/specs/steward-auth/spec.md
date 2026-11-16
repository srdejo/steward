# steward-auth Specification

## Purpose
Define cómo una persona entra a Presupuesto Hogar con su cuenta de Google, cómo se emite y valida su sesión, y cómo se consulta y edita su perfil.

## Requirements

### Requirement: Login con Google
El backend SHALL aceptar un ID token de Google Identity Services y validarlo con las llaves públicas de Google: firma, emisor de Google, audiencia igual al client id configurado, vigencia y correo verificado.
- Si el token es válido, MUST devolver una sesión nueva.
- La primera vez de un correo, SHALL crear el usuario con el nombre y el correo de Google.
- Si el token es inválido, está vencido o es de otra audiencia, MUST responder 401 sin crear nada.
- Sin client id configurado, el login con Google MUST responder 503 con `codigo` `GOOGLE_NO_CONFIGURADO`.

#### Scenario: Primera vez
- **WHEN** entra con Google `daniel@ejemplo.com`, correo que no existe
- **THEN** se crea el usuario con su nombre de Google, y la respuesta trae la sesión con `tieneHogar` en falso

#### Scenario: Token de otra app
- **WHEN** llega un ID token válido de Google emitido para otro client id
- **THEN** responde 401 y no se crea ningún usuario

### Requirement: Acceso de desarrollo
Solo en desarrollo local, el backend SHALL permitir iniciar sesión con un correo y un nombre, sin Google, para probar con varias personas en `steward.test`, cuyo dominio Google no acepta como origen. El acceso:
- MUST estar apagado por defecto y activarse solo con una propiedad de configuración explícita;
- MUST NOT activarse en el VPS;
- con el acceso apagado, MUST responder 404 como si no existiera;
- con el acceso encendido, MUST crear el usuario la primera vez y devolver una sesión igual a la de Google.

`GET /api/auth/config` SHALL indicar si está encendido, y la PWA en modo conectado MUST mostrar "Entrar como…" solo en ese caso.

#### Scenario: Apagado
- **WHEN** se pide el acceso de desarrollo con la configuración por defecto
- **THEN** responde 404 y no crea ningún usuario

#### Scenario: Dos personas en local
- **WHEN** con el acceso encendido entran `daniel@ejemplo.com` y `esposa@ejemplo.com` en dos ventanas
- **THEN** cada una tiene su sesión y su usuario, como si hubieran entrado con Google

### Requirement: Usuario único por correo
Cada correo SHALL corresponder a un solo usuario, sin distinguir mayúsculas de minúsculas. Entrar de nuevo con el mismo correo MUST devolver el mismo usuario y sus datos, sin duplicarlo.

#### Scenario: Mayúsculas
- **WHEN** un usuario creado como `daniel@ejemplo.com` entra con un token cuyo correo es `Daniel@Ejemplo.com`
- **THEN** recibe la sesión del mismo usuario

### Requirement: Sesión con token
La sesión SHALL ser un token firmado por el backend que el cliente envía en `Authorization: Bearer`. Identifica al usuario y vence a los 7 días. El backend no guarda estado de sesión.
- Un token vencido, alterado o firmado con otra clave MUST responder 401.
- Cerrar sesión SHALL ser responsabilidad del cliente, que descarta el token: el backend no ofrece revocación en esta etapa.

#### Scenario: Token vencido
- **WHEN** se pide `GET /api/sesion` con un token de hace 8 días
- **THEN** responde 401

#### Scenario: Cerrar sesión
- **WHEN** en Ajustes se toca "Cerrar sesión"
- **THEN** la PWA borra el token y abre Acceso, y la siguiente petición sale sin `Authorization`

### Requirement: Sesión actual
`GET /api/sesion` SHALL devolver:
- el usuario (id, nombre, correo e inicial);
- `tieneHogar`;
- `hogarConfigurado`, que es verdadero cuando el hogar ya terminó el onboarding.

La PWA MUST usarlo al abrir para decidir entre Acceso, onboarding y Hoy.

#### Scenario: Hogar sin terminar
- **WHEN** un usuario que creó su hogar pero no terminó el onboarding pide su sesión
- **THEN** recibe `tieneHogar` verdadero y `hogarConfigurado` falso

### Requirement: Perfil propio
El usuario SHALL poder cambiar su nombre visible, que no puede quedar vacío y tiene 60 caracteres como máximo. La inicial del avatar MUST ser la primera letra del nombre, en mayúscula. El correo MUST NOT poder cambiarse.

#### Scenario: Cambio de nombre
- **WHEN** el usuario cambia su nombre a "dani"
- **THEN** los miembros del hogar lo ven como "dani", con inicial "D"

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
