## ADDED Requirements

### Requirement: Detalle de crédito en escritorio
Desde 1024 px de ancho, el detalle de un crédito SHALL usar el ancho de escritorio, con lo mismo que en móvil, ordenado así:
- **Encabezado:** la entidad, el nombre, el saldo y su fecha. A la derecha, "Corregir con extracto" y "Registrar abono".
- **Cuatro indicadores:**
  - **Cuota:** el monto y "Día N de cada mes";
  - **Pagado:** el porcentaje, su barra, el total original y, si se sabe, "cuota N de M";
  - **Termina:** el mes (con "≈" si se calcula con la tasa) y las cuotas que faltan;
  - **Intereses en {año siguiente}:** se muestra solo si los hay.
- **Próximas cuotas:** hasta 12, cada una con su mes, una barra de capital e interés, el interés, el capital y lo que queda.
- **Últimos pagos:** cada uno con su fecha, su tipo (cuota o abono), la cuenta de donde salió y el monto.
- **Al lado:**
  - cómo baja el saldo, con "Cambiar";
  - "¿Y si abonas extra?", con "Probarlo como opción";
  - "¿Ya no lo tienen?", con "Eliminar crédito".

Por debajo de 1024 px, el detalle se ve como hoy.

#### Scenario: Libre inversión en escritorio
- **WHEN** a 1280 px se abre el crédito Libre inversión de los datos de prueba
- **THEN** se ven los indicadores Cuota "$500.000 · Día 15 de cada mes", Pagado y Termina; la tabla tiene 12 próximas cuotas; y al lado está "Eliminar crédito"

### Requirement: Eliminar un crédito
El detalle de un crédito SHALL ofrecer "Eliminar crédito", en la web y en la app. Antes de eliminarlo, una hoja MUST decir:
- que sale de Créditos;
- que su cuota sale del plan del mes en curso y de los siguientes;
- cuántos pagos registrados se conservan.

Al confirmar:
- el crédito deja de aparecer en Créditos y en "Deben en créditos";
- sus pagos y abonos MUST quedar en el historial de las cuentas, sin crédito;
- en el mes en curso y en los siguientes que no estén cerrados, los ítems enlazados al crédito sin pagos ni gastos MUST quitarse;
- los ítems con pagos, y los de meses anteriores o cerrados, se quedan sin enlace;
- al terminar, vuelve a la pestaña Créditos.

En modo conectado va a `DELETE /api/creditos/{id}`.

#### Scenario: Eliminar la compra a cuotas
- **WHEN** en octubre, con la cuota de la compra a cuotas sin pagar, Daniel elimina "Compra a cuotas"
- **THEN** ya no aparece en Créditos, "Deben en créditos" baja $3.375.000, y la Opción A de octubre y las opciones de noviembre ya no tienen "Compra a cuotas"

#### Scenario: Una cuota ya pagada se queda
- **WHEN** Daniel elimina "Libre inversión", cuya cuota de octubre ya está pagada
- **THEN** octubre conserva "Cuota libre inversión" con su pago, sin crédito; noviembre ya no tiene la cuota, y el pago sigue en el historial de Davivienda
