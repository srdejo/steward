## ADDED Requirements

### Requirement: Corregir o borrar un registro
Un miembro SHALL poder corregir o borrar un pago, un gasto, un ingreso recibido o un aporte de su hogar, de un mes no cerrado:
- **corregir** cambia el monto (mayor que cero), la cuenta de origen o destino y la nota (los gastos);
- **borrar** lo quita.

Las reglas son las del dominio compartido:
- un pago borrado deja su ítem otra vez por pagar;
- un ingreso recibido borrado deja su línea otra vez por recibir;
- un aporte borrado quita también su ítem de diezmo si este no tiene pagos; si ya tiene pagos, el ítem queda sin enlace;
- el saldo estimado de una cuenta sigue lo que queda registrado después de su último cuadre: corregir o borrar un registro que ya está incluido en un cuadre MUST NOT cambiar el saldo de esa cuenta;
- el pago de la cuota de un crédito y un abono registran cuánto bajó el saldo del crédito (`capital`); al borrarlo, el saldo del crédito MUST subir ese monto. Uno registrado antes de este cambio, sin `capital`, se borra sin tocar el saldo del crédito;
- el monto del pago de una cuota de crédito MUST NOT corregirse: se borra y se marca otra vez.

Un registro de otro hogar o inexistente MUST responder 404 `REGISTRO_NO_ENCONTRADO`. Las transferencias, los ajustes de cuadre, los abonos y las entregas de diezmo de antes MUST NOT corregirse ni borrarse por aquí (400 `DATOS_INVALIDOS`).

#### Scenario: Borrar un gasto equivocado
- **WHEN** octubre tiene el gasto "Farmacia" por $95.000 que no era de este hogar, y se borra
- **THEN** el gasto ya no está, y Pagado y "Te queda libre" de octubre vuelven a como estaban

#### Scenario: Corregir el monto de un pago
- **WHEN** Internet se marcó pagado por $210.000 en vez de $120.000 desde Davivienda, y se corrige a $120.000
- **THEN** el pago queda en $120.000 y el saldo estimado de Davivienda sube $90.000

#### Scenario: Borrar el pago de una cuota
- **WHEN** se pagó "Cuota libre inversión" por $500.000 y bajó el saldo del crédito $272.000, y se borra ese pago
- **THEN** la cuota vuelve a Por pagar y el saldo del crédito sube $272.000

#### Scenario: Registro ya cuadrado
- **WHEN** el pago de Arriendo desde Davivienda quedó incluido en un cuadre de Davivienda, y se borra
- **THEN** el pago se borra y el saldo de Davivienda no cambia

### Requirement: Un ingreso fijo editado actualiza los meses abiertos
Cuando un miembro cambia el neto o el bruto de su ingreso fijo en Ajustes, las líneas `FIJO` enlazadas a ese ingreso en las opciones de los planes no cerrados del mes en curso en adelante SHALL actualizarse al valor nuevo, si todavía tenían el valor anterior y no se han recibido en su mes. Sus ítems de diezmo se recalculan según "El diezmo sigue a su línea de ingreso" (spec `steward-plan-mes`). Las líneas que se habían cambiado a mano y los meses anteriores MUST NOT cambiar.

#### Scenario: Aumento de salario
- **WHEN** octubre (Activo, sin recibir) y noviembre tienen "Salario Daniel" con $4.800.000 neto y $5.100.000 bruto, y Daniel cambia en Ajustes el neto a $5.200.000 y el bruto a $5.500.000
- **THEN** las dos líneas pasan a $5.200.000 neto y $5.500.000 bruto, y sus diezmos (10 % del bruto) a $550.000

#### Scenario: Una línea cambiada a mano
- **WHEN** en la Opción B de noviembre "Salario Daniel" estaba en $6.000.000, y Daniel cambia su salario en Ajustes
- **THEN** la línea de la Opción B sigue en $6.000.000

## MODIFIED Requirements

### Requirement: Registros en un mes cerrado
En un mes cerrado, estos registros MUST responder 409 `MES_CERRADO` y no registrar nada, como `asegurarAbierto` del dominio:
- "Recibí";
- marcar un pago;
- registrar un gasto;
- registrar un aporte para ese mes;
- corregir o borrar un registro de ese mes.

Para cambiar un mes cerrado hay que borrar antes su plan ("Borrar el plan de un mes", spec `steward-plan-mes`).

Cuadrar cuentas, mover dinero y registrar un abono a un crédito no dependen del plan del mes y MUST seguir funcionando aunque el mes en curso esté cerrado. Sus movimientos no cambian el cierre guardado.

#### Scenario: Recibir en un mes cerrado
- **WHEN** octubre está cerrado y se marca recibido "Salario Daniel" en octubre
- **THEN** responde 409 `MES_CERRADO` y no queda ningún ingreso nuevo

#### Scenario: Aporte para el mes siguiente
- **WHEN** el 30 oct octubre ya está cerrado y se registra un aporte para noviembre
- **THEN** el aporte queda en noviembre

#### Scenario: Cuadrar con el mes cerrado
- **WHEN** octubre está cerrado y el 30 oct se cuadra Davivienda con una diferencia
- **THEN** la cuenta queda cuadrada y el cierre de octubre guardado no cambia

#### Scenario: Borrar un registro de un mes cerrado
- **WHEN** septiembre está cerrado y se intenta borrar un gasto de septiembre
- **THEN** responde 409 `MES_CERRADO` y el gasto sigue
