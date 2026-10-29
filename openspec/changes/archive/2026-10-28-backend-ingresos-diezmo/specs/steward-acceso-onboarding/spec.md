## MODIFIED Requirements

### Requirement: Onboarding de cinco pasos
El onboarding SHALL tener cinco pasos en orden, con avance visible y "atrás" desde el paso 2:
1. Nombre (prellenado) y nombre del hogar.
2. Diezmo opcional: Sí/No, porcentaje (10 % por defecto) y base Bruto/Neto.
3. Ingreso fijo: nombre, bruto, neto y día de pago, con la vista previa del diezmo; "+ Otro ingreso fijo".
4. Cuentas opcionales: nombre y saldo aproximado; "+ Otra cuenta"; se puede saltar.
5. Invitar por correo o copiar el enlace, con estados Pendiente y Reenviar; "Invitar después".

Los pasos 2, 4 y 5 MUST poderse saltar. Al terminar, el hogar queda configurado y SHALL abrirse Hoy.

En modo conectado:
- el paso 1 MUST guardar el nombre del usuario y crear el hogar en el backend, o renombrarlo si ya existe;
- el paso 2 MUST guardar la regla de diezmo del usuario en el backend;
- el paso 3 MUST guardar sus ingresos fijos en el backend, y volver a este paso MUST editar los ya guardados en lugar de duplicarlos;
- el paso 4 MUST crear las cuentas en el backend, a nombre del usuario o conjuntas (Efectivo), sin repetir una cuenta con el mismo nombre al volver al paso;
- el paso 5 MUST crear y reenviar invitaciones reales, y ofrecer copiar el enlace cuando el correo no se envió;
- terminar MUST marcar el hogar como configurado en el backend.

Si el backend rechaza un paso, el onboarding MUST quedarse en ese paso y mostrar el mensaje.

#### Scenario: Vista previa del diezmo
- **WHEN** en el paso 2 se eligió diezmo 10 % sobre el bruto y en el paso 3 se escribe bruto $7.000.000
- **THEN** la vista previa muestra un diezmo de $700.000

#### Scenario: Saltar cuentas
- **WHEN** en el paso 4 se elige saltar
- **THEN** se abre el paso 5 y el hogar queda sin cuentas

#### Scenario: Invitación pendiente
- **WHEN** en el paso 5 se invita a `esposa@ejemplo.com`
- **THEN** la invitación aparece como Pendiente, con la opción Reenviar

#### Scenario: Hogar creado en el backend
- **WHEN** en modo conectado se completa el paso 1 con "Nuestra casa"
- **THEN** el backend tiene el hogar "Nuestra casa" con el usuario como miembro, y una recarga de la página vuelve al onboarding, no a Acceso

#### Scenario: Pasos 2 a 4 en el backend
- **WHEN** en modo conectado se eligen diezmo 10 % del bruto, el ingreso "Salario Daniel" ($7.000.000 bruto, $6.288.000 neto, día 25) y la cuenta "Davivienda" con $4.000.000
- **THEN** el backend tiene esa regla, ese ingreso y esa cuenta, y otro miembro ve el ingreso y la cuenta al abrir la app

#### Scenario: Volver al paso 3
- **WHEN** en modo conectado se vuelve del paso 4 al 3 y se cambia el neto del salario
- **THEN** el backend tiene un solo "Salario Daniel", con el neto nuevo

#### Scenario: Correo no enviado
- **WHEN** en modo conectado se invita en el paso 5 y el backend responde que el correo no salió
- **THEN** la invitación aparece como Pendiente, junto con el aviso de que se copie el enlace
