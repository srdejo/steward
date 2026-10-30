# steward-ajustes Specification

## Purpose

Define Ajustes del hogar: los miembros e invitaciones, los ingresos y el diezmo de cada persona, las categorías y las opciones de seguridad y privacidad.

## Requirements

### Requirement: Hogar y miembros
Ajustes SHALL mostrar el nombre del hogar y sus miembros (con "(tú)" para el usuario actual y la fecha de unión de los demás), con "+ Invitar a alguien más". "Salir del hogar" MUST pedir confirmación.

#### Scenario: Miembros de ejemplo
- **WHEN** se abre Ajustes con los datos de prueba
- **THEN** se ve "Nuestra casa" con Daniel (tú) y Esposa ("Se unió el 27 oct")

### Requirement: Categorías
Ajustes SHALL listar las categorías (Diezmo, Gastos fijos, Tarjetas y cuotas, Variables, Créditos), con "Editar" en cada una salvo Diezmo, y "+ Nueva". El Diezmo MUST NOT aparecer como categoría editable: se muestra como categoría del sistema, sin "Editar".

En modo conectado, las categorías MUST leerse del backend y guardarse en él, y los mensajes de "Diezmo" reservado y nombre repetido MUST venir de él.

#### Scenario: Nueva categoría
- **WHEN** se crea la categoría "Educación"
- **THEN** está disponible al agregar ítems al plan de un mes

#### Scenario: Categoría en modo conectado
- **WHEN** en modo conectado Daniel crea "Educación" y Esposa abre un mes en Borrador
- **THEN** Esposa puede elegir "Educación" al agregar un ítem

#### Scenario: Diezmo sin editar
- **WHEN** se abre Categorías en Ajustes
- **THEN** Diezmo aparece primero, sin "Editar"

### Requirement: Seguridad y privacidad
Ajustes SHALL ofrecer "Cerrar sesión". "Face ID al abrir" y "Ocultar montos" MUST NOT mostrarse mientras no funcionen en la app (llegan con passkeys, biometría y "Ocultar montos" en una etapa posterior); en modo demo pueden seguir guardando la preferencia sin mostrarse. "Cerrar sesión" MUST volver a Acceso conservando los datos de prueba.

#### Scenario: Ocultar montos
- **WHEN** se abre Ajustes
- **THEN** no aparecen "Face ID al abrir" ni "Ocultar montos", y los montos se ven siempre

#### Scenario: Cerrar sesión
- **WHEN** se toca "Cerrar sesión"
- **THEN** se abre Acceso y, al volver a entrar, el hogar sigue configurado con los mismos datos

### Requirement: Ingresos y regla de diezmo propios
Ajustes SHALL mostrar los ingresos fijos y los aportes variables del usuario actual, con su regla de diezmo, y permitir editarlos. La regla de diezmo MUST explicar que sugiere el monto de los ítems de diezmo de cada mes, y que cambiarla no cambia los meses ya creados. Cada persona MUST ver y editar solo su propia regla de diezmo. Ajustes MUST NOT ofrecer el ajuste "Diezmo en Hoy".

Ajustes MUST permitir agregar un ingreso fijo ("+ Agregar ingreso fijo"), con los mismos campos que el paso 3 del onboarding, para quien no lo configuró al empezar.

En modo conectado, los ingresos fijos y la regla de diezmo MUST leerse del backend y guardarse en él, y los demás miembros SHALL ver los cambios al abrir la app.

#### Scenario: Agregar un ingreso después del onboarding
- **WHEN** un miembro sin ingresos fijos toca "+ Agregar ingreso fijo" y guarda "Salario Sulbey" con bruto y neto $3.000.000 y día 30
- **THEN** el ingreso aparece en Ajustes y en Hoy como "Por recibir"

#### Scenario: Editar el salario en modo conectado
- **WHEN** en modo conectado Daniel cambia el neto de "Salario Daniel" a $6.500.000
- **THEN** el backend guarda el neto nuevo, y Esposa ve "Salario Daniel" con $6.500.000 en Hoy, como "Por recibir"

#### Scenario: Cambiar la regla
- **WHEN** Daniel pasa su regla de 10 % a 12 % del bruto con noviembre ya creado, y luego crea diciembre
- **THEN** "Diezmo · Salario Daniel" de noviembre sigue en $700.000 y el de diciembre nace en $840.000

### Requirement: Empezar de nuevo en Ajustes
Ajustes SHALL ofrecer "Empezar de nuevo", con una confirmación que diga lo que se borra (todos los planes, cierres, el plan anual y lo registrado) y lo que se conserva (miembros, ingresos, reglas, categorías, cuentas con su saldo de hoy y créditos), y que pida escribir "EMPEZAR" para confirmar. Hace "Empezar de nuevo" (spec `steward-plan-mes`) y lleva a Planear, donde el mes en curso aparece "Sin plan". En modo demo, "Restablecer datos de prueba" sigue aparte.

#### Scenario: Empezar de nuevo
- **WHEN** en Ajustes se toca "Empezar de nuevo", se escribe EMPEZAR y se confirma
- **THEN** se abre Planear con el mes en curso "Sin plan", y el otro miembro también lo ve así
