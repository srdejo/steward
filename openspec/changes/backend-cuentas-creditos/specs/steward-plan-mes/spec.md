## MODIFIED Requirements

### Requirement: Crear el plan de un mes
Un miembro SHALL poder crear el plan de un mes que no tiene plan, en estado Borrador y con una Opción A propuesta por él, de una de tres formas, igual que `crearMes` del dominio:
- "Copiar mes anterior" (`COPIAR`): los ítems de la opción principal del mes anterior. Las compras a cuotas avanzan una cuota, y las que ya terminaron no se copian.
- "Solo fijos e ingresos" (`FIJOS`): lo mismo, pero los ítems variables quedan en $0.
- "Desde cero" (`CERO`): sin ítems, salvo las cuotas de los créditos.

En las tres formas, los créditos del hogar MUST quedar en el mes así:
- cada crédito con saldo mayor que cero que no tenga ya un ítem enlazado en la opción gana su cuota, como al agregarlo (Créditos, tipo `CREDITO`, "Cuota {nombre en minúsculas}", su cuota y su día de pago);
- un ítem copiado de un crédito con saldo $0 no se copia.

Sin plan en el mes anterior, `COPIAR` y `FIJOS` crean la opción solo con las cuotas de los créditos. Si el mes ya tiene plan, MUST responder 409 `YA_EXISTE`.

#### Scenario: Copiar mes anterior
- **WHEN** octubre tiene la Compra a cuotas en la cuota 4 de 12 y Mercado por $320.000, y se crea noviembre con `COPIAR`
- **THEN** noviembre queda en Borrador con una Opción A que trae la Compra a cuotas en la cuota 5 de 12 y Mercado por $320.000

#### Scenario: Solo fijos
- **WHEN** se crea noviembre con `FIJOS`
- **THEN** Mercado, que es variable, queda en $0, y los fijos conservan su monto

#### Scenario: Mes que ya tiene plan
- **WHEN** se intenta crear otra vez el plan de noviembre
- **THEN** responde 409 `YA_EXISTE`

#### Scenario: Desde cero con un crédito
- **WHEN** el hogar tiene "Libre inversión" con saldo $14.250.000 y cuota $500.000, y se crea noviembre "Desde cero"
- **THEN** la Opción A de noviembre tiene solo "Cuota libre inversión" por $500.000, enlazada al crédito

#### Scenario: Crédito pagado
- **WHEN** "Libre inversión" quedó en saldo $0 en octubre y se crea noviembre con `COPIAR`
- **THEN** noviembre no trae "Cuota libre inversión"

### Requirement: Ítems de la opción
Un miembro SHALL poder agregar, editar y quitar ítems de una opción del plan. Cada ítem tiene:
- nombre (1 a 60 caracteres) y monto (cero o más);
- categoría del hogar;
- tipo `FIJO`, `VARIABLE`, `CUOTA` o `CREDITO`;
- día de vencimiento opcional (1 a 31);
- para las compras a cuotas, cuota actual y total;
- para los de tipo `CREDITO`, el crédito del hogar al que corresponde, opcional.

Datos inválidos MUST responder 400 `DATOS_INVALIDOS`. Una categoría de otro hogar MUST responder 404 `CATEGORIA_NO_ENCONTRADA`, y un crédito de otro hogar, 404 `CREDITO_NO_ENCONTRADO`. Editar un ítem conserva su crédito si no se indica otro. Quitar un ítem que ya tiene pagos o gastos en su mes MUST responder 409 `ITEM_CON_PAGOS` y no quitarlo.

#### Scenario: Agregar un gasto fijo
- **WHEN** en la Opción A de noviembre se agrega "Internet" por $120.000 en Gastos fijos, que vence el día 15
- **THEN** la opción tiene ese ítem, y el otro miembro lo ve al leer el plan

#### Scenario: Ítem con pagos
- **WHEN** se intenta quitar Recibo Luz de octubre, que ya tiene un pago
- **THEN** responde 409 `ITEM_CON_PAGOS` y el ítem sigue en el plan

#### Scenario: Cambiar el monto de la cuota
- **WHEN** en Planear se cambia "Cuota libre inversión" de noviembre a $550.000
- **THEN** el ítem sigue enlazado a "Libre inversión", y pagarlo en noviembre baja su saldo
