# Spec Delta

## MODIFIED Requirements

### Requirement: Pantalla de acceso única
Sin sesión, la UI SHALL mostrar Acceso con "Continuar con Google", "Entrar con Face ID" y "Continuar con correo", y el texto de que la primera vez se crea la cuenta.
- **En modo demo**, cualquiera de las tres opciones MUST iniciar una sesión de prueba. Si el hogar de prueba ya está configurado, MUST ir a Hoy; si no, a Activar Face ID.
- **En modo conectado**, "Continuar con Google" MUST iniciar el login real con Google. "Entrar con Face ID" y "Continuar con correo" MUST verse deshabilitadas, con la etiqueta "Próximamente". Tras entrar:
  - sin hogar, MUST ir a Activar Face ID;
  - con un hogar que no terminó el onboarding, al paso 1 del onboarding;
  - con el hogar configurado, a Hoy.

#### Scenario: Primera vez
- **WHEN** en modo demo, sin sesión y con el hogar de prueba sin configurar, se toca "Continuar con Google"
- **THEN** se abre Activar Face ID

#### Scenario: Hogar ya configurado
- **WHEN** en modo demo, sin sesión y con el hogar de prueba ya configurado, se toca "Continuar con correo"
- **THEN** se abre Hoy del mes en curso

#### Scenario: Google real, primera vez
- **WHEN** en modo conectado una persona sin cuenta entra con Google
- **THEN** se crea su usuario y se abre Activar Face ID

#### Scenario: Opciones aún no disponibles
- **WHEN** en modo conectado se abre Acceso
- **THEN** "Entrar con Face ID" y "Continuar con correo" se ven deshabilitadas, con "Próximamente"

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
- el paso 5 MUST crear y reenviar invitaciones reales, y ofrecer copiar el enlace cuando el correo no se envió;
- terminar MUST marcar el hogar como configurado en el backend;
- los pasos 2 a 4 siguen guardando en el dispositivo hasta que exista su backend.

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

#### Scenario: Correo no enviado
- **WHEN** en modo conectado se invita en el paso 5 y el backend responde que el correo no salió
- **THEN** la invitación aparece como Pendiente, junto con el aviso de que se copie el enlace

### Requirement: Invitación recibida
Al abrir un enlace de invitación, la UI SHALL mostrar "{quien invita} te invitó a {hogar}", pedir el nombre y ofrecer el diezmo opcional sobre los aportes, con el botón "Unirme". El invitado MUST NOT tener que configurar ingresos ni cuentas. Al unirse, SHALL quedar como miembro y ver Hoy del hogar.

En modo conectado:
- la invitación MUST consultarse por su token;
- "Unirme" sin sesión MUST pedir el login con Google primero y volver a la invitación;
- un enlace vencido o ya usado MUST mostrar que la invitación no es válida, con la opción de ir a Acceso;
- si la persona ya pertenece a otro hogar, MUST explicarlo sin unirla.

#### Scenario: Unirse
- **WHEN** desde una invitación de Daniel a "Nuestra casa" se escribe el nombre y se toca "Unirme"
- **THEN** se abre Hoy y el hogar muestra dos miembros

#### Scenario: Unirse sin sesión
- **WHEN** en modo conectado se toca "Unirme" sin sesión
- **THEN** se pide entrar con Google y, al volver, la persona queda unida al hogar y se abre Hoy

#### Scenario: Enlace no válido
- **WHEN** en modo conectado se abre un enlace ya usado
- **THEN** se ve "Esta invitación ya no es válida" con un botón a Acceso
