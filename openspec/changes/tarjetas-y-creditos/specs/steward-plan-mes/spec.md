## MODIFIED Requirements

### Requirement: Categorías del hogar
Todo hogar SHALL tener desde que se crea las cinco categorías del sistema:
- Diezmo (tipo DIEZMO);
- Gastos fijos (tipo FIJO);
- Variables (VARIABLE);
- Tarjetas (TARJETA), con las líneas de las tarjetas de crédito (spec `steward-tarjetas`), color #7C4DDB;
- Créditos (CREDITO), con las compras a cuotas y los préstamos.

Un hogar que tenía la categoría "Tarjetas y cuotas" (TARJETA) MUST quedar así: sus ítems, en los planes de cada mes y en el plan anual, pasan a Créditos con su mismo monto, y cada compra a cuotas se vuelve un crédito con plan de pagos. La categoría Tarjetas MUST existir en todo hogar, y la línea de cada tarjeta MUST estar en ella, también la de un ítem que se enlaza a una tarjeta. El plan de cada mes MUST conservar el total.

Cualquier miembro MUST poder crear una categoría con un nombre (1 a 40 caracteres) y renombrar cualquiera, también las del sistema, salvo "Diezmo", que MUST NOT renombrarse (400 `RESERVADA`). Las del sistema no se borran. Las reglas son las del dominio compartido:
- "Diezmo" (sin distinguir mayúsculas) MUST responder 400 `RESERVADA`, porque ya es la categoría del sistema;
- un nombre que ya usa otra categoría del hogar MUST responder 409 `DUPLICADA`.

#### Scenario: Hogar nuevo
- **WHEN** un usuario crea "Nuestra casa"
- **THEN** el hogar tiene Diezmo, Gastos fijos, Variables, Tarjetas y Créditos, en ese orden

#### Scenario: Hogar con Tarjetas y cuotas
- **WHEN** un hogar tenía en octubre "Tarjetas y cuotas" con $2.675.000 y Créditos con $500.000, y se aplica la migración
- **THEN** octubre muestra Créditos con $3.175.000, no aparece "Tarjetas y cuotas", Tarjetas está vacía hasta que se agregan las tarjetas, y el total del plan es el mismo

#### Scenario: La línea de una tarjeta va en Tarjetas
- **WHEN** se agrega la tarjeta Mastercard enlazando el ítem "Tarjeta Mastercard" que estaba en Créditos
- **THEN** el ítem pasa a la categoría Tarjetas con su monto, y Créditos baja ese monto

#### Scenario: Nueva categoría
- **WHEN** un miembro crea "Educación"
- **THEN** la categoría queda en el hogar, después de las del sistema, y se puede usar en los ítems del plan

#### Scenario: Diezmo no es categoría
- **WHEN** un miembro intenta crear la categoría "diezmo", o renombrar la categoría Diezmo
- **THEN** responde 400 `RESERVADA` y no se crea ni se renombra nada
