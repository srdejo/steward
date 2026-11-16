## ADDED Requirements

### Requirement: Plan de un mes en escritorio
Desde 1024 px de ancho, un mes con una sola opción (en Borrador, Activo o Cerrado) SHALL mostrarse a todo el ancho, con las mismas reglas de "Mes en borrador con opciones" y "El mes en curso se edita en Planear":
- **Encabezado:** "‹ Planear", flechas al mes anterior y al siguiente, y el estado ("Borrador · empieza en N días", "Activo", "Cerrado"). En Borrador también "Crear otra opción" (duplica la opción) y "Usar este plan en {mes}".
- **Indicadores:**
  - **Entra**: el total de ingresos; si hay ingresos que no estaban el mes anterior, "Incluye {nombre} ($X)";
  - **Sale**: el total de gastos, con la nota de las dos filas que más cambian frente al mes anterior;
  - **Quedaría libre**;
  - **Diezmo**: el total de los ítems de diezmo, con el desglose por línea.
- **Tabla:** grupos en este orden: Ingresos (las líneas de la opción, los aportes proyectados de cada persona en gris como "Proyectado", y "Sobrante de {mes anterior}" si se espera) y después las categorías de gasto, con el Diezmo al final. Cada grupo tiene su total y su diferencia frente al mes anterior.
  - Cada fila tiene nombre, detalle (el de Hoy: "Corte 13 · valor del extracto", "Cuota 6 de 12"), día, monto y diferencia frente a la misma fila (misma categoría y nombre) del mes anterior: "—" si es igual, "+$X" o "−$X".
  - Una fila puede llevar una etiqueta: "Solo {mes}" si no estaba el mes anterior, "Proyectado" en un aporte proyectado, "Último" en la cuota con la que termina un crédito.
  - Los montos de un mes en Borrador o Activo MUST editarse en la celda (Enter o al salir del campo guarda). Tocar el nombre abre su hoja, y hay "+ Agregar a {grupo}". El diezmo se abre en su hoja. En un mes Cerrado, nada se edita.
- **Calendario de pagos:** las semanas del mes (L a D), cada día con lo que entra (+) y sale (−) ese día. Tocar un día, o una fila con día, lo elige y muestra debajo sus movimientos ("Nada programado este día" si no tiene).
- **Plata en cuentas, día a día:**
  - una barra por día con el saldo proyectado: el saldo del hogar estimado de hoy al empezar el mes (o desde hoy, si es el mes en curso), más lo que entra y menos lo que sale cada día;
  - el punto más bajo resaltado, con el aviso "Punto más bajo el {día}, con ≈ $X";
  - los gastos y los ingresos sin día no entran y se dicen aparte ("Los gastos sin fecha ($X) no están aquí").
- **Se libera:** si un crédito paga su última cuota este mes, "Se libera $X" con el crédito y desde qué mes.

En modo conectado, editar una celda y las demás acciones MUST guardarse en el backend.

#### Scenario: Diciembre con una opción
- **WHEN** a 1280 px se abre un diciembre con una opción que tiene la prima de $3.500.000 y la Navidad de $680.000, y noviembre no las tenía
- **THEN** "Entra" dice "Incluye Prima ($3.500.000)"; las filas de la prima y de la Navidad llevan "Solo diciembre" y "+$3.500.000" y "+$680.000" en la diferencia; y "Quedaría libre" es lo que entra menos lo que sale

#### Scenario: Elegir un día
- **WHEN** a 1280 px se toca la fila "Compra a cuotas", que vence el 20
- **THEN** el calendario marca el 20 y debajo lista lo que sale ese día con su monto

#### Scenario: Punto más bajo
- **WHEN** el saldo del hogar es ≈ $3.000.000 y la Visa ($800.000) y la pensión ($550.000) salen antes de que llegue el salario el 25
- **THEN** la barra más baja es la del último pago antes del salario (el primer día que llega a ese saldo), y el aviso dice ese día y ese saldo

#### Scenario: Editar en la celda
- **WHEN** a 1280 px se escribe $420.000 en la celda de Transporte de diciembre y se pulsa Enter
- **THEN** Transporte queda en $420.000, "Sale" y "Quedaría libre" se actualizan, y su diferencia frente a noviembre cambia

#### Scenario: Se libera
- **WHEN** a la compra a cuotas le queda su última cuota en junio
- **THEN** el plan de junio muestra "Último" en esa fila y "Se libera $375.000" desde julio

