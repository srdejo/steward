# steward-plan-mes Specification

## Purpose
Define en el backend el plan de cada mes del hogar: las categorías, el mes con su Opción A y sus ítems, sus estados (Borrador, Activo, Cerrado) y quién puede cambiarlo, con el aislamiento entre hogares.

## Requirements

### Requirement: Categorías del hogar
Todo hogar SHALL tener desde que se crea las cuatro categorías del sistema:
- Gastos fijos (tipo FIJO);
- Tarjetas y cuotas (TARJETA);
- Variables (VARIABLE);
- Créditos (CREDITO).

Cualquier miembro MUST poder crear una categoría con un nombre (1 a 40 caracteres) y renombrar cualquiera, también las del sistema. Las del sistema no se borran. Las reglas son las del dominio compartido:
- "Diezmo" (sin distinguir mayúsculas) MUST responder 400 `RESERVADA`, porque el diezmo se calcula solo;
- un nombre que ya usa otra categoría del hogar MUST responder 409 `DUPLICADA`.

#### Scenario: Hogar nuevo
- **WHEN** un usuario crea "Nuestra casa"
- **THEN** el hogar tiene Gastos fijos, Tarjetas y cuotas, Variables y Créditos, en ese orden

#### Scenario: Nueva categoría
- **WHEN** un miembro crea "Educación"
- **THEN** la categoría queda en el hogar, después de las del sistema, y se puede usar en los ítems del plan

#### Scenario: Diezmo no es categoría
- **WHEN** un miembro intenta crear la categoría "diezmo"
- **THEN** responde 400 `RESERVADA` y no se crea nada

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

### Requirement: Usar la opción y estados del mes
"Usar opción" SHALL dejar esa opción como la que se ejecuta en el mes. El estado del mes sigue al dominio:
- un mes en Borrador con opción elegida pasa a Activo cuando llega su mes, sin que nadie lo cambie;
- un mes Cerrado (el plan en Cerrado, o el mes con su cierre guardado aunque no tenga plan) MUST NOT admitir cambios en su plan, crear su plan ni registros de pagos, gastos o aportes, y responde 409 `MES_CERRADO`.

En esta etapa solo existe la Opción A: duplicar opciones llega con la Etapa 7.

#### Scenario: Usar la Opción A de noviembre
- **WHEN** hoy es 28 oct y se usa la Opción A de noviembre
- **THEN** noviembre sigue en Borrador con la Opción A elegida, y el 1 de noviembre se lee como Activo

#### Scenario: Mes cerrado
- **WHEN** septiembre está Cerrado y se intenta agregarle un ítem
- **THEN** responde 409 `MES_CERRADO`

#### Scenario: Mes cerrado sin plan
- **WHEN** agosto no tenía plan, se cerró, y se intenta crear su plan
- **THEN** responde 409 `MES_CERRADO`

### Requirement: Aislamiento del plan
El plan, sus opciones, sus ítems y las categorías SHALL resolverse a partir del hogar del usuario de la sesión. Los de otro hogar MUST NOT poder leerse ni modificarse, y un id ajeno MUST responder igual que uno inexistente (404). Sin sesión, MUST responder 401.

#### Scenario: Plan de otro hogar
- **WHEN** un miembro de otro hogar intenta agregar un ítem a la Opción A de "Nuestra casa" usando sus ids
- **THEN** responde 404 y la opción no cambia

### Requirement: Cerrar el mes
Un miembro SHALL poder cerrar un mes del hogar ("Cerrar {mes}") enviando la foto del cierre que calcula el dominio compartido (`vistaCierre`):
- las filas plan vs. real (nombre, plan o vacío, real);
- "Sin registrar";
- el sobrante;
- el reparto: lo que va a ahorro y lo que pasa al mes siguiente;
- el orden del último movimiento del mes con que se calculó la foto.

El backend MUST validar:
- **El mes:** es el mes en curso o uno anterior. Un mes futuro MUST responder 400 `DATOS_INVALIDOS`.
- **El reparto:** los dos montos son de cero en adelante y suman exactamente el sobrante, o cero si no sobró. Si no, MUST responder 400 `REPARTO_INVALIDO`.
- **"Sin registrar":** es la suma de los ajustes de cuadre del mes. Si no, MUST responder 409 `CIERRE_DESACTUALIZADO`.
- **Lo registrado:** ningún movimiento del mes es posterior al orden que trae la foto. Si lo hay, MUST responder 409 `CIERRE_DESACTUALIZADO` con el mensaje "Alguien registró algo en {mes}; revisa el cierre otra vez".
- **Una sola vez:** un mes ya cerrado MUST responder 409 `MES_CERRADO`, aunque dos personas cierren a la vez.

Al cerrar:
- se guardan la foto, quién cerró y la fecha;
- si el mes tiene plan, su estado pasa a Cerrado;
- el mes queda en solo lectura.

Cerrar no se deshace.

#### Scenario: Cerrar octubre
- **WHEN** octubre terminó con $3.166.000 y Daniel lo cierra con $2.000.000 a ahorro y $1.166.000 a noviembre
- **THEN** octubre queda Cerrado con ese reparto, a nombre de Daniel, y Esposa lo ve así al leer las finanzas

#### Scenario: Reparto que no suma
- **WHEN** el sobrante es $3.166.000 y el reparto es $2.000.000 y $1.000.000
- **THEN** responde 400 `REPARTO_INVALIDO` y octubre sigue abierto

#### Scenario: Alguien registró algo mientras tanto
- **WHEN** Daniel calculó el cierre y antes de cerrar Esposa registra un gasto en octubre
- **THEN** responde 409 `CIERRE_DESACTUALIZADO` y octubre sigue abierto

#### Scenario: Mes futuro
- **WHEN** hoy es 29 oct y se intenta cerrar noviembre
- **THEN** responde 400 `DATOS_INVALIDOS`

#### Scenario: Cerrar dos veces
- **WHEN** octubre ya está cerrado y se intenta cerrar otra vez
- **THEN** responde 409 `MES_CERRADO` y el cierre guardado no cambia
