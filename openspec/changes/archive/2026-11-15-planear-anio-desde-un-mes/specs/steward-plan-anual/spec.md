## ADDED Requirements

### Requirement: Replicar el mes base
Un miembro SHALL poder llenar el plan anual de un año con un mes base, creándolo si no existe (año en curso o futuro). La base es una de tres:
- **un mes del hogar con plan**: su opción en uso, o la Opción A si no hay una elegida;
- **solo fijos**: el último plan del hogar anterior al año, sin sus ítems variables;
- **desde cero**.

Replicar MUST:
- poner en los 12 meses, por cada categoría del hogar salvo Diezmo, el total de la base en esa categoría ($0 desde cero);
- poner como aporte proyectado de cada miembro, en los 12 meses, lo que aportó en el mes base (sus aportes registrados, o su proyección de ese mes si no registró ninguno);
- guardar la base en el plan anual;
- dejarlo en Borrador.

Los eventos del plan anual MUST conservarse. Un mes base sin plan MUST responder 404 `PLAN_NO_ENCONTRADO`. Un año pasado, o un plan anual ya Creado, MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Replicar octubre en 2027
- **WHEN** Daniel replica octubre de 2026 en 2027, y octubre tiene Gastos fijos por $795.000 y Esposa aportó $1.500.000
- **THEN** el plan anual 2027 tiene Gastos fijos en $795.000 y el aporte proyectado de Esposa en $1.500.000 los 12 meses, y Esposa lo ve igual

#### Scenario: Replicar otra vez
- **WHEN** 2027 ya tiene el evento SOAT y se replica noviembre de 2026
- **THEN** las celdas toman los totales de noviembre y SOAT sigue en marzo

#### Scenario: Mes base sin plan
- **WHEN** se intenta replicar diciembre de 2026, que no tiene plan
- **THEN** responde 404 `PLAN_NO_ENCONTRADO` y el plan anual no cambia

### Requirement: Corregir y quitar eventos
Un miembro SHALL poder corregir un evento del plan anual de su hogar (los mismos datos que al agregarlo) o quitarlo. Un evento que no es de ese plan anual MUST responder 404 `EVENTO_NO_ENCONTRADO`.

#### Scenario: Quitar SOAT
- **WHEN** se quita el evento SOAT de marzo del plan anual 2027
- **THEN** el plan anual 2027 ya no lo tiene, y los dos miembros lo ven así

### Requirement: Borrar el plan anual
Un miembro SHALL poder borrar el plan anual de un año de su hogar, en cualquier estado. Borrarlo MUST quitar sus celdas, sus eventos, su mes base y los aportes proyectados de ese año. Los meses ya creados desde él MUST NOT cambiar. Un año sin plan anual MUST responder 404 `ANUAL_NO_ENCONTRADO`.

#### Scenario: Borrar 2027
- **WHEN** 2027 tiene plan anual Creado, con SOAT y aportes proyectados de Esposa, y febrero de 2027 ya nació de él, y Daniel borra el plan anual 2027
- **THEN** el hogar ya no tiene plan anual 2027 ni proyecciones de 2027, febrero de 2027 sigue con su plan, y Esposa ve lo mismo

#### Scenario: Borrar un año sin plan
- **WHEN** se intenta borrar el plan anual de 2029, que no existe
- **THEN** responde 404 `ANUAL_NO_ENCONTRADO`

## MODIFIED Requirements

### Requirement: Celdas, eventos y aportes proyectados
Un miembro SHALL poder, en el plan anual de su hogar:
- poner el monto de una categoría del hogar en un mes (de cero en adelante), aunque la categoría se haya creado después del anual;
- agregar un evento del año, con:
  - nombre de 1 a 60 caracteres;
  - mes de 1 a 12;
  - monto mayor que cero;
  - ingreso o gasto;
  - "solo ese mes" o "de ese mes en adelante" (en adelante: se repite de ese mes a diciembre);
  - para un gasto, opcionalmente una categoría del hogar que no sea Diezmo (sin categoría, va en "Eventos del año");
  - para un ingreso, opcionalmente el miembro cuya regla de diezmo hereda;
- poner el aporte proyectado de un miembro del hogar en un mes (cero lo quita).

