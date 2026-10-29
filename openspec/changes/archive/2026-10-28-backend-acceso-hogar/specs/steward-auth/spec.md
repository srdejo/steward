# Spec Delta

## Purpose

Define cómo una persona entra a Presupuesto Hogar con su cuenta de Google, cómo se emite y valida su sesión, y cómo se consulta y edita su perfil.

## ADDED Requirements

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
