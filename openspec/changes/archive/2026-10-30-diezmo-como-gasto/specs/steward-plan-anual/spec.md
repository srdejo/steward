## MODIFIED Requirements

### Requirement: Crear los meses desde el plan anual
Un miembro SHALL poder crear los meses del año desde el plan anual ("Crear meses desde este plan"), igual que `crearMesesDesdeAnual` del dominio:
- cada mes del año sin plan y no cerrado nace en Borrador con la Opción A, nota "Del plan anual";
- sus ítems salen del último plan del hogar anterior al año (los de cada categoría) y se ajustan al monto de la columna con un ítem "Ajuste del plan anual" (o con el nombre de la categoría si no había ítems);
- los ítems de diezmo del plan anterior MUST NOT copiarse: cada mes gana sus ítems de diezmo como al crear un mes (spec `steward-plan-mes`, "Ítems de diezmo"), uno por cada ingreso fijo activo con regla y uno por cada evento de ingreso del mes con un miembro que tiene regla;
- cada mes nace con sus líneas de ingreso como al crear un mes (spec `steward-plan-mes`, "Crear el plan de un mes"): una por cada ingreso fijo activo y una por cada evento de ingreso del mes;
- los eventos de gasto del mes entran como ítems de la categoría "Eventos del año", que se crea si hace falta;
- los meses que ya tienen plan no cambian;
- el plan anual pasa a estado Creado.

La categoría Diezmo MUST NOT tener celdas editables en el plan anual: su fila sigue calculada desde las reglas. Editar un mes después MUST NOT modificar el anual. Un año sin plan anual MUST responder 404 `ANUAL_NO_ENCONTRADO`.

#### Scenario: Crear los meses de 2027
- **WHEN** el plan anual 2027 tiene Gastos fijos en $800.000 cada mes y SOAT en marzo, y enero de 2027 ya tiene plan
- **THEN** febrero a diciembre nacen en Borrador con la Opción A; marzo trae SOAT en "Eventos del año", y enero no cambia

#### Scenario: Diezmo de la prima
- **WHEN** el plan anual 2027 tiene la Prima de junio por $3.000.000 de Daniel, con regla 10 %, y se crean los meses
- **THEN** junio de 2027 trae la línea de ingreso "Prima" por $3.000.000, y "Diezmo · Salario Daniel" y "Diezmo · Prima" por $300.000 en la categoría Diezmo

#### Scenario: Celda de diezmo
- **WHEN** se intenta guardar una celda del plan anual en la categoría Diezmo
- **THEN** responde 400 `DATOS_INVALIDOS` y la fila Diezmo sigue calculada
