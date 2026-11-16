## ADDED Requirements

### Requirement: Opciones del plan anual
El plan anual SHALL tener una o más opciones (A, B, …), cada una con su autor, su nota, sus celdas, sus eventos y su mes base. Los aportes proyectados son del año y valen para todas. Un plan anual nace con la Opción A; los planes anuales que ya existían la ganan con sus celdas, eventos y base.

Un miembro SHALL poder:
- duplicar una opción: la nueva toma la siguiente letra libre, a su nombre, con una copia de sus celdas, eventos y base;
- quitar una opción, salvo la última o la que está en uso, con sus celdas y eventos;
- poner celdas, agregar, corregir o quitar eventos, y replicar, en la opción que elija (`opcionId`); sin `opcionId`, en la opción en uso o, si no hay, en la A.

El resumen del año SHALL calcularse por opción. Una opción de otro año o de otro hogar MUST responder 404 `OPCION_NO_ENCONTRADA`; quitar la última o la que está en uso MUST responder 409 `OPCION_EN_USO`.

#### Scenario: Duplicar la Opción A
- **WHEN** Esposa duplica la Opción A de 2027
- **THEN** 2027 tiene la Opción B a nombre de Esposa, con las mismas celdas y eventos que la A, y los dos la ven

#### Scenario: Cambiar solo la B
- **WHEN** en la Opción B de 2027 se agrega "Cuota carro nuevo" en Créditos de abril en adelante por $1.200.000
- **THEN** la B deja libre $1.200.000 menos de abril a diciembre, y la A no cambia

#### Scenario: Quitar la opción en uso
- **WHEN** los meses de 2027 se crearon con la Opción B y se intenta quitar la B
- **THEN** responde 409 `OPCION_EN_USO` y la B sigue

### Requirement: Crear o actualizar los meses desde el plan anual
Un miembro SHALL poder llevar una opción del plan anual a los meses del año ("Meses con la Opción X"). Para cada mes:
- **sin plan y no cerrado**: se crea en Borrador con la Opción A, nota "Del plan anual";
- **con plan en Borrador o Activo, sin pagos, gastos ni ingresos recibidos en el mes y sin cierre**: se actualiza solo si se pide; su plan, con todas sus opciones, se reemplaza por uno nuevo como si no tuviera plan, en el mismo estado;
- **con registros o cerrado**: MUST NOT cambiar; pedir actualizarlo MUST responder 409 `MES_CON_REGISTROS`.

Cada mes que se crea o actualiza:
- toma sus ítems del mes base de la opción (o, si no tiene, del último plan del hogar anterior al año), los de cada categoría con fila, y se ajustan al monto de la columna con un ítem "Ajuste del plan anual" (o con el nombre de la categoría si no había ítems); si la columna es menor que esos ítems, la categoría entra como un solo ítem por la columna;
- toma también los ítems de las categorías sin fila en la opción, con sus montos del mes base;
- MUST traer la cuota de cada crédito que paga una cuota ese mes según su tabla (spec `steward-cuentas`), y no la de los que ya terminaron; los ítems de compras a cuotas con "cuota N de M" avanzan una cuota por mes desde el mes base;
- MUST traer la línea de cada tarjeta, como al crear un mes (spec `steward-plan-mes`);
- MUST NOT copiar los ítems de diezmo de la base: gana sus ítems de diezmo como al crear un mes (spec `steward-plan-mes`, "Ítems de diezmo"), uno por cada ingreso fijo activo con regla y uno por cada evento de ingreso del mes con un miembro que tiene regla;
- nace con sus líneas de ingreso como al crear un mes: una por cada ingreso fijo activo y una por cada evento de ingreso de la opción que aplica al mes;
- trae cada evento de gasto de la opción que aplica al mes (el suyo, o uno anterior "de ese mes en adelante") como ítem en su categoría, o en "Eventos del año" (que se crea si hace falta) si no tiene.

Todo va en una transacción. Al terminar, la opción queda en uso en el plan anual y el plan anual pasa a estado Creado. La categoría Diezmo MUST NOT tener celdas editables en el plan anual: su fila sigue calculada desde las reglas. Editar un mes después MUST NOT modificar el anual. Un año sin plan anual MUST responder 404 `ANUAL_NO_ENCONTRADO`.

#### Scenario: Crear los meses de 2027
- **WHEN** la Opción A de 2027 tiene Gastos fijos en $800.000 cada mes y SOAT en marzo, y enero de 2027 ya tiene plan con un pago
- **THEN** febrero a diciembre nacen en Borrador con la Opción A; marzo trae SOAT en "Eventos del año", y enero no cambia

#### Scenario: Actualizar los meses vacíos
- **WHEN** marzo a diciembre de 2027 tienen plan en Borrador solo con el salario y su diezmo, sin registros, y se actualizan con la Opción A
- **THEN** cada uno queda con los gastos de su columna y sus eventos, como si se hubiera creado desde el año

