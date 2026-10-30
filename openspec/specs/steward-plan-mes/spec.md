# steward-plan-mes Specification

## Purpose
Define en el backend el plan de cada mes del hogar: las categorías, el mes con su Opción A y sus ítems, sus estados (Borrador, Activo, Cerrado) y quién puede cambiarlo, con el aislamiento entre hogares.

## Requirements

### Requirement: Categorías del hogar
Todo hogar SHALL tener desde que se crea las cinco categorías del sistema:
- Diezmo (tipo DIEZMO);
- Gastos fijos (tipo FIJO);
- Tarjetas y cuotas (TARJETA);
- Variables (VARIABLE);
- Créditos (CREDITO).

Cualquier miembro MUST poder crear una categoría con un nombre (1 a 40 caracteres) y renombrar cualquiera, también las del sistema, salvo "Diezmo", que MUST NOT renombrarse (400 `RESERVADA`). Las del sistema no se borran. Las reglas son las del dominio compartido:
- "Diezmo" (sin distinguir mayúsculas) MUST responder 400 `RESERVADA`, porque ya es la categoría del sistema;
- un nombre que ya usa otra categoría del hogar MUST responder 409 `DUPLICADA`.

#### Scenario: Hogar nuevo
- **WHEN** un usuario crea "Nuestra casa"
- **THEN** el hogar tiene Diezmo, Gastos fijos, Tarjetas y cuotas, Variables y Créditos, en ese orden

#### Scenario: Nueva categoría
- **WHEN** un miembro crea "Educación"
- **THEN** la categoría queda en el hogar, después de las del sistema, y se puede usar en los ítems del plan

#### Scenario: Diezmo no es categoría
- **WHEN** un miembro intenta crear la categoría "diezmo", o renombrar la categoría Diezmo
- **THEN** responde 400 `RESERVADA` y no se crea ni se renombra nada

### Requirement: Crear el plan de un mes
Un miembro SHALL poder crear el plan de un mes que no tiene plan, en estado Borrador y con una Opción A propuesta por él, de una de tres formas, igual que `crearMes` del dominio:
- "Copiar mes anterior" (`COPIAR`): los ítems de la opción principal del mes anterior. Las compras a cuotas avanzan una cuota, y las que ya terminaron no se copian.
- "Solo fijos e ingresos" (`FIJOS`): lo mismo, pero los ítems variables quedan en $0.
- "Desde cero" (`CERO`): sin ítems, salvo las cuotas de los créditos.

En las tres formas, los créditos del hogar MUST quedar en el mes así:
- cada crédito con saldo mayor que cero que no tenga ya un ítem enlazado en la opción gana su cuota, como al agregarlo (Créditos, tipo `CREDITO`, "Cuota {nombre en minúsculas}", su cuota y su día de pago);
- un ítem copiado de un crédito con saldo $0 no se copia.

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

### Requirement: Ítems de la opción
Un miembro SHALL poder agregar, editar y quitar ítems de una opción del plan. Cada ítem tiene:
- nombre (1 a 60 caracteres) y monto (cero o más);
- categoría del hogar;
- tipo `FIJO`, `VARIABLE`, `CUOTA`, `CREDITO` o `DIEZMO`;
- día de vencimiento opcional (1 a 31);
- para las compras a cuotas, cuota actual y total;
- para los de tipo `CREDITO`, el crédito del hogar al que corresponde, opcional;
- para los de tipo `DIEZMO`, el ingreso fijo o el aporte que lo origina, opcional.

Datos inválidos MUST responder 400 `DATOS_INVALIDOS`. Una categoría de otro hogar MUST responder 404 `CATEGORIA_NO_ENCONTRADA`, y un crédito de otro hogar, 404 `CREDITO_NO_ENCONTRADO`. Editar un ítem conserva su crédito y el ingreso o aporte que lo origina si no se indica otro. Quitar un ítem que ya tiene pagos o gastos en su mes MUST responder 409 `ITEM_CON_PAGOS` y no quitarlo.

#### Scenario: Agregar un gasto fijo
- **WHEN** en la Opción A de noviembre se agrega "Internet" por $120.000 en Gastos fijos, que vence el día 15
- **THEN** la opción tiene ese ítem, y el otro miembro lo ve al leer el plan

#### Scenario: Ítem con pagos
- **WHEN** se intenta quitar Recibo Luz de octubre, que ya tiene un pago
- **THEN** responde 409 `ITEM_CON_PAGOS` y el ítem sigue en el plan

#### Scenario: Cambiar el monto de la cuota
- **WHEN** en Planear se cambia "Cuota libre inversión" de noviembre a $550.000
- **THEN** el ítem sigue enlazado a "Libre inversión", y pagarlo en noviembre baja su saldo