### Requirement: Opciones del mes en escritorio
Desde 1024 px de ancho, un mes en Borrador con dos opciones o más SHALL mostrarse a todo el ancho, con las mismas reglas de "Mes en borrador con opciones":
- **Encabezado:** "‹ Planear", flechas al mes anterior y al siguiente, el estado, "Solo lo que cambia", "Duplicar {opción}" y "Usar {opción} para {mes}". Al usar una opción, el mes pasa a la vista de una opción.
- **Tabla de opciones:** una columna por opción con su letra y su descripción. Al tocar el encabezado, esa opción queda "Editando"; al abrir, es la opción en uso o, si no hay, la A. Arriba, los ingresos de cada opción. Después, por categoría, el subtotal y una fila por gasto (misma categoría y nombre en las opciones), con detalle, vencimiento y su monto en cada opción ("—" si no lo tiene). Las celdas que difieren de la A MUST verse resaltadas. Al final, "Total gastos" y "Queda libre".
- **Editar en la celda:** las celdas de la opción "Editando" se editan en la tabla. Escribir en una celda "—" MUST agregar ese gasto a la opción, con la categoría, el nombre, el tipo y el vencimiento de la fila. El nombre abre su hoja. El diezmo se abre en su hoja.
- **"Solo lo que cambia":** oculta las filas iguales en todas las opciones y dice cuántas se ocultaron.
- **Al lado:**
  - la opción "Editando", con lo que dejaría libre, cuánto más o menos que la A, sus cambios frente a la A y su nota;
  - "{Mes} ya trae";
  - los atajos.
- **Atajos:** Ctrl + D duplica la opción "Editando". N, con el foco en una celda, abre "+ Agregar" en su categoría.

Un mes sin plan muestra las formas de empezar y "ya trae" una al lado de la otra. Por debajo de 1024 px, el mes se ve como hoy.

#### Scenario: Opciones de noviembre lado a lado
- **WHEN** a 1280 px se abre noviembre 2026, con las opciones A, B y C de los datos de prueba
- **THEN** la fila "Regalos de Navidad" muestra "—" en A y C y $600.000 resaltado en B, y "Queda libre" muestra lo mismo que cada opción "dejaría libre"

#### Scenario: Agregar un gasto desde una celda vacía
- **WHEN** a 1280 px se elige la Opción A y se escribe $300.000 en la celda "—" de "Regalos de Navidad"
- **THEN** la Opción A gana "Regalos de Navidad" en Variables por $300.000, y la celda deja de estar resaltada

#### Scenario: Solo lo que cambia
- **WHEN** a 1280 px se marca "Solo lo que cambia" en noviembre
- **THEN** solo quedan las filas que difieren, y la tabla dice cuántos gastos iguales se ocultaron

#### Scenario: Usar una opción
- **WHEN** a 1280 px se toca "Usar Opción B para noviembre"
- **THEN** noviembre queda con la B en uso y se muestra en la vista de una opción

## MODIFIED Requirements

### Requirement: Comparar escenarios
Comparar SHALL mostrar las opciones de un mes lado a lado, resaltando solo las filas que cambian, con el total "Queda libre" de cada una y un botón "Usar {X}" por opción. Con menos de 1024 px de ancho MUST desplazarse en horizontal, sin comprimir las columnas. Desde 1024 px, el mes ya muestra las opciones lado a lado ("Opciones del mes en escritorio"): abrir Comparar MUST llevar al mes.

En modo conectado, Comparar MUST mostrar las opciones reales del mes, y "Usar {X}" MUST guardarse en el backend. Con una sola opción, Comparar la muestra sola, sin avisos.

#### Scenario: Filas distintas
- **WHEN** las opciones A y B de noviembre solo difieren en Variables
- **THEN** solo la fila Variables aparece resaltada

#### Scenario: Comparar en modo conectado
- **WHEN** en modo conectado noviembre tiene la Opción A y la B con un abono extra de $2.000.000, y Daniel toca "Usar B" en Comparar
- **THEN** solo la fila Créditos aparece resaltada, B "deja libre" $2.000.000 menos que A, y los dos ven noviembre con la B como plan

#### Scenario: Comparar en escritorio
- **WHEN** a 1280 px se abre `/planear/2026-11/comparar`
- **THEN** se abre `/planear/2026-11` con las opciones lado a lado