#### Scenario: Mes con pagos
- **WHEN** se pide actualizar febrero de 2027, que ya tiene un pago
- **THEN** responde 409 `MES_CON_REGISTROS` y no cambia ningún mes

#### Scenario: Ítems del mes base
- **WHEN** la Opción A de 2027 se replicó desde octubre de 2026, que tiene Internet y Arriendo en Gastos fijos, y se crean los meses
- **THEN** cada mes de 2027 trae Internet y Arriendo en Gastos fijos, con sus montos de octubre

#### Scenario: Tarjetas sin fila
- **WHEN** la Opción A de 2027 no tiene fila en Tarjetas y el mes base tiene la línea de la Mastercard por $1.500.000
- **THEN** cada mes de 2027 trae la Mastercard por $1.500.000 en Tarjetas

#### Scenario: Cuotas de un crédito
- **WHEN** la compra a cuotas paga su última cuota en junio de 2027 y se crean los meses de 2027
- **THEN** enero a junio traen "Compra a cuotas" por $375.000, y julio a diciembre no

#### Scenario: Navidad en Variables
- **WHEN** la Opción A de 2027 tiene el gasto "Navidad" de diciembre en Variables y se crean los meses
- **THEN** diciembre de 2027 trae "Navidad" por $680.000 en Variables y no en "Eventos del año"

#### Scenario: Diezmo de la prima
- **WHEN** la Opción A de 2027 tiene la Prima de junio por $3.000.000 de Daniel, con regla 10 %, y se crean los meses
- **THEN** junio de 2027 trae la línea de ingreso "Prima" por $3.000.000, y "Diezmo · Salario Daniel" y "Diezmo · Prima" por $300.000 en la categoría Diezmo

#### Scenario: Celda de diezmo
- **WHEN** se intenta guardar una celda del plan anual en la categoría Diezmo
- **THEN** responde 400 `DATOS_INVALIDOS` y la fila Diezmo sigue calculada

## MODIFIED Requirements

### Requirement: Replicar el mes base
Un miembro SHALL poder llenar una opción del plan anual de un año con un mes base, creando el plan anual (con su Opción A) si no existe (año en curso o futuro). Sin `opcionId`, se replica en la opción en uso o, si no hay, en la A. La base es una de tres:
- **un mes del hogar con plan**: su opción en uso, o la Opción A si no hay una elegida;
- **solo fijos**: el último plan del hogar anterior al año, sin sus ítems variables;
- **desde cero**.

Replicar MUST:
- poner en los 12 meses de la opción, por cada categoría del hogar salvo Diezmo, el total de la base en esa categoría ($0 desde cero), sin la cuota de los créditos en los meses después de su última cuota;
- poner como aporte proyectado de cada miembro, en los 12 meses, lo que aportó en el mes base (sus aportes registrados, o su proyección de ese mes si no registró ninguno);
- guardar la base en la opción.

Los eventos de la opción y las demás opciones MUST conservarse. Replicar MUST poder hacerse aunque el año ya tenga meses creados: los meses no cambian hasta actualizarlos ("Crear o actualizar los meses desde el plan anual"). Un mes base sin plan MUST responder 404 `PLAN_NO_ENCONTRADO`. Un año pasado MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Replicar octubre en 2027
- **WHEN** Daniel replica octubre de 2026 en 2027, y octubre tiene Gastos fijos por $795.000 y Esposa aportó $1.500.000
- **THEN** el plan anual 2027 tiene Gastos fijos en $795.000 y el aporte proyectado de Esposa en $1.500.000 los 12 meses, y Esposa lo ve igual

#### Scenario: Replicar otra vez
- **WHEN** 2027 ya tiene el evento SOAT y se replica noviembre de 2026
- **THEN** las celdas toman los totales de noviembre y SOAT sigue en marzo

#### Scenario: Mes base sin plan
- **WHEN** se intenta replicar diciembre de 2026, que no tiene plan
- **THEN** responde 404 `PLAN_NO_ENCONTRADO` y el plan anual no cambia

#### Scenario: Replicar con los meses creados
- **WHEN** el plan anual 2027 ya creó sus meses y Daniel replica diciembre de 2026 en la Opción A
- **THEN** las celdas de la Opción A toman los totales de diciembre, y los meses de 2027 no cambian

#### Scenario: Un crédito que termina
- **WHEN** se replica octubre de 2026, con la compra a cuotas de $375.000 que paga su última cuota en junio de 2027, en 2027
- **THEN** la fila Créditos de 2027 baja $375.000 de julio a diciembre

## REMOVED Requirements

### Requirement: Crear los meses desde el plan anual
**Reason**: Pasa a crear o actualizar los meses con una opción del año.
**Migration**: Ver "Crear o actualizar los meses desde el plan anual".
