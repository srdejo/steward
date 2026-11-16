## MODIFIED Requirements

### Requirement: Celdas, eventos y aportes proyectados
Un miembro SHALL poder, en el plan anual de su hogar:
- poner el monto de una categoría del hogar en un mes (de cero en adelante), aunque la categoría se haya creado después del anual;
- agregar un evento del año, con:
  - nombre de 1 a 60 caracteres;
  - mes de 1 a 12;
  - monto mayor que cero;
  - ingreso o gasto;
  - hasta qué mes se repite, de su mes a diciembre: hasta el mismo mes es "solo ese mes" y hasta diciembre, "de ese mes en adelante". Sin "hasta", es el mismo mes;
  - para un gasto, opcionalmente una categoría del hogar que no sea Diezmo (sin categoría, va en "Eventos del año");
  - para un ingreso, opcionalmente el miembro cuya regla de diezmo hereda;
- poner el aporte proyectado de un miembro del hogar en un mes (cero lo quita).

Un año sin plan anual MUST responder 404 `ANUAL_NO_ENCONTRADO`. Una categoría o un miembro que no son del hogar MUST responder 404 `CATEGORIA_NO_ENCONTRADA` o `MIEMBRO_NO_ENCONTRADO`. Datos inválidos (también un "hasta" antes del mes o después de diciembre), una categoría Diezmo o una categoría en un ingreso MUST responder 400 `DATOS_INVALIDOS`.

Por compatibilidad con la app publicada, un evento enviado con "en adelante" y sin "hasta" MUST quedar hasta diciembre, y cada evento MUST responderse también con "en adelante" (verdadero solo si va hasta diciembre desde un mes anterior).

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

#### Scenario: Gasto de marzo a junio
- **WHEN** se agrega "Curso" como gasto de marzo hasta junio por $250.000 en Variables
- **THEN** el resumen del año suma $250.000 a Variables de marzo a junio, y julio a diciembre no cambian

#### Scenario: Hasta antes del mes
- **WHEN** se intenta agregar un evento de junio hasta marzo
- **THEN** responde 400 `DATOS_INVALIDOS`

#### Scenario: La app que envía "en adelante"
- **WHEN** la app 2.2.3 agrega "Aumento" de julio con "en adelante" y sin "hasta"
- **THEN** el evento queda de julio hasta diciembre, y se responde con "en adelante" verdadero

### Requirement: Crear los meses desde el plan anual
Un miembro SHALL poder crear los meses del año desde el plan anual ("Crear los 12 meses"):
- cada mes del año sin plan y no cerrado nace en Borrador con la Opción A, nota "Del plan anual";
- sus ítems salen del mes base guardado en el plan anual (o, si no tiene, del último plan del hogar anterior al año), los de cada categoría, y se ajustan al monto de la columna con un ítem "Ajuste del plan anual" (o con el nombre de la categoría si no había ítems);
- los ítems de diezmo de la base MUST NOT copiarse: cada mes gana sus ítems de diezmo como al crear un mes (spec `steward-plan-mes`, "Ítems de diezmo"), uno por cada ingreso fijo activo con regla y uno por cada evento de ingreso del mes con un miembro que tiene regla;
- cada mes nace con sus líneas de ingreso como al crear un mes (spec `steward-plan-mes`, "Crear el plan de un mes"): una por cada ingreso fijo activo y una por cada evento de ingreso que aplica al mes;
- cada evento de gasto que aplica al mes (uno cuyo rango, de su mes hasta su "hasta", incluye el mes) entra como ítem en su categoría, o en "Eventos del año" (que se crea si hace falta) si no tiene;
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

#### Scenario: El curso en sus meses
- **WHEN** el plan anual 2027 tiene "Curso" de marzo hasta junio en Variables y se crean los meses
- **THEN** marzo, abril, mayo y junio traen "Curso" en Variables, y julio no
