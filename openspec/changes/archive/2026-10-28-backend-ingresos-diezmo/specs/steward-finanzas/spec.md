## Purpose
Define en el backend lo que cada persona aporta al presupuesto del hogar: su regla de diezmo, sus ingresos fijos, recibir un ingreso y la obligación de diezmo que genera, entregar el diezmo, el ajuste "Diezmo en Hoy" y las cuentas básicas, con el aislamiento entre hogares.

## ADDED Requirements

### Requirement: Regla de diezmo propia
Cada usuario SHALL tener como máximo una regla de diezmo:
- activa o no;
- porcentaje, mayor que 0 y hasta 100, con hasta dos decimales;
- base Bruto o Neto;
- si aplica a sus aportes.

Un usuario MUST poder consultar y guardar solo su propia regla. Guardar reemplaza la anterior. Un porcentaje fuera de rango MUST responder 400 `DATOS_INVALIDOS`. La regla es de la persona, no del hogar: la conserva si sale del hogar y entra a otro.

#### Scenario: Guardar la regla
- **WHEN** Daniel guarda diezmo activo, 10 % sobre el bruto, sin aplicar a aportes
- **THEN** su regla queda así, y la de Esposa no cambia

#### Scenario: Porcentaje inválido
- **WHEN** se guarda una regla con porcentaje 0 o 120
- **THEN** responde 400 `DATOS_INVALIDOS` y la regla anterior sigue igual

### Requirement: Ingresos fijos propios
Un miembro SHALL poder crear, editar y quitar sus propios ingresos fijos en su hogar. Cada ingreso tiene:
- nombre, de 1 a 60 caracteres;
- bruto y neto en pesos, con neto mayor que 0 y bruto mayor o igual al neto;
- día de pago, de 1 a 31;
- cuenta opcional del hogar.

Quitar un ingreso MUST desactivarlo, sin borrarlo, para conservar lo ya recibido. Editar o quitar el ingreso de otro miembro, o uno de otro hogar, MUST responder 404 `INGRESO_NO_ENCONTRADO`. Datos inválidos MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Crear el salario
- **WHEN** Daniel crea "Salario Daniel" con bruto $7.000.000, neto $6.288.000 y día 25
- **THEN** el ingreso aparece activo, con Daniel como dueño, en las finanzas del hogar

#### Scenario: Bruto menor que el neto
- **WHEN** se guarda un ingreso con bruto $5.000.000 y neto $6.000.000
- **THEN** responde 400 `DATOS_INVALIDOS`

#### Scenario: Ingreso ajeno
- **WHEN** Esposa intenta editar "Salario Daniel"
- **THEN** responde 404 `INGRESO_NO_ENCONTRADO` y el ingreso no cambia

### Requirement: Recibir un ingreso fijo
Cualquier miembro SHALL poder marcar como recibido ("Recibí") un ingreso fijo activo de su hogar.
- Se registra un movimiento de ingreso del mes en curso, en la zona horaria del backend, con el neto del ingreso, su bruto, la fecha de hoy, el dueño del ingreso y quién lo marcó.
- El movimiento MUST quedar marcado como generador de diezmo si el dueño tiene la regla activa en ese momento.
- Marcar el mismo ingreso dos veces en un mes MUST responder 409 `YA_RECIBIDO`.
- Un ingreso inactivo o de otro hogar MUST responder 404 `INGRESO_NO_ENCONTRADO`.

#### Scenario: Salario recibido
- **WHEN** se marca recibido "Salario Daniel" el 25 de octubre
- **THEN** el mes de octubre tiene un ingreso de $6.288.000 de Daniel, recibido el 25 de octubre

#### Scenario: Recibido dos veces
- **WHEN** se marca recibido otra vez "Salario Daniel" en octubre
- **THEN** responde 409 `YA_RECIBIDO` y sigue habiendo un solo ingreso en el mes

### Requirement: Obligaciones de diezmo
Las obligaciones de diezmo pendientes del mes en curso SHALL calcularse así, con las mismas cifras que el dominio compartido:
- una por cada ingreso recibido que generó diezmo y no se ha entregado;
- monto: el porcentaje de la regla actual del dueño sobre el bruto o el neto del ingreso recibido, según la base, redondeado al peso más cercano (las mitades hacia arriba);
- detalle: `{porcentaje}% de {nombre del ingreso} · recibido {fecha corta}`.

Si el dueño ya no tiene regla, sus obligaciones no aparecen. Cualquier miembro MUST poder consultarlas. Cada una tiene id, monto, detalle, dueño y fecha.

#### Scenario: Diezmo del salario
- **WHEN** "Salario Daniel" (bruto $7.000.000, neto $6.288.000) se recibe el 25 oct y Daniel tiene 10 % sobre el bruto
- **THEN** hay una obligación pendiente de $700.000 con detalle "10% de Salario Daniel · recibido 25 oct"

