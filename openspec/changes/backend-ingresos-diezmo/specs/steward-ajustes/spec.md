## MODIFIED Requirements

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