#### Scenario: Editar el diezmo
- **WHEN** un miembro cambia "Diezmo · Salario Daniel" de noviembre a $750.000
- **THEN** el ítem queda en $750.000, sigue enlazado a "Salario Daniel", y el otro miembro lo ve así

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

### Requirement: Duplicar una opción
Un miembro SHALL poder duplicar una opción de un mes en Borrador, igual que `duplicarEscenario` del dominio. La copia:
- toma la siguiente letra libre (A, B, C…);
- la propone quien la crea, con una nota opcional;
- trae los mismos ítems, sin avanzar las cuotas, con su crédito, su ingreso o su aporte si lo tienen;
- trae las mismas líneas de ingreso, con sus montos.

El mes debe seguir en Borrador según su estado efectivo: un mes en curso con opción elegida ya es Activo. Si no, MUST responder 409 `MES_NO_BORRADOR`. Un mes Cerrado responde `MES_CERRADO`. Con 26 opciones, MUST responder 409 `MUCHAS_OPCIONES`. Una opción de otro hogar MUST responder 404 `PLAN_NO_ENCONTRADO`.

#### Scenario: Duplicar la Opción A
- **WHEN** noviembre está en Borrador con la Opción A, propuesta por Daniel, y Esposa la duplica
- **THEN** noviembre tiene la Opción B, propuesta por Esposa, con los mismos ítems y las mismas líneas de ingreso que A

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

### Requirement: Ítems de diezmo
El diezmo SHALL presupuestarse como gasto: cada diezmo es un ítem independiente de tipo `DIEZMO`, en la categoría "Diezmo", enlazado al ingreso que lo origina. Su monto es el que sugiere la regla de diezmo del dueño del ingreso: el porcentaje sobre el bruto o el neto según la base, redondeado al peso más cercano con las mitades hacia arriba.

Los ítems de diezmo nacen así, con las mismas cifras que el dominio compartido:
- **Al crear el plan de un mes**, en las tres formas, la Opción A gana un ítem "Diezmo · {nombre del ingreso}" por cada ingreso fijo activo del hogar cuyo dueño tiene la regla activa, y uno "Diezmo · {nombre del evento}" por cada evento de ingreso del plan anual de ese mes con un miembro que tiene la regla activa (sobre el monto del evento). Estos ítems MUST NOT copiarse del mes anterior: se calculan de nuevo con la regla y el ingreso de ese momento, aunque la línea de ingreso de la opción se haya editado.
- **Al registrar un aporte con "Aplicar diezmo"**, el aporte gana su propio ítem "Diezmo · aporte {fecha corta}" con el porcentaje de la regla de quien aportó (10 % si no tiene regla) sobre el monto del aporte:
  - si el mes del aporte tiene plan y no está cerrado, en su opción principal (la que está en uso, o la Opción A mientras ninguna lo está);
  - si el mes no tiene plan, en la Opción A cuando se cree.

Un ítem de diezmo MUST poder editarse (nombre, monto, día), quitarse y marcarse pagado como cualquier otro ítem, con las mismas reglas. Cambiar después la regla o el ingreso MUST NOT cambiar los ítems ya creados. Un miembro también MUST poder agregar a mano un ítem en la categoría "Diezmo".

#### Scenario: Diezmo del salario al crear el mes
- **WHEN** Daniel tiene diezmo activo 10 % del bruto y "Salario Daniel" de $7.000.000 bruto, y se crea noviembre "Desde cero"
- **THEN** la Opción A de noviembre tiene "Diezmo · Salario Daniel" por $700.000 en la categoría Diezmo, enlazado a ese ingreso

#### Scenario: Un diezmo por cada ingreso
- **WHEN** Daniel (10 % del bruto) y Esposa (10 % del neto) tienen cada uno su salario, y se crea noviembre con `COPIAR`
- **THEN** noviembre tiene dos ítems de diezmo, uno por cada salario, cada uno con su propio monto

#### Scenario: Sin regla, sin ítem
- **WHEN** Esposa no tiene regla activa y se crea noviembre
- **THEN** su salario no genera ítem de diezmo

#### Scenario: No se copia el monto editado
- **WHEN** en octubre "Diezmo · Salario Daniel" se editó a $750.000, y se crea noviembre con `COPIAR`
- **THEN** noviembre trae "Diezmo · Salario Daniel" por $700.000, el que sugiere la regla, y un solo ítem de diezmo por ese salario

#### Scenario: Aporte con diezmo
- **WHEN** Daniel, con 10 %, registra el 26 oct un aporte de $2.000.000 con "Aplicar diezmo"
- **THEN** la opción en uso de octubre gana "Diezmo · aporte 26 oct" por $200.000

