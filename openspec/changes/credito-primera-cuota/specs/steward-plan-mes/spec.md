## MODIFIED Requirements

### Requirement: Crear el plan de un mes
Un miembro SHALL poder crear el plan de un mes que no tiene plan, en estado Borrador y con una Opción A propuesta por él, de una de tres formas, igual que `crearMes` del dominio:
- "Copiar mes anterior" (`COPIAR`): los ítems de la opción principal del mes anterior. Las compras a cuotas avanzan una cuota, y las que ya terminaron no se copian.
- "Solo fijos e ingresos" (`FIJOS`): lo mismo, pero los ítems variables quedan en $0.
- "Desde cero" (`CERO`): sin ítems, salvo las cuotas de los créditos.

En las tres formas, los créditos del hogar MUST quedar en el mes así:
- cada crédito con saldo mayor que cero que no tenga ya un ítem enlazado en la opción gana su cuota, como al agregarlo (Créditos, tipo `CREDITO`, "Cuota {nombre en minúsculas}", su cuota y su día de pago);
- un ítem copiado de un crédito con saldo $0 no se copia;
- un crédito cuya primera cuota es de un mes posterior (spec `steward-cuentas`, "Primera cuota de un crédito") no gana su cuota, y su ítem copiado no se copia.

En las tres formas, la Opción A MUST nacer con sus líneas de ingreso (requirement "Ingresos de la opción"):
- una `FIJO` por cada ingreso fijo activo del hogar, con su nombre, su neto y su dueño;
- una `EXTRA` por cada evento de ingreso del plan anual de ese mes, con su nombre, su monto y su persona;
- con `COPIAR` y `FIJOS`, además, las líneas `OTRO` de la opción principal del mes anterior.

Las líneas `FIJO` y `EXTRA` MUST NOT copiarse del mes anterior: salen de Ajustes y del plan anual de ese momento. Los ítems de diezmo nacen según "Ítems de diezmo".

Sin plan en el mes anterior, `COPIAR` y `FIJOS` crean la opción solo con las cuotas de los créditos, sus ingresos y sus diezmos. Si el mes ya tiene plan, MUST responder 409 `YA_EXISTE`.

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
- **THEN** la Opción A de noviembre tiene, como gastos, solo "Cuota libre inversión" por $500.000, enlazada al crédito, y los ítems de diezmo

#### Scenario: Crédito pagado
- **WHEN** "Libre inversión" quedó en saldo $0 en octubre y se crea noviembre con `COPIAR`
- **THEN** noviembre no trae "Cuota libre inversión"

#### Scenario: Ingresos al crear el mes
- **WHEN** en octubre "Salario Daniel" se editó a $6.500.000 en la opción y se agregó "Venta bicicleta", y se crea noviembre con `COPIAR`
- **THEN** noviembre trae "Salario Daniel" por $6.288.000, el neto de Ajustes, y "Venta bicicleta" copiada

#### Scenario: Crédito que empieza después
- **WHEN** "Johana" tiene "Primera cuota: diciembre 2026" y, con hoy 3 nov, se crea noviembre con `COPIAR`
- **THEN** noviembre no trae "Cuota johana"; al crear diciembre, sí
