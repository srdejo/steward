## ADDED Requirements

### Requirement: Abrir un registro para corregirlo
En Hoy, tocar un ítem de Ya pagado, un gasto "No estaba planeado", una línea de ingreso ya recibida o los aportes de una persona SHALL abrir una hoja con lo registrado (fecha, quién, cuánto, desde o hacia qué cuenta y la nota). Desde ahí MUST poder:
- **"Guardar"** un monto, una cuenta o una nota corregidos;
- **"Borrar este registro"**, con una confirmación que diga qué pasa: "Internet vuelve a Por pagar", "El saldo de Davivienda sube $120.000" o "Ya está en el cuadre de Davivienda: su saldo no cambia".

Un ítem con varios gastos (variable) o una persona con varios aportes MUST mostrar la lista de sus registros, cada uno con su corrección. Para la cuota de un crédito, la hoja MUST explicar que para cambiar el monto hay que borrar el pago y marcarlo otra vez.

En modo conectado, la corrección y el borrado MUST guardarse en el backend, y el otro miembro SHALL verlos al abrir la app.

#### Scenario: Borrar un gasto equivocado desde Hoy
- **WHEN** Hoy muestra "Farmacia (error)" por $95.000 en "No estaba planeado", se toca, y se confirma "Borrar este registro"
- **THEN** el gasto desaparece de Ya pagado, Pagado baja $95.000 y "Te queda libre" sube $95.000

#### Scenario: Corregir un pago
- **WHEN** se toca Internet en Ya pagado, pagado por $210.000, y se guarda con $120.000
- **THEN** Internet sigue en Ya pagado con $120.000 y "igual al plan"

#### Scenario: Deshacer un "Recibí"
- **WHEN** se tocó "Recibí" en "Salario Daniel" por error, se abre y se borra
- **THEN** "Salario Daniel" vuelve a "Por recibir"

### Requirement: Diezmo sin vencimiento
Un ítem de diezmo en Por pagar SHALL mostrar de dónde viene y cuándo llega su ingreso ("Del Salario Daniel · día 25", "Del aporte del 26 oct"), sin "Venció" ni color de alerta, porque no es una factura.

#### Scenario: Diezmo del salario
- **WHEN** hoy es 30 oct y "Diezmo · Salario Daniel" (día 25) está por pagar
- **THEN** Por pagar lo muestra con "Del Salario Daniel · día 25", sin rojo

## MODIFIED Requirements

### Requirement: Marcar un pago
Tocar un ítem de Por pagar SHALL abrir Marcar pago con el valor prellenado con el plan, quién pagó y desde qué cuenta (opcional, incluida "Su cuenta"). Un pago desde una cuenta externa ("Su cuenta") MUST contar además como aporte implícito de quien pagó en ese mes. Si el ítem ya estaba pagado, MUST avisar "Ya lo pagó {nombre} el {dd mmm}" en lugar de registrarlo otra vez, con acceso a abrir ese pago para corregirlo o borrarlo.

En modo conectado, el pago MUST registrarse en el backend. Si otro miembro ya lo pagó, el aviso MUST venir del backend, aunque esta pantalla aún no mostrara ese pago, y Hoy SHALL quedar con el ítem en Ya pagado.

#### Scenario: Pago directo
- **WHEN** Esposa marca pagada la Tarjeta Mastercard por $1.500.000 desde "Su cuenta"
- **THEN** la tarjeta pasa a Ya pagado con el avatar E, y Aportes Esposa sube $1.500.000 y suma un pago directo

#### Scenario: Pago duplicado
- **WHEN** se intenta marcar Recibo Luz, que ya pagó Esposa el 12 oct
- **THEN** se muestra "Ya lo pagó Esposa el 12 oct" y no se crea otro pago

#### Scenario: Lo pagó el otro miembro hace un momento
- **WHEN** en modo conectado Daniel tiene Hoy abierto desde antes de que Esposa pagara Internet, y toca Internet en Por pagar y guarda
- **THEN** se muestra "Ya lo pagó Esposa el {fecha}" e Internet pasa a Ya pagado
