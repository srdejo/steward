## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Ingresos y diezmo propios
**Reason**: Incluía el ajuste "Diezmo en Hoy" (Separado o Agrupado), que solo agrupaba la tarjeta "Disponible para diezmar", que desaparece.
**Migration**: Lo reemplaza "Ingresos y regla de diezmo propios", igual pero sin "Diezmo en Hoy".
