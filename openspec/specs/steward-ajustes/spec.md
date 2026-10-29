# steward-ajustes Specification

## Purpose

Define Ajustes del hogar: los miembros e invitaciones, los ingresos y el diezmo de cada persona, las categorías y las opciones de seguridad y privacidad.

## Requirements

### Requirement: Hogar y miembros
Ajustes SHALL mostrar el nombre del hogar y sus miembros (con "(tú)" para el usuario actual y la fecha de unión de los demás), con "+ Invitar a alguien más". "Salir del hogar" MUST pedir confirmación.

#### Scenario: Miembros de ejemplo
- **WHEN** se abre Ajustes con los datos de prueba
- **THEN** se ve "Nuestra casa" con Daniel (tú) y Esposa ("Se unió el 27 oct")

### Requirement: Ingresos y diezmo propios
Ajustes SHALL mostrar los ingresos fijos y los aportes variables del usuario actual, con su regla de diezmo, y permitir editarlos. El ajuste "Diezmo en Hoy" (Separado o Agrupado) MUST cambiar cómo aparece la tarjeta de diezmo en Hoy. Cada persona MUST ver y editar solo su propia regla de diezmo.

Ajustes MUST permitir agregar un ingreso fijo ("+ Agregar ingreso fijo"), con los mismos campos que el paso 3 del onboarding, para quien no lo configuró al empezar.

En modo conectado, los ingresos fijos, la regla de diezmo y "Diezmo en Hoy" MUST leerse del backend y guardarse en él, y los demás miembros SHALL ver los cambios al abrir la app.

#### Scenario: Agrupado
- **WHEN** "Diezmo en Hoy" pasa a Agrupado y hay dos ingresos recibidos con diezmo
- **THEN** Hoy muestra una sola tarjeta "Disponible para diezmar" con la suma

#### Scenario: Agregar un ingreso después del onboarding
- **WHEN** un miembro sin ingresos fijos toca "+ Agregar ingreso fijo" y guarda "Salario Sulbey" con bruto y neto $3.000.000 y día 30
- **THEN** el ingreso aparece en Ajustes y en Hoy como "Por recibir"

#### Scenario: Editar el salario en modo conectado
- **WHEN** en modo conectado Daniel cambia el neto de "Salario Daniel" a $6.500.000
- **THEN** el backend guarda el neto nuevo, y Esposa ve "Salario Daniel" con $6.500.000 en Hoy, como "Por recibir"

### Requirement: Categorías
Ajustes SHALL listar las categorías (Gastos fijos, Tarjetas y cuotas, Variables, Créditos), con "Editar" en cada una y "+ Nueva". El Diezmo MUST NOT aparecer como categoría editable.

#### Scenario: Nueva categoría
- **WHEN** se crea la categoría "Educación"
- **THEN** está disponible al agregar ítems al plan de un mes

### Requirement: Seguridad y privacidad
Ajustes SHALL ofrecer "Face ID al abrir" (tras 5 min sin usar), "Ocultar montos" y "Cerrar sesión". Con "Ocultar montos" activo, todo monto MUST mostrarse como `$••••` hasta que se toque. En modo demo, "Face ID al abrir" MUST solo guardar la preferencia. "Cerrar sesión" MUST volver a Acceso conservando los datos de prueba.

#### Scenario: Ocultar montos
- **WHEN** se activa "Ocultar montos" y se vuelve a Hoy
- **THEN** "Te queda libre" se ve como `$••••` y al tocarlo muestra $3.436.000

#### Scenario: Cerrar sesión
- **WHEN** se toca "Cerrar sesión"
- **THEN** se abre Acceso y, al volver a entrar, el hogar sigue configurado con los mismos datos
