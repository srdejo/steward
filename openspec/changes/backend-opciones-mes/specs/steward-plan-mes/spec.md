## ADDED Requirements

### Requirement: Duplicar una opción
Un miembro SHALL poder duplicar una opción de un mes en Borrador, igual que `duplicarEscenario` del dominio. La copia:
- toma la siguiente letra libre (A, B, C…);
- la propone quien la crea, con una nota opcional;
- trae los mismos ítems, sin avanzar las cuotas, con su crédito si lo tienen.

El mes debe seguir en Borrador según su estado efectivo: un mes en curso con opción elegida ya es Activo. Si no, MUST responder 409 `MES_NO_BORRADOR`. Un mes Cerrado responde `MES_CERRADO`. Con 26 opciones, MUST responder 409 `MUCHAS_OPCIONES`. Una opción de otro hogar MUST responder 404 `PLAN_NO_ENCONTRADO`.

#### Scenario: Duplicar la Opción A
- **WHEN** noviembre está en Borrador con la Opción A, propuesta por Daniel, y Esposa la duplica
- **THEN** noviembre tiene la Opción B, propuesta por Esposa, con los mismos ítems que A

#### Scenario: Mes Activo
- **WHEN** octubre es el mes en curso con la Opción A en uso y se intenta duplicarla
- **THEN** responde 409 `MES_NO_BORRADOR` y octubre sigue con solo la Opción A

### Requirement: Quitar una opción
Un miembro SHALL poder quitar una opción de un mes en Borrador. Se borra con sus ítems, no se archiva, y su letra queda libre para la próxima opción.

No se quita:
- la última opción vigente del mes: MUST responder 409 `ULTIMA_OPCION`;
- la opción en uso (la elegida con "Usar"): MUST responder 409 `OPCION_EN_USO`;
- una opción con pagos o gastos en el mes: MUST responder 409 `OPCION_CON_PAGOS`;
- una opción de un mes que no está en Borrador: 409 `MES_NO_BORRADOR` o `MES_CERRADO`.

Una opción de otro hogar MUST responder 404 `PLAN_NO_ENCONTRADO`.

#### Scenario: Quitar la Opción C
- **WHEN** noviembre está en Borrador con las opciones A, B y C, y Esposa quita la C
- **THEN** noviembre queda con A y B, y el siguiente "+ Duplicar" vuelve a crear la C

#### Scenario: La última opción
- **WHEN** noviembre solo tiene la Opción A y se intenta quitarla
- **THEN** responde 409 `ULTIMA_OPCION` y la Opción A sigue

#### Scenario: La opción en uso
- **WHEN** noviembre tiene la Opción B en uso y se intenta quitar la B
- **THEN** responde 409 `OPCION_EN_USO`

### Requirement: Probar un abono como opción
Un miembro SHALL poder probar un abono extra a un crédito del hogar como opción de un mes, igual que `probarAbonoComoOpcion` del dominio:
- si el mes no tiene plan, se crea copiando el mes anterior;
- se duplica la opción principal del mes, con la nota "abono a crédito";
- la copia gana el ítem "Abono extra {nombre del crédito en minúsculas}" en la categoría de créditos, de tipo `CREDITO`, enlazado al crédito, por el monto del abono y con el día de pago del crédito como vencimiento.

Responde el plan y la opción nueva. Un abono de cero o menos MUST responder 400 `DATOS_INVALIDOS`. Un crédito de otro hogar, 404 `CREDITO_NO_ENCONTRADO`. Un mes que ya no está en Borrador, 409 `MES_NO_BORRADOR`.

#### Scenario: Probarlo como opción de noviembre
- **WHEN** noviembre está en Borrador con la Opción A y se prueba un abono de $2.000.000 a "Libre inversión"
- **THEN** noviembre gana la Opción B, igual a A más "Abono extra libre inversión" por $2.000.000 en Créditos

#### Scenario: Mes sin plan
- **WHEN** diciembre no tiene plan y se prueba un abono como opción de diciembre
- **THEN** diciembre queda en Borrador con la Opción A copiada de noviembre y la Opción B con el abono

## MODIFIED Requirements

### Requirement: Usar la opción y estados del mes
"Usar opción" SHALL dejar esa opción como la que se ejecuta en el mes y archivar las demás, sin borrarlas, igual que `usarEscenario` del dominio. El estado del mes sigue al dominio:
- un mes en Borrador con opción elegida pasa a Activo cuando llega su mes, sin que nadie lo cambie;
- en un mes Activo, "Usar" solo puede volver a elegir la opción que ya está en uso. Elegir otra MUST responder 409 `MES_NO_BORRADOR`, porque los pagos del mes ya están hechos contra los ítems de la opción en uso;
- en un mes en Borrador, elegir otra opción también MUST responder 409 `MES_NO_BORRADOR` si la opción principal ya tiene pagos o gastos en el mes (el mes en curso sin opción elegida);
- un mes Cerrado (el plan en Cerrado, o el mes con su cierre guardado aunque no tenga plan) MUST NOT admitir cambios en su plan, crear su plan ni registros de pagos, gastos o aportes, y responde 409 `MES_CERRADO`.

#### Scenario: Usar la Opción A de noviembre
- **WHEN** hoy es 28 oct y se usa la Opción A de noviembre
- **THEN** noviembre sigue en Borrador con la Opción A elegida, y el 1 de noviembre se lee como Activo

#### Scenario: Usar otra opción archiva las demás
- **WHEN** noviembre está en Borrador con las opciones A, B y C, y se usa la B
- **THEN** la B queda como el plan de noviembre, y la A y la C quedan archivadas, con sus ítems

#### Scenario: Cambiar de opción en un mes Activo
- **WHEN** octubre es el mes en curso con la Opción A en uso y archivada la B, y se intenta usar la B
- **THEN** responde 409 `MES_NO_BORRADOR` y octubre sigue con la Opción A

#### Scenario: Otra opción cuando ya hay pagos
- **WHEN** octubre es el mes en curso sin opción elegida, se pagó Internet de la Opción A y se intenta usar la B
- **THEN** responde 409 `MES_NO_BORRADOR` y el pago sigue contra la Opción A

#### Scenario: Mes cerrado
- **WHEN** septiembre está Cerrado y se intenta agregarle un ítem
- **THEN** responde 409 `MES_CERRADO`

#### Scenario: Mes cerrado sin plan
- **WHEN** agosto no tenía plan, se cerró, y se intenta crear su plan
- **THEN** responde 409 `MES_CERRADO`