#### Scenario: Aporte para un mes sin plan
- **WHEN** se registra para noviembre, que no tiene plan, un aporte de $1.000.000 con "Aplicar diezmo", y luego se crea noviembre
- **THEN** la Opción A de noviembre trae "Diezmo · aporte {fecha}" por $100.000, además de los diezmos de los salarios

#### Scenario: Marcar el diezmo pagado
- **WHEN** Daniel marca pagado "Diezmo · Salario Daniel" de octubre desde Davivienda
- **THEN** queda un pago de $700.000 de ese ítem, y el saldo estimado de Davivienda baja $700.000

### Requirement: Ingresos de la opción
Cada opción del plan SHALL tener sus propias líneas de ingreso, editables como los ítems: el plan es un cuaderno donde cada opción puede suponer otros ingresos. Cada línea tiene:
- nombre (1 a 60 caracteres) y monto (cero o más);
- la persona a la que corresponde, opcional;
- tipo `FIJO` (sale de un ingreso fijo de Ajustes, enlazado a él), `EXTRA` (sale de un evento de ingreso del plan anual) u `OTRO` (agregada a mano).

Un miembro MUST poder agregar ("+ Ingreso"), editar y quitar líneas de cualquier opción de un mes no cerrado. Editar una línea MUST NOT cambiar el ingreso fijo de Ajustes, ni los demás meses, ni las otras opciones. Quitar una línea que ya se marcó recibida en su mes MUST responder 409 `INGRESO_RECIBIDO` y no quitarla. Datos inválidos MUST responder 400 `DATOS_INVALIDOS`; un mes cerrado, 409 `MES_CERRADO`.

Un ingreso fijo nuevo (Ajustes, "+ Agregar ingreso fijo") MUST entrar a la opción principal del mes en curso si ese mes tiene plan y no está cerrado, como una línea `FIJO` con su neto y, si su dueño tiene la regla activa, con su ítem de diezmo; los demás meses ya creados no cambian.

Lo que la opción "dejaría libre" y el "plan" de Ingresos del cierre MUST sumar sus líneas, más los aportes (los registrados o, si no hay, los proyectados) y el sobrante del mes anterior, que siguen fuera de las líneas.

#### Scenario: Otro salario en la Opción B
- **WHEN** en la Opción B de noviembre se cambia "Salario Daniel" a $7.000.000
- **THEN** la Opción B deja libres $712.000 más que antes, la Opción A no cambia, y "Salario Daniel" sigue en Ajustes con su neto de $6.288.000

#### Scenario: Ingreso agregado a mano
- **WHEN** en la Opción A de noviembre se agrega con "+ Ingreso" "Venta bicicleta" por $400.000
- **THEN** la opción tiene esa línea de tipo `OTRO`, y lo que dejaría libre sube $400.000

#### Scenario: Ingreso fijo nuevo a mitad de mes
- **WHEN** octubre está Activo y Daniel, con 10 % del bruto, agrega en Ajustes "Prima" por $1.000.000 que llega el día 30
- **THEN** la opción en uso de octubre gana la línea "Prima" por recibir y "Diezmo · Prima" por $100.000, y noviembre no cambia

#### Scenario: Quitar un ingreso recibido
- **WHEN** se intenta quitar "Salario Daniel" de octubre, que ya se marcó recibido
- **THEN** responde 409 `INGRESO_RECIBIDO` y la línea sigue en la opción

### Requirement: Editar el mes en curso
El plan de un mes Activo SHALL editarse igual que uno en Borrador: sus líneas de ingreso, sus ítems (agregar, editar y quitar) y sus diezmos. Lo único que un mes Activo MUST NOT permitir son varias opciones (duplicar, quitar una opción o cambiar la que está en uso), que siguen las reglas de "Usar la opción y estados del mes". Un mes Cerrado MUST seguir en solo lectura (409 `MES_CERRADO`). Quitar un ítem que ya tiene pagos o gastos MUST seguir respondiendo 409 `ITEM_CON_PAGOS`.

#### Scenario: Subir el mercado de octubre
- **WHEN** octubre es el mes en curso y está Activo, y se cambia Mercado de $800.000 a $900.000
- **THEN** la opción en uso de octubre queda con Mercado en $900.000, y Hoy lo muestra así

#### Scenario: Un gasto nuevo en el mes en curso
- **WHEN** en octubre Activo se agrega "Regalo" por $150.000 en Variables
- **THEN** aparece en Por pagar de Hoy por $150.000

### Requirement: Borrar el plan de un mes
Un miembro SHALL poder borrar el plan de un mes ("Borrar plan de {mes}"). Se borran, en una sola transacción:
- el plan, con todas sus opciones, líneas de ingreso e ítems;
- los pagos, gastos (también los "No estaba planeado") e ingresos recibidos de ese mes;
- el cierre del mes, si estaba cerrado.

