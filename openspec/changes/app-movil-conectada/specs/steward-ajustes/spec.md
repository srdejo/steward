## ADDED Requirements

### Requirement: Eliminar mi cuenta en Ajustes
Ajustes SHALL ofrecer "Eliminar mi cuenta", con una confirmación que diga qué se borra y qué queda en un hogar compartido, y que pida escribir ELIMINAR. En la app, quien entró con Apple MUST autenticarse otra vez antes de eliminar. Al terminar se abre Acceso. Si falla, la cuenta sigue igual y se muestra el mensaje.

#### Scenario: Confirmar
- **WHEN** se toca "Eliminar mi cuenta", se escribe ELIMINAR y se confirma
- **THEN** la cuenta se elimina y se abre Acceso

#### Scenario: Sin escribir la palabra
- **WHEN** se abre la confirmación y no se escribe ELIMINAR
- **THEN** el botón sigue deshabilitado
