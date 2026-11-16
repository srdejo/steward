# steward-tarjetas Specification

## Purpose
Las tarjetas de crédito del hogar: cuándo corta y cuándo se paga cada una, para qué se usa y cómo se paga. Cada tarjeta es una línea de la categoría Tarjetas en el plan del mes, y la app ayuda a no pagar tarde ni comprar el día equivocado. No lleva la deuda de la tarjeta ni sus compras.

## Requirements

### Requirement: Tarjetas del hogar
En Cuentas, la pestaña Tarjetas SHALL listar las tarjetas del hogar, con "+ Tarjeta" para agregar una. Cada tarjeta MUST tener:
- nombre (1 a 40 caracteres);
- día de corte y día de pago (de 1 a 31);
- un uso opcional (hasta 40 caracteres, por ejemplo "Mercado");
- cómo se paga: **completa** (el valor del extracto) o **pago fijo** de un monto mayor que cero.

Tocar una tarjeta SHALL abrir su hoja para cambiar esos datos o quitarla. Quitarla MUST pedir confirmación y MUST NOT borrar los pagos ya registrados. La app MUST NOT llevar la deuda de la tarjeta ni registrar sus compras.

En modo conectado, las tarjetas MUST guardarse en el backend y los dos miembros MUST ver las mismas.

#### Scenario: Agregar una tarjeta
- **WHEN** se agrega "Nu", corte día 13, pago día 28, uso "Mercado", que se paga completa
- **THEN** la pestaña Tarjetas la muestra con el chip "Mercado", "Corte día 13 · pago día 28" y "Se paga completa"

#### Scenario: Datos inválidos
- **WHEN** se intenta guardar una tarjeta con pago fijo de $0 o con día de corte 32
- **THEN** no se guarda y el botón de guardar sigue deshabilitado

#### Scenario: Tarjetas en modo conectado
- **WHEN** en modo conectado Daniel agrega la tarjeta "Visa"
- **THEN** Esposa la ve en su pestaña Tarjetas con los mismos días y el mismo uso

### Requirement: La tarjeta es una línea del plan
Cada tarjeta SHALL tener un ítem en la categoría Tarjetas en la opción en uso de cada mes que nace después de agregarla. El ítem se llama "Tarjeta {nombre}", con " · {uso}" si tiene uso, vence el día de pago y está enlazado a la tarjeta. Su monto:
- con pago fijo, MUST ser ese monto;
- si se paga completa, MUST ser el último valor pagado de esa tarjeta, o el monto estimado que se escribió al agregarla si todavía no se ha pagado.

Al agregar una tarjeta, si el mes en curso tiene plan y no está cerrado, y su día de pago de ese mes no ha pasado, su ítem MUST entrar a la opción en uso de ese mes; si ya pasó, la línea empieza el mes siguiente. Al agregarla también se puede elegir un ítem de Tarjetas o de Créditos que ya exista ("Tarjeta Mastercard"): ese ítem se enlaza a la tarjeta y pasa a Tarjetas, y no se crea otro. Cambiar el pago fijo MUST actualizar el ítem de los meses en Borrador; los meses Activos y Cerrados no cambian.

#### Scenario: Pago fijo en el plan
- **WHEN** Mastercard se paga con pago fijo de $1.500.000 el día 30 y nace el plan de noviembre
- **THEN** noviembre trae "Tarjeta Mastercard" por $1.500.000 en Tarjetas, que vence el día 30

#### Scenario: El día de pago ya pasó
- **WHEN** el 26 oct se agrega RappiCard, que paga el día 5
- **THEN** octubre no gana su línea, y el plan de noviembre, creado después, la trae

#### Scenario: Completa sigue al último extracto
- **WHEN** "Tarjeta Nu · Mercado" estaba planeada en $320.000 y en octubre se marcó pagada por $352.000
- **THEN** el plan de noviembre, creado después, trae "Tarjeta Nu · Mercado" por $352.000

#### Scenario: Enlazar un ítem que ya existe
- **WHEN** el plan de octubre tiene "Tarjeta Mastercard" en Créditos y se agrega la tarjeta Mastercard eligiendo ese ítem
- **THEN** octubre sigue con un solo ítem "Tarjeta Mastercard", ahora enlazado a la tarjeta y en Tarjetas

### Requirement: Pagar una tarjeta en Hoy
En Hoy, el ítem de una tarjeta SHALL mostrar su corte y cómo se paga: "Corte {día} · valor del extracto" si se paga completa, o "Corte {día} · pago fijo". Marcarla pagada MUST pedir el valor pagado, prellenado con el monto del ítem, y se registra como cualquier pago. El vencimiento y su color siguen las reglas de los demás ítems.

#### Scenario: Tarjeta por pagar
- **WHEN** el 26 oct, "Tarjeta Nu · Mercado" (corte 13, pago 28, completa) está por pagar
- **THEN** Hoy la muestra con "28 oct · en 2 días" en aviso y "Corte 13 · valor del extracto"

### Requirement: Próximas fechas de las tarjetas
La pestaña Tarjetas SHALL mostrar:
- arriba, **"Por pagar este ciclo"**: la suma del próximo pago de cada tarjeta (el monto de su ítem);
- las **próximas fechas**, desde hoy y durante 5 semanas: cada corte y cada pago, con la tarjeta y, en los pagos, el valor. En escritorio es un calendario de 5 semanas; en móvil, una lista;
- por tarjeta, el **próximo pago** (fecha, "en N días" y valor) y el **próximo corte**. El próximo pago MUST verse en rojo si faltan 3 días o menos, en aviso si faltan 7 o menos, y normal si faltan más;
- por tarjeta, una **ayuda**:
  - si se paga completa: "Lo que compres hasta el {corte} se paga el {pago}. Desde el {corte + 1}, el {pago siguiente}.";
  - si tiene pago fijo: "No se paga completa: el saldo que queda genera intereses.";
- en las próximas fechas, junto a cada corte: "Mejor día para una compra grande: {corte + 1}".

El pago que corresponde a un corte es el primer día de pago después del corte: el mismo mes si el día de pago es mayor que el de corte, y el mes siguiente si no.

#### Scenario: Fechas de Nu
- **WHEN** hoy es 26 oct y Nu corta el 13 y paga el 28
- **THEN** su próximo pago es "28 oct · en 2 días" en rojo, su próximo corte es "13 nov", y la ayuda dice "Lo que compres hasta el 13 nov se paga el 28 nov. Desde el 14 nov, el 28 dic."

#### Scenario: Pago al mes siguiente del corte
- **WHEN** hoy es 26 oct y Visa corta el 21 y paga el 6
- **THEN** su próximo pago es "6 nov · en 11 días", y lo comprado del 22 nov en adelante se paga el 6 ene

#### Scenario: Por pagar este ciclo
- **WHEN** las tarjetas son Nu ($320.000), Mastercard (pago fijo $1.500.000) y Visa ($800.000)
- **THEN** "Por pagar este ciclo" muestra $2.620.000
