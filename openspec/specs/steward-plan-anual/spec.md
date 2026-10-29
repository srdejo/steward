# steward-plan-anual Specification

## Purpose
TBD - created by archiving change backend-plan-anual. Update Purpose after archive.

## Requirements

### Requirement: Crear el plan anual
Un miembro SHALL poder crear el plan anual de un año del hogar, para el año en curso o uno futuro, como `crearAnual` del dominio. Nace en estado Borrador, sin celdas con monto (todas las categorías del hogar en $0), sin eventos y sin proyecciones. Un año que ya tiene plan anual MUST responder 409 `YA_EXISTE`. Un año pasado MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Crear 2027
- **WHEN** en 2026 Daniel crea el plan anual de 2027
- **THEN** el hogar tiene el plan anual 2027 en Borrador, y Esposa lo ve con cada categoría en $0 los 12 meses

#### Scenario: Año que ya tiene plan
- **WHEN** se intenta crear otra vez el plan anual de 2027
- **THEN** responde 409 `YA_EXISTE`

### Requirement: Celdas, eventos y aportes proyectados
Un miembro SHALL poder, en el plan anual de su hogar:
- poner el monto de una categoría del hogar en un mes (de cero en adelante), aunque la categoría se haya creado después del anual;
- agregar un evento del año (nombre de 1 a 60 caracteres, mes de 1 a 12, monto mayor que cero, ingreso o gasto; un ingreso puede indicar el miembro cuya regla de diezmo hereda);
- poner el aporte proyectado de un miembro del hogar en un mes (cero lo quita).

Igual que `editarMontoAnual`, `agregarEvento` y `editarProyeccion` del dominio. Un año sin plan anual MUST responder 404 `ANUAL_NO_ENCONTRADO`. Una categoría o un miembro que no son del hogar, 404 `CATEGORIA_NO_ENCONTRADA` o `MIEMBRO_NO_ENCONTRADO`. Datos inválidos, 400 `DATOS_INVALIDOS`.

#### Scenario: Evento del año
- **WHEN** en el plan anual 2027 se agrega "SOAT" como gasto de marzo por $1.200.000
- **THEN** el plan anual 2027 tiene ese evento, y los dos miembros lo ven

#### Scenario: Aporte proyectado
- **WHEN** Esposa pone su aporte proyectado de enero de 2027 en $2.000.000
- **THEN** el plan anual 2027 tiene esa proyección a nombre de Esposa, y ponerla en $0 la quita

### Requirement: Crear los meses desde el plan anual
Un miembro SHALL poder crear los meses del año desde el plan anual ("Crear meses desde este plan"), igual que `crearMesesDesdeAnual` del dominio:
- cada mes del año sin plan y no cerrado nace en Borrador con la Opción A, nota "Del plan anual";
- sus ítems salen del último plan del hogar anterior al año (los de cada categoría) y se ajustan al monto de la columna con un ítem "Ajuste del plan anual" (o con el nombre de la categoría si no había ítems);
- los eventos de gasto del mes entran como ítems de la categoría "Eventos del año", que se crea si hace falta;
- los meses que ya tienen plan no cambian;
- el plan anual pasa a estado Creado.

Editar un mes después MUST NOT modificar el anual. Un año sin plan anual MUST responder 404 `ANUAL_NO_ENCONTRADO`.

#### Scenario: Crear los meses de 2027
- **WHEN** el plan anual 2027 tiene Gastos fijos en $800.000 cada mes y SOAT en marzo, y enero de 2027 ya tiene plan
- **THEN** febrero a diciembre nacen en Borrador con la Opción A; marzo trae SOAT en "Eventos del año", y enero no cambia

### Requirement: Aislamiento del plan anual
El plan anual SHALL resolverse a partir del hogar del usuario de la sesión. El de otro hogar MUST NOT poder leerse ni modificarse. Sin sesión, MUST responder 401.

#### Scenario: Anual de otro hogar
- **WHEN** un miembro de otro hogar intenta poner una celda del plan anual 2027 de "Nuestra casa"
- **THEN** responde sobre su propio hogar (404 `ANUAL_NO_ENCONTRADO` si no tiene), y el de "Nuestra casa" no cambia