Los aportes, los ajustes de cuadre, las transferencias y los abonos del mes MUST conservarse: no son del plan. Las cuotas de crédito borradas MUST devolver al saldo del crédito lo que su pago le había bajado, cuando el pago lo registró ("Corregir o borrar un registro", spec `steward-finanzas`). Antes de borrar, el miembro MUST poder ver cuántos pagos, gastos e ingresos recibidos se borrarán. Después el mes queda "Sin plan" y se puede volver a crear. Un mes que no tiene plan ni cierre MUST responder 404 `PLAN_NO_ENCONTRADO`.

#### Scenario: Borrar un mes mal creado
- **WHEN** noviembre está en Borrador sin registros y se borra su plan
- **THEN** noviembre queda "Sin plan" y se puede crear otra vez con "Desde cero"

#### Scenario: Borrar un mes con pagos
- **WHEN** octubre tiene el pago de Arriendo desde Davivienda, un gasto en Mercado, el salario recibido y un aporte, y se borra su plan
- **THEN** se borran el pago, el gasto y el ingreso recibido, el aporte se conserva, y el saldo estimado de Davivienda sube lo que había bajado el Arriendo

#### Scenario: Borrar un mes cerrado
- **WHEN** septiembre está cerrado con $500.000 pasados a octubre, y se borra el plan de septiembre
- **THEN** septiembre queda sin plan ni cierre, y octubre ya no muestra "Sobrante de septiembre"

### Requirement: Empezar de nuevo
Un miembro SHALL poder "Empezar de nuevo": se borran todos los planes de los meses, sus cierres, los planes anuales con sus aportes proyectados y todos los movimientos del hogar. Se conservan los miembros, las invitaciones, los ingresos fijos, las reglas de diezmo, las categorías, las cuentas y los créditos.

Cada cuenta MUST conservar el saldo estimado que tenía antes de empezar de nuevo, como su nuevo punto de partida, y cada crédito, su saldo. Todo se hace en una sola transacción.

#### Scenario: Empezar de nuevo
- **WHEN** el hogar tiene planes de septiembre a noviembre, pagos y un plan anual, y Davivienda está en ≈ $2.500.000, y un miembro elige "Empezar de nuevo"
- **THEN** ningún mes tiene plan, no hay plan anual ni registros, "Salario Daniel" y su regla siguen en Ajustes, y Davivienda sigue en $2.500.000

### Requirement: El diezmo sigue a su línea de ingreso
Cada ítem de diezmo que nace de una línea de ingreso de la opción SHALL quedar enlazado a esa línea. Su monto sugerido es el porcentaje de la regla del dueño de la línea sobre la base de la regla: el bruto de la línea si la base es BRUTO, o su monto si es NETO. Al nacer, una línea de un ingreso fijo toma el bruto de ese ingreso; una línea de un evento del anual o agregada a mano tiene el bruto igual a su monto.

Cuando cambia el monto o el bruto de la línea:
- su ítem de diezmo MUST recalcularse solo, si no está ajustado a mano y no tiene pagos;
- si está ajustado a mano, MUST conservar su monto.

Un ítem de diezmo MUST quedar "ajustado a mano" cuando un miembro cambia su monto, y SHALL ofrecer "Volver a calcular", que lo devuelve al monto sugerido y le quita esa marca. Quitar una línea MUST quitar también su ítem de diezmo si este no tiene pagos.

"+ Ingreso" SHALL ofrecer "Aplicar diezmo", que inicia marcado si la persona de la línea tiene la regla activa y crea su ítem de diezmo enlazado.

#### Scenario: Cambiar el salario en el plan
- **WHEN** en noviembre "Salario Daniel" tiene bruto $5.100.000, su diezmo (10 % del bruto) es $510.000, y se cambia el bruto de la línea a $5.500.000
- **THEN** "Diezmo · Salario Daniel" de noviembre pasa a $550.000

#### Scenario: Diezmo ajustado a mano
- **WHEN** "Diezmo · Salario Daniel" de noviembre se cambió a mano a $600.000, y luego se cambia el bruto de la línea a $5.500.000
- **THEN** el diezmo sigue en $600.000 con "ajustado a mano", y "Volver a calcular" lo deja en $550.000

#### Scenario: Diezmo ya pagado
- **WHEN** el diezmo del salario de octubre ya se pagó y se cambia el salario de octubre
- **THEN** el diezmo pagado no cambia

#### Scenario: Ingreso agregado con diezmo
- **WHEN** Daniel, con 10 %, agrega en noviembre "+ Ingreso" "Venta bicicleta" por $400.000 con "Aplicar diezmo"
- **THEN** noviembre gana la línea y "Diezmo · Venta bicicleta" por $40.000, enlazado a ella
