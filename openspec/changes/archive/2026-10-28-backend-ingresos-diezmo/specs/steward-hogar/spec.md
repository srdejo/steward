## MODIFIED Requirements

### Requirement: Aceptar una invitación
Un usuario con sesión y sin hogar SHALL poder aceptar una invitación válida con su nombre y su preferencia de diezmo sobre los aportes.
- Al aceptar, MUST quedar como miembro con fecha de unión de hoy, y la invitación MUST quedar aceptada y no volver a servir.
- Puede aceptar con cualquier cuenta de Google: el token es la prueba de la invitación.
- Si ya pertenece a un hogar, MUST responder 409 `YA_TIENE_HOGAR` sin consumir la invitación.
- La preferencia de diezmo MUST guardarse en su regla de diezmo (capacidad `steward-finanzas`):
  - si elige diezmar de sus aportes y no tiene regla, queda con una regla activa de 10 % sobre el bruto, aplicada a los aportes;
  - si ya tiene regla, solo cambia si aplica a los aportes;
  - si no elige diezmar y no tiene regla, no se crea ninguna.

#### Scenario: Unirse
- **WHEN** Esposa entra con Google desde la invitación de Daniel a "Nuestra casa", escribe su nombre y acepta
- **THEN** queda como miembro, el hogar tiene dos miembros y el mismo enlace responde 404 desde ese momento

#### Scenario: Ya tiene hogar
- **WHEN** un miembro de otro hogar intenta aceptar la invitación
- **THEN** responde 409 `YA_TIENE_HOGAR` y la invitación sigue pendiente

#### Scenario: Diezmar de mis aportes
- **WHEN** Esposa, sin regla de diezmo, acepta eligiendo diezmar de sus aportes
- **THEN** su regla queda activa, 10 % sobre el bruto, aplicada a los aportes

### Requirement: Salir del hogar
Un miembro SHALL poder salir de su hogar. Si quedan otros miembros, el hogar sigue con ellos. Si era el último, el hogar, sus invitaciones pendientes y todo lo de sus finanzas (ingresos, cuentas y movimientos) MUST eliminarse. Después de salir, el usuario no tiene hogar y puede crear uno o aceptar una invitación.

Cuando el hogar sigue con otros miembros, al salir:
- sus ingresos fijos en ese hogar MUST quedar desactivados;
- sus cuentas propias MUST quitarse del hogar;
- los movimientos ya registrados y las cuentas conjuntas se conservan;
- su regla de diezmo se conserva, porque es suya.

#### Scenario: Sale uno de dos
- **WHEN** Esposa sale de "Nuestra casa"
- **THEN** Daniel ve un solo miembro, y Esposa recibe `tieneHogar` falso en su sesión

#### Scenario: Sus ingresos y cuentas
- **WHEN** Esposa, con el ingreso fijo "Salario Esposa" y la cuenta "Ahorros Esposa", sale de "Nuestra casa"
- **THEN** Daniel ya no ve "Salario Esposa" entre los ingresos activos ni "Ahorros Esposa" entre las cuentas, y las cuentas conjuntas siguen
