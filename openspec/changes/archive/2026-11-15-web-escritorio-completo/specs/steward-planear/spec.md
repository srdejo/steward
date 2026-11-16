## MODIFIED Requirements

### Requirement: Cierre de mes
Cierre SHALL mostrar la tabla plan vs. real por categoría, la fila "Sin registrar" (la suma de los ajustes de cuadre) y lo que sobró. El sobrante MUST poder repartirse entre "A ahorro" y "Pasar a {mes siguiente}", con una suma igual al sobrante. "Cerrar {mes}" SHALL dejar el mes Cerrado y en solo lectura, y lo pasado aparece como ingreso del mes siguiente ("Sobrante de octubre").

Desde 1024 px de ancho, Cierre SHALL usar el ancho del escritorio:
- encabezado "{Mes} {año} terminó con $X", con "El plan esperaba $Y libres" y la diferencia ("+$Z mejor de lo planeado" en positivo, o "−$Z menos de lo planeado");
- "Plan frente a lo real": por categoría, plan, real, diferencia (real − plan) y una barra de uso del plan. En los gastos, pasarse del plan MUST verse en rojo y quedar por debajo, en verde; en los ingresos, al revés;
- "Para tener en cuenta en {mes siguiente}", que MUST incluir lo que salió sin registrar (si es mayor que cero), cada categoría de gasto que pasó su plan y la diferencia de los ingresos (si la hay). Sin nada que mostrar, la sección no aparece;
- al lado, "¿Qué hacemos con lo que sobró?" con una barra del reparto, los montos "A ahorro" y "Pasar a {mes siguiente}", "Sin asignar" y "Cerrar {mes}".

En modo conectado:
- "Cerrar {mes}" MUST guardar el cierre en el backend, y los dos miembros MUST ver el mes Cerrado con lo guardado;
- un mes futuro MUST NOT poder cerrarse: su Cierre no ofrece "Cerrar {mes}";
- si alguien registró algo en el mes mientras tanto, MUST mostrarse "Alguien registró algo en {mes}; revisa el cierre otra vez", con las cifras ya recalculadas, sin cerrar el mes.

#### Scenario: Cerrar octubre
- **WHEN** octubre terminó con $3.166.000 y se reparte $2.000.000 a ahorro y $1.166.000 a noviembre
- **THEN** octubre queda Cerrado y noviembre muestra el ingreso "Sobrante de octubre $1.166.000"

#### Scenario: Reparto inválido
- **WHEN** la suma del reparto no coincide con el sobrante
- **THEN** "Cerrar octubre" queda deshabilitado y "Sin asignar" muestra la diferencia

#### Scenario: Cierre en escritorio
- **WHEN** a 1280 px se abre el cierre de octubre, Variables tenía plan $720.000 y real $750.000, y quedaron $220.000 sin registrar
- **THEN** la fila de Variables muestra "+$30.000" en rojo, y "Para tener en cuenta en noviembre" incluye los $220.000 sin registrar y Variables por encima del plan

#### Scenario: Cerrar en modo conectado
- **WHEN** en modo conectado Daniel cierra octubre
- **THEN** Esposa ve octubre Cerrado con el mismo reparto, y en Hoy ya no puede marcar pagos de octubre

#### Scenario: Cierre desactualizado
- **WHEN** en modo conectado Esposa registró un gasto de octubre mientras Daniel tenía abierto el Cierre, y Daniel toca "Cerrar octubre"
- **THEN** ve que alguien registró algo, la tabla ya incluye el gasto y octubre sigue abierto
