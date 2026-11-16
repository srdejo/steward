## ADDED Requirements

### Requirement: Mes base editable de una opción
Cada opción del plan anual SHALL poder tener su propio mes base: los gastos que valen igual todos los meses, con:
- categoría (que no sea Diezmo);
- nombre;
- monto (de cero en adelante);
- día;
- tipo;
- el crédito, la tarjeta o la compra a cuotas de donde salen;
- de qué mes se copió.

Un miembro SHALL poder:
- **crear una opción desde un mes base**, con `{desde: {tipo: "MES", anio, mes}}`, `{desde: {tipo: "FIJOS"}}` o `{desde: {tipo: "CERO"}}`:
  - la opción nueva toma la siguiente letra, a su nombre;
  - su mes base es una copia de los gastos de la opción en uso de ese mes, sin los de diezmo (FIJOS: el último plan antes del año sin los variables; CERO: vacío);
  - sus celdas quedan llenas con ese mes base, como al replicar;
- **reemplazar el mes base** de una opción por la copia de otro mes;
- **agregar, editar o quitar** un gasto del mes base;
- **"Usar este mes en los 12 meses"**: las celdas de la opción toman, por categoría, el total del mes base en cada mes, sin la cuota de los créditos que ya no pagan ese mes; los eventos se conservan.

Editar el mes base MUST NOT cambiar el mes de donde se copió, ni las celdas, hasta "Usar este mes". Al crear o actualizar meses desde la opción, sus ítems MUST salir del mes base de la opción si lo tiene (si no, como hasta ahora: el mes base guardado o el último plan antes del año). Un mes base sin plan MUST responder 404 `PLAN_NO_ENCONTRADO`. Un gasto que no es del mes base de la opción, 404 `ITEM_NO_ENCONTRADO`. Datos inválidos o la categoría Diezmo, 400 `DATOS_INVALIDOS`.

#### Scenario: Opción C desde noviembre
- **WHEN** Daniel crea en 2027 una opción desde noviembre de 2026
- **THEN** 2027 tiene la Opción C, con un mes base que tiene los gastos de la Opción A de noviembre sin el diezmo, origen noviembre de 2026, y sus celdas con esos totales

#### Scenario: Ajustar el mes base
- **WHEN** en el mes base de la Opción C se cambia Transporte a $300.000 y se quita Apoyo familiar
- **THEN** el mes base queda así, noviembre de 2026 no cambia y las celdas de la Opción C siguen igual

#### Scenario: Usar el mes base
- **WHEN** después se usa el mes base de la Opción C en los 12 meses
- **THEN** la fila Variables de la Opción C vale $300.000 cada mes, y sus eventos siguen

#### Scenario: Los meses salen del mes base
- **WHEN** se llevan los meses de 2027 con la Opción C
- **THEN** cada mes trae Transporte por $300.000 y no trae Apoyo familiar