#### Scenario: Base neto
- **WHEN** la regla de Daniel es 10 % sobre el neto y se recibe el mismo salario
- **THEN** la obligación es de $628.800

#### Scenario: Sin regla
- **WHEN** Esposa no tiene regla activa y se recibe su ingreso fijo
- **THEN** no aparece ninguna obligación por ese ingreso

### Requirement: Entregar el diezmo
Un miembro SHALL poder entregar ("Entregado") una o varias obligaciones pendientes del mes en curso, con cuenta de origen opcional.
- Se registra un movimiento de diezmo entregado por la suma de esas obligaciones, que las cubre, y ellas dejan de estar pendientes.
- Los ids que no corresponden a una obligación pendiente del hogar MUST ignorarse.
- Si ninguno corresponde, MUST responder 409 `SIN_DIEZMO`.
- Una obligación MUST NOT poder entregarse dos veces.

#### Scenario: Entregado
- **WHEN** se entrega la obligación de $700.000 del salario de Daniel
- **THEN** queda un movimiento de diezmo entregado por $700.000 y no quedan obligaciones pendientes

#### Scenario: Agrupado
- **WHEN** hay dos obligaciones pendientes, de $700.000 y $150.000, y se entregan juntas
- **THEN** queda un solo movimiento de $850.000 que cubre las dos

#### Scenario: Ya entregado
- **WHEN** se intenta entregar otra vez la obligación de $700.000
- **THEN** responde 409 `SIN_DIEZMO`

### Requirement: Diezmo en Hoy
El hogar SHALL tener el ajuste "Diezmo en Hoy", con valor `SEPARADO` (por defecto) o `AGRUPADO`. Cualquier miembro MUST poder cambiarlo. Un valor distinto MUST responder 400 `DATOS_INVALIDOS`.

#### Scenario: Pasar a agrupado
- **WHEN** un miembro elige `AGRUPADO`
- **THEN** las finanzas del hogar muestran `AGRUPADO` para los dos miembros

### Requirement: Cuentas básicas
Un miembro SHALL poder crear una cuenta del hogar con:
- nombre, de 1 a 60 caracteres;
- titular: él mismo o la cuenta conjunta;
- saldo aproximado en pesos, de cero en adelante.

Una cuenta nueva queda sin cuadrar, con ese saldo y la fecha de hoy. Un miembro MUST NOT poder crear una cuenta a nombre de otro. Todos los miembros ven las cuentas del hogar. Cuadrar, el saldo estimado, mover dinero y los créditos no son parte de esta capacidad todavía.

#### Scenario: Cuentas del onboarding
- **WHEN** en el onboarding Daniel crea "Davivienda" con $4.000.000 a su nombre y "Efectivo" con $200.000 conjunta
- **THEN** el hogar tiene las dos cuentas, sin cuadrar, y Esposa también las ve

#### Scenario: Nombre vacío
- **WHEN** se crea una cuenta sin nombre
- **THEN** responde 400 `DATOS_INVALIDOS`

### Requirement: Finanzas del hogar en una lectura
Un miembro SHALL poder leer en una sola llamada:
- el mes en curso y el ajuste "Diezmo en Hoy";
- los ingresos fijos activos de todos los miembros;
- las reglas de diezmo de los miembros;
- las cuentas;
- los movimientos del mes en curso: ingresos recibidos y diezmos entregados, con lo que cubre cada entrega.

Sin hogar, MUST responder 404 `SIN_HOGAR`.

#### Scenario: Lo que ve Esposa
- **WHEN** Daniel ya recibió su salario y Esposa lee las finanzas del hogar
- **THEN** ve "Salario Daniel" como ingreso activo, la regla de Daniel, las cuentas y el ingreso recibido de octubre

### Requirement: Aislamiento de las finanzas
Todo lo de esta capacidad SHALL resolverse a partir del hogar del usuario de la sesión. Ingresos, cuentas, movimientos y obligaciones de otro hogar MUST NOT poder leerse ni modificarse. Un id ajeno MUST responder igual que uno inexistente. Sin sesión, MUST responder 401.

#### Scenario: Ingreso de otro hogar
- **WHEN** un miembro de otro hogar marca recibido "Salario Daniel" usando su id
- **THEN** responde 404 `INGRESO_NO_ENCONTRADO` y "Nuestra casa" no tiene ningún ingreso nuevo

#### Scenario: Entregar diezmo ajeno
- **WHEN** un miembro de otro hogar entrega la obligación de Daniel usando su id
- **THEN** responde 409 `SIN_DIEZMO` y la obligación sigue pendiente en "Nuestra casa"
