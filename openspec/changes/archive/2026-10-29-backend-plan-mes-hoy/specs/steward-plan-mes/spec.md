## Purpose
Define en el backend el plan de cada mes del hogar: las categorías, el mes con su Opción A y sus ítems, sus estados (Borrador, Activo, Cerrado) y quién puede cambiarlo, con el aislamiento entre hogares.

## ADDED Requirements

### Requirement: Categorías del hogar
Todo hogar SHALL tener desde que se crea las cuatro categorías del sistema:
- Gastos fijos (tipo FIJO);
- Tarjetas y cuotas (TARJETA);
- Variables (VARIABLE);
- Créditos (CREDITO).

Cualquier miembro MUST poder crear una categoría con un nombre (1 a 40 caracteres) y renombrar cualquiera, también las del sistema. Las del sistema no se borran. Las reglas son las del dominio compartido:
- "Diezmo" (sin distinguir mayúsculas) MUST responder 400 `RESERVADA`, porque el diezmo se calcula solo;
- un nombre que ya usa otra categoría del hogar MUST responder 409 `DUPLICADA`.

#### Scenario: Hogar nuevo
- **WHEN** un usuario crea "Nuestra casa"
- **THEN** el hogar tiene Gastos fijos, Tarjetas y cuotas, Variables y Créditos, en ese orden

#### Scenario: Nueva categoría
- **WHEN** un miembro crea "Educación"
- **THEN** la categoría queda en el hogar, después de las del sistema, y se puede usar en los ítems del plan

#### Scenario: Diezmo no es categoría
- **WHEN** un miembro intenta crear la categoría "diezmo"
- **THEN** responde 400 `RESERVADA` y no se crea nada

### Requirement: Crear el plan de un mes
Un miembro SHALL poder crear el plan de un mes que no tiene plan, en estado Borrador y con una Opción A propuesta por él, de una de tres formas, igual que `crearMes` del dominio:
- "Copiar mes anterior" (`COPIAR`): los ítems de la opción principal del mes anterior. Las compras a cuotas avanzan una cuota, y las que ya terminaron no se copian.
- "Solo fijos e ingresos" (`FIJOS`): lo mismo, pero los ítems variables quedan en $0.
- "Desde cero" (`CERO`): sin ítems.

Sin plan en el mes anterior, `COPIAR` y `FIJOS` crean la opción vacía. Si el mes ya tiene plan, MUST responder 409 `YA_EXISTE`.

#### Scenario: Copiar mes anterior
- **WHEN** octubre tiene la Compra a cuotas en la cuota 4 de 12 y Mercado por $320.000, y se crea noviembre con `COPIAR`
- **THEN** noviembre queda en Borrador con una Opción A que trae la Compra a cuotas en la cuota 5 de 12 y Mercado por $320.000

#### Scenario: Solo fijos
- **WHEN** se crea noviembre con `FIJOS`
- **THEN** Mercado, que es variable, queda en $0, y los fijos conservan su monto

#### Scenario: Mes que ya tiene plan
- **WHEN** se intenta crear otra vez el plan de noviembre
- **THEN** responde 409 `YA_EXISTE`

### Requirement: Ítems de la opción
Un miembro SHALL poder agregar, editar y quitar ítems de una opción del plan. Cada ítem tiene:
- nombre (1 a 60 caracteres) y monto (cero o más);
- categoría del hogar;
- tipo `FIJO`, `VARIABLE`, `CUOTA` o `CREDITO`;
- día de vencimiento opcional (1 a 31);
- para las compras a cuotas, cuota actual y total.

Datos inválidos MUST responder 400 `DATOS_INVALIDOS`. Una categoría de otro hogar MUST responder 404 `CATEGORIA_NO_ENCONTRADA`. Quitar un ítem que ya tiene pagos o gastos en su mes MUST responder 409 `ITEM_CON_PAGOS` y no quitarlo.

#### Scenario: Agregar un gasto fijo
- **WHEN** en la Opción A de noviembre se agrega "Internet" por $120.000 en Gastos fijos, que vence el día 15
- **THEN** la opción tiene ese ítem, y el otro miembro lo ve al leer el plan

#### Scenario: Ítem con pagos
- **WHEN** se intenta quitar Recibo Luz de octubre, que ya tiene un pago
- **THEN** responde 409 `ITEM_CON_PAGOS` y el ítem sigue en el plan

### Requirement: Usar la opción y estados del mes
"Usar opción" SHALL dejar esa opción como la que se ejecuta en el mes. El estado del mes sigue al dominio:
- un mes en Borrador con opción elegida pasa a Activo cuando llega su mes, sin que nadie lo cambie;
- un mes Cerrado MUST NOT admitir cambios en su plan ni registros de pagos, gastos o aportes, y responde 409 `MES_CERRADO`.

En esta etapa solo existe la Opción A: duplicar opciones llega con la Etapa 7 y cerrar el mes con la Etapa 6.

#### Scenario: Usar la Opción A de noviembre
- **WHEN** hoy es 28 oct y se usa la Opción A de noviembre
- **THEN** noviembre sigue en Borrador con la Opción A elegida, y el 1 de noviembre se lee como Activo

#### Scenario: Mes cerrado
- **WHEN** septiembre está Cerrado y se intenta agregarle un ítem
- **THEN** responde 409 `MES_CERRADO`

### Requirement: Aislamiento del plan
El plan, sus opciones, sus ítems y las categorías SHALL resolverse a partir del hogar del usuario de la sesión. Los de otro hogar MUST NOT poder leerse ni modificarse, y un id ajeno MUST responder igual que uno inexistente (404). Sin sesión, MUST responder 401.

#### Scenario: Plan de otro hogar
- **WHEN** un miembro de otro hogar intenta agregar un ítem a la Opción A de "Nuestra casa" usando sus ids
- **THEN** responde 404 y la opción no cambia
