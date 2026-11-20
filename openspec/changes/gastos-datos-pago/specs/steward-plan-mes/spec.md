## ADDED Requirements

### Requirement: Datos de pago de un gasto
Un ítem del plan, salvo los de tipo `DIEZMO`, SHALL poder tener datos de pago opcionales:
- enlace de pago: una dirección `http://` o `https://` de hasta 500 caracteres;
- código de usuario o referencia: texto de 1 a 60 caracteres.

Un enlace con otro esquema o más largo, o un código más largo, MUST responder 400 `DATOS_INVALIDOS`. Un texto vacío quita ese dato. Editar un ítem sin indicar sus datos de pago MUST conservar los guardados.

En la hoja del gasto, los datos de pago SHALL ir en una sección plegada "Datos de pago (opcional)", cerrada si el gasto no tiene datos, con la nota de no guardar contraseñas.

Al crear el plan de un mes copiando el anterior o solo con los fijos, cada ítem copiado MUST traer sus datos de pago.

Al guardar un ítem cuyos datos de pago cambiaron, "Aplicar también a los meses ya planeados" (marcado por defecto) SHALL poner los mismos datos en los ítems con el mismo nombre (sin distinguir mayúsculas ni espacios de los extremos) y la misma categoría de las otras opciones del mismo mes y de los meses posteriores que no estén cerrados (en todas sus opciones), y en los mes base del plan anual del año de ese mes o posteriores. Los meses cerrados y los anteriores no cambian. Sin la casilla, solo cambia ese ítem.

#### Scenario: Agregar los datos de pago de Internet
- **WHEN** en la Opción A de noviembre se abre "Internet", se pone el enlace `https://pagos.ejemplo.com` y el código `123456`, y se guarda con la casilla marcada
- **THEN** Internet de noviembre y el Internet de diciembre y enero (ya planeados) tienen ese enlace y ese código, y el otro miembro los ve

#### Scenario: Un mes cerrado no cambia
- **WHEN** octubre está cerrado y se aplican los datos de pago de Internet desde noviembre
- **THEN** Internet de octubre queda sin datos de pago

#### Scenario: Solo este mes
- **WHEN** se cambia el código de Agua de noviembre y se desmarca "Aplicar también a los meses ya planeados"
- **THEN** solo Agua de noviembre cambia

#### Scenario: El mes nuevo los trae
- **WHEN** Luz de enero tiene datos de pago y se crea febrero copiando enero
- **THEN** Luz de febrero tiene el mismo enlace y código

#### Scenario: Enlace inválido
- **WHEN** se guarda un gasto con el enlace `javascript:alert(1)` o `pagos.ejemplo.com`
- **THEN** responde 400 `DATOS_INVALIDOS` y el gasto no cambia

#### Scenario: Una versión anterior de la app edita el gasto
- **WHEN** se edita el monto de Gas desde una versión de la app que no envía datos de pago
- **THEN** Gas conserva su enlace y su código

#### Scenario: Sin datos de pago, todo igual
- **WHEN** un hogar nuevo agrega "Mercado" sin abrir "Datos de pago (opcional)"
- **THEN** el gasto se guarda como siempre, sin datos de pago
