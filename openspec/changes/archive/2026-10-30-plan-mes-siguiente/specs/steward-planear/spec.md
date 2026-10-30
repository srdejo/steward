## ADDED Requirements

### Requirement: Opción con saldo negativo
Cuando una opción deja menos de cero, Planear SHALL decir "Con la Opción {letra} faltarían" con el monto en valor absoluto y en rojo, en lugar de "Opción {letra} dejaría libre". En cero o positivo MUST seguir diciendo "Opción {letra} dejaría libre".

#### Scenario: Faltan $200.000
- **WHEN** la Opción A tiene ingresos por $4.000.000 y gastos por $4.200.000
- **THEN** Planear muestra "Con la Opción A faltarían $200.000" en rojo

#### Scenario: Justo en cero
- **WHEN** la Opción A tiene ingresos y gastos por $4.000.000
- **THEN** Planear muestra "Opción A dejaría libre $0"

### Requirement: Ver el mes siguiente en Ejecución
Abrir en Planear el mes siguiente al mes en curso SHALL ofrecer "Ver en Ejecución", que abre Hoy (se ve como Ejecución) con ese mes elegido (spec `steward-hoy`, "Elegir el mes en Hoy").

#### Scenario: De noviembre a Ejecución
- **WHEN** hoy es 30 oct, se abre noviembre en Planear y se toca "Ver en Ejecución"
- **THEN** Hoy muestra noviembre

## MODIFIED Requirements

### Requirement: Editar en hojas con "Guardar"
En Planear, los ingresos y los gastos de una opción SHALL editarse en hojas, no en campos de la fila:
- tocar una línea de ingreso abre su hoja: nombre, monto, bruto (cuando la regla de su persona usa el bruto) y persona;
- tocar un gasto abre su hoja: nombre, monto, categoría en chips (el tipo se deduce de ella), día de vencimiento y, según la categoría, "¿A cuotas?" con cuota actual y total en Tarjetas y cuotas, o "Cambia cada mes" en una categoría propia;
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

#### Scenario: El tipo sale de la categoría
- **WHEN** se toca "+ Gasto", se elige el chip Variables, se escribe "Regalo" por $150.000 y se guarda
- **THEN** "Regalo" queda de tipo Variable, sin haber elegido un tipo

#### Scenario: Una compra a cuotas
- **WHEN** se elige el chip Tarjetas y cuotas, se activa "¿A cuotas?", se escribe cuota 4 de 12 y se guarda
- **THEN** el gasto queda de tipo Cuota, con cuota 4 de 12

#### Scenario: Una categoría propia variable
- **WHEN** se elige el chip Educación, se activa "Cambia cada mes" y se guarda
- **THEN** el gasto queda de tipo Variable en Educación

#### Scenario: Abrir y guardar no cambia el tipo
- **WHEN** un gasto de tipo Fijo está en Variables desde antes, se abre, se cambia su monto y se guarda sin tocar la categoría
- **THEN** sigue siendo de tipo Fijo
