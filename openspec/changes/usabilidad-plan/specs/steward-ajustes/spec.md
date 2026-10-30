## ADDED Requirements

### Requirement: Empezar de nuevo en Ajustes
Ajustes SHALL ofrecer "Empezar de nuevo", con una confirmación que diga lo que se borra (todos los planes, cierres, el plan anual y lo registrado) y lo que se conserva (miembros, ingresos, reglas, categorías, cuentas con su saldo de hoy y créditos), y que pida escribir "EMPEZAR" para confirmar. Hace "Empezar de nuevo" (spec `steward-plan-mes`) y lleva a Planear, donde el mes en curso aparece "Sin plan". En modo demo, "Restablecer datos de prueba" sigue aparte.

#### Scenario: Empezar de nuevo
- **WHEN** en Ajustes se toca "Empezar de nuevo", se escribe EMPEZAR y se confirma
- **THEN** se abre Planear con el mes en curso "Sin plan", y el otro miembro también lo ve así

## MODIFIED Requirements

### Requirement: Seguridad y privacidad
Ajustes SHALL ofrecer "Cerrar sesión". "Face ID al abrir" y "Ocultar montos" MUST NOT mostrarse mientras no funcionen en la app (llegan con passkeys, biometría y "Ocultar montos" en una etapa posterior); en modo demo pueden seguir guardando la preferencia sin mostrarse. "Cerrar sesión" MUST volver a Acceso conservando los datos de prueba.

#### Scenario: Ocultar montos
- **WHEN** se abre Ajustes
- **THEN** no aparecen "Face ID al abrir" ni "Ocultar montos", y los montos se ven siempre

#### Scenario: Cerrar sesión
- **WHEN** se toca "Cerrar sesión"
- **THEN** se abre Acceso y, al volver a entrar, el hogar sigue configurado con los mismos datos
