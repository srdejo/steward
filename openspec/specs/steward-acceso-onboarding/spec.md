# steward-acceso-onboarding Specification

## Purpose

Define el acceso único (registro e ingreso en una sola pantalla), la activación de Face ID, el onboarding de cinco pasos y la aceptación de una invitación, funcionando en modo demo.

## Requirements

### Requirement: Pantalla de acceso única
Sin sesión, la UI SHALL mostrar Acceso con "Continuar con Google", "Entrar con Face ID" y "Continuar con correo", y el texto de que la primera vez se crea la cuenta. En modo demo, cualquiera de las tres opciones MUST iniciar una sesión de prueba. Si el hogar de prueba ya está configurado, MUST ir a Hoy; si no, a Activar Face ID.

#### Scenario: Primera vez
- **WHEN** sin sesión y con el hogar de prueba sin configurar se toca "Continuar con Google"
- **THEN** se abre Activar Face ID

#### Scenario: Hogar ya configurado
- **WHEN** sin sesión y con el hogar de prueba ya configurado se toca "Continuar con correo"
- **THEN** se abre Hoy del mes en curso

### Requirement: Activar Face ID
Tras crear la cuenta, la UI SHALL ofrecer activar Face ID/passkey, con opción de omitir. Las dos opciones MUST seguir al paso 1 del onboarding. En modo demo, activar MUST solo guardar la preferencia, sin llamar a WebAuthn ni a la biometría del sistema.

#### Scenario: Omitir
- **WHEN** en Activar Face ID se elige omitir
- **THEN** se abre Onboarding 1 y la preferencia queda desactivada

### Requirement: Onboarding de cinco pasos
El onboarding SHALL tener cinco pasos en orden, con avance visible y "atrás" desde el paso 2:
1. Nombre (prellenado) y nombre del hogar.
2. Diezmo opcional: Sí/No, porcentaje (10 % por defecto) y base Bruto/Neto.
3. Ingreso fijo: nombre, bruto, neto y día de pago, con la vista previa del diezmo; "+ Otro ingreso fijo".
4. Cuentas opcionales: nombre y saldo aproximado; "+ Otra cuenta"; se puede saltar.
5. Invitar por correo o copiar el enlace, con estados Pendiente y Reenviar; "Invitar después".

Los pasos 2, 4 y 5 MUST poderse saltar. Al terminar, el hogar queda configurado y SHALL abrirse Hoy.

#### Scenario: Vista previa del diezmo
- **WHEN** en el paso 2 se eligió diezmo 10 % sobre el bruto y en el paso 3 se escribe bruto $7.000.000
- **THEN** la vista previa muestra un diezmo de $700.000

#### Scenario: Saltar cuentas
- **WHEN** en el paso 4 se elige saltar
- **THEN** se abre el paso 5 y el hogar queda sin cuentas

#### Scenario: Invitación pendiente
- **WHEN** en el paso 5 se invita a `esposa@ejemplo.com`
- **THEN** la invitación aparece como Pendiente, con la opción Reenviar

### Requirement: Invitación recibida
Al abrir un enlace de invitación, la UI SHALL mostrar "{quien invita} te invitó a {hogar}", pedir el nombre y ofrecer el diezmo opcional sobre los aportes, con el botón "Unirme". El invitado MUST NOT tener que configurar ingresos ni cuentas. Al unirse, SHALL quedar como miembro y ver Hoy del hogar.

#### Scenario: Unirse
- **WHEN** desde una invitación de Daniel a "Nuestra casa" se escribe el nombre y se toca "Unirme"
- **THEN** se abre Hoy y el hogar muestra dos miembros
