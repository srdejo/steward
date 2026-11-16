## ADDED Requirements

### Requirement: Eliminar un crédito del hogar
Un miembro SHALL poder eliminar un crédito de su hogar con `DELETE /api/creditos/{id}`, que responde 204. En una sola transacción:
- los movimientos del crédito (cuotas y abonos) MUST quedar sin crédito, sin cambiar su monto ni su cuenta;
- en los planes del mes en curso en adelante que no estén cerrados, los ítems enlazados al crédito que no tengan movimientos MUST borrarse;
- los demás ítems enlazados quedan sin crédito;
- el crédito se borra.

Un crédito que no existe o que es de otro hogar MUST responder 404 con `codigo` `CREDITO_NO_ENCONTRADO`.

#### Scenario: Eliminar un crédito con una cuota pagada
- **WHEN** el hogar tiene "Libre inversión" con la cuota de octubre pagada y la de noviembre en el plan, y Daniel lo elimina
- **THEN** responde 204, `GET /api/creditos` ya no lo trae, el pago de octubre sigue en las finanzas sin `creditoId`, octubre conserva el ítem con ese pago y noviembre ya no tiene la cuota

#### Scenario: Crédito de otro hogar
- **WHEN** Daniel intenta eliminar un crédito de otro hogar
- **THEN** responde 404 `CREDITO_NO_ENCONTRADO` y el crédito no cambia
