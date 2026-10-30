## ADDED Requirements

### Requirement: Editar en hojas con "Guardar"
En Planear, los ingresos y los gastos de una opción SHALL editarse en hojas, no en campos de la fila:
- tocar una línea de ingreso abre su hoja: nombre, monto, bruto (cuando la regla de su persona usa el bruto) y persona;
- tocar un gasto abre su hoja: nombre, monto, categoría, tipo (Fijo, Variable, Cuota, Crédito o Diezmo), día de vencimiento y, para las compras a cuotas, cuota actual y total;
- en un ítem de diezmo, la hoja muestra de qué ingreso viene y, si está "ajustado a mano", "Volver a calcular".

Cada hoja MUST tener "Guardar", que deja el cambio en el plan y muestra "Guardado", y "Quitar", que pide confirmación ("¿Quitar Internet de la Opción A?"). Cerrar la hoja sin guardar MUST NOT cambiar nada. "+ Gasto" y "+ Ingreso" MUST abrir la misma hoja vacía, con el monto, y "+ Ingreso" con "Aplicar diezmo".

Las categorías de gastos MUST mostrar que se abren y se cierran (un indicador ›/⌄) y cuántos gastos tienen.

En modo conectado, "Guardar" y "Quitar" MUST guardarse en el backend antes de mostrar "Guardado". Si el backend responde un error, la hoja MUST seguir abierta con el mensaje y lo escrito.

#### Scenario: Cambiar un monto
- **WHEN** en noviembre se toca Mercado, se cambia a $900.000 y se toca "Guardar"
- **THEN** la hoja se cierra con "Guardado", Variables suma $900.000 y lo que dejaría libre baja $100.000

#### Scenario: Cerrar sin guardar
- **WHEN** se toca Mercado, se escribe $900.000 y se cierra la hoja sin "Guardar"
- **THEN** Mercado sigue en $800.000

#### Scenario: Agregar un gasto con su monto
- **WHEN** se toca "+ Gasto", se escribe "Regalo" por $150.000 en Variables y se guarda
- **THEN** Variables tiene "Regalo" por $150.000, sin pasos adicionales

#### Scenario: Quitar con confirmación
- **WHEN** se toca Internet, luego "Quitar" y se confirma
- **THEN** Internet ya no está en la opción

### Requirement: El mes en curso se edita en Planear
Abrir en Planear el mes en curso, en Activo, SHALL mostrar su plan editable, con las mismas hojas que un Borrador (spec `steward-plan-mes`, "Editar el mes en curso"), sin "+ Duplicar", sin pestañas de opciones y con acceso a Hoy y al Cierre. Un mes Cerrado MUST seguir en solo lectura.

#### Scenario: Editar octubre
- **WHEN** octubre está Activo y en Planear se abre octubre
- **THEN** se ven sus ingresos y gastos con sus hojas de edición, y no aparece "+ Duplicar"

### Requirement: Borrar el plan del mes en Planear
Un mes con plan, o cerrado, SHALL ofrecer en Planear "Borrar plan de {mes}". La confirmación MUST decir qué se borra ("Se borran 3 pagos, 2 gastos y 1 ingreso recibido de octubre; los aportes se conservan", o "y su cierre" si estaba cerrado) y pedir confirmarlo otra vez cuando hay registros. Después el mes se abre como "Sin plan".

#### Scenario: Borrar noviembre
- **WHEN** en noviembre se toca "Borrar plan de noviembre" y se confirma
- **THEN** Planear muestra noviembre "Sin plan" con sus tres formas de empezar