Un año sin plan anual MUST responder 404 `ANUAL_NO_ENCONTRADO`. Una categoría o un miembro que no son del hogar MUST responder 404 `CATEGORIA_NO_ENCONTRADA` o `MIEMBRO_NO_ENCONTRADO`. Datos inválidos, una categoría Diezmo o una categoría en un ingreso MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Evento del año
- **WHEN** en el plan anual 2027 se agrega "SOAT" como gasto de marzo por $1.200.000
- **THEN** el plan anual 2027 tiene ese evento, y los dos miembros lo ven

#### Scenario: Gasto en una categoría
- **WHEN** se agrega "Navidad" como gasto de diciembre por $680.000 en Variables
- **THEN** el evento queda con la categoría Variables, y el resumen del año suma $680.000 a Variables en diciembre

#### Scenario: Ingreso de un mes en adelante
- **WHEN** se agrega "Aumento" como ingreso de Daniel de julio en adelante por $300.000
- **THEN** el resumen del año suma $300.000 a los ingresos de julio a diciembre, con su diezmo

#### Scenario: Aporte proyectado
- **WHEN** Esposa pone su aporte proyectado de enero de 2027 en $2.000.000
- **THEN** el plan anual 2027 tiene esa proyección a nombre de Esposa, y ponerla en $0 la quita

### Requirement: Crear los meses desde el plan anual
Un miembro SHALL poder crear los meses del año desde el plan anual ("Crear los 12 meses"):
- cada mes del año sin plan y no cerrado nace en Borrador con la Opción A, nota "Del plan anual";
- sus ítems salen del mes base guardado en el plan anual (o, si no tiene, del último plan del hogar anterior al año), los de cada categoría, y se ajustan al monto de la columna con un ítem "Ajuste del plan anual" (o con el nombre de la categoría si no había ítems);
- los ítems de diezmo de la base MUST NOT copiarse: cada mes gana sus ítems de diezmo como al crear un mes (spec `steward-plan-mes`, "Ítems de diezmo"), uno por cada ingreso fijo activo con regla y uno por cada evento de ingreso del mes con un miembro que tiene regla;
- cada mes nace con sus líneas de ingreso como al crear un mes (spec `steward-plan-mes`, "Crear el plan de un mes"): una por cada ingreso fijo activo y una por cada evento de ingreso que aplica al mes;
- cada evento de gasto que aplica al mes (el suyo, o uno anterior "de ese mes en adelante") entra como ítem en su categoría, o en "Eventos del año" (que se crea si hace falta) si no tiene;
- los meses que ya tienen plan no cambian;
- el plan anual pasa a estado Creado.

La categoría Diezmo MUST NOT tener celdas editables en el plan anual: su fila sigue calculada desde las reglas. Editar un mes después MUST NOT modificar el anual. Un año sin plan anual MUST responder 404 `ANUAL_NO_ENCONTRADO`.

#### Scenario: Crear los meses de 2027
- **WHEN** el plan anual 2027 tiene Gastos fijos en $800.000 cada mes y SOAT en marzo, y enero de 2027 ya tiene plan
- **THEN** febrero a diciembre nacen en Borrador con la Opción A; marzo trae SOAT en "Eventos del año", y enero no cambia

#### Scenario: Ítems del mes base
- **WHEN** el plan anual 2027 se replicó desde octubre de 2026, que tiene Internet y Arriendo en Gastos fijos, y se crean los meses
- **THEN** cada mes de 2027 trae Internet y Arriendo en Gastos fijos, con sus montos de octubre

#### Scenario: Navidad en Variables
- **WHEN** el plan anual 2027 tiene el gasto "Navidad" de diciembre en Variables y se crean los meses
- **THEN** diciembre de 2027 trae "Navidad" por $680.000 en Variables y no en "Eventos del año"

#### Scenario: Diezmo de la prima
- **WHEN** el plan anual 2027 tiene la Prima de junio por $3.000.000 de Daniel, con regla 10 %, y se crean los meses
- **THEN** junio de 2027 trae la línea de ingreso "Prima" por $3.000.000, y "Diezmo · Salario Daniel" y "Diezmo · Prima" por $300.000 en la categoría Diezmo

#### Scenario: Celda de diezmo
- **WHEN** se intenta guardar una celda del plan anual en la categoría Diezmo
- **THEN** responde 400 `DATOS_INVALIDOS` y la fila Diezmo sigue calculada
