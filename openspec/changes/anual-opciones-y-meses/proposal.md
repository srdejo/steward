# Proposal

## Why

**Meses vacíos.** Daniel planeó 2027 en la web: replicó diciembre de 2026, agregó 6 cambios y tocó "Crear los 12 meses". Enero y febrero quedaron bien porque ya los había copiado a mano. De marzo a diciembre, en cambio, quedaron solo con el salario y su diezmo.

Esos meses se habían creado antes de llenar el año, y "Crear los 12 meses" se salta en silencio los meses que ya tienen plan. Aun así, el año quedó como "Meses creados", y ya no se podía volver a replicar.

**Más fallas al crear los meses desde el año:**
- **Categorías sin fila:** los gastos de una categoría que no tiene fila en el año se pierden, como pasa con Tarjetas si el año se replicó antes de existir esa categoría.
- **Créditos:** las cuotas no siguen su tabla. La de un crédito que ya terminó sigue apareciendo, y la de un crédito nuevo no entra.

**Opciones del año.** El hogar quiere comparar dos formas de vivir el año, por ejemplo "con carro nuevo" frente a "sin carro", como ya hace con las opciones A y B de un mes.

Fuente: canvas *Presupuesto Hogar v3*, artboards nuevos:
- `AnualOpcionesWeb`: el plan del año con opciones (web);
- `AnualOpcionesMovil`: el mismo plan en móvil;
- `AnualActualizarMovil`: la hoja para crear o actualizar los meses.

## What Changes

- **Opciones del plan anual:** el año tiene opciones A, B, etc., como un mes.
  - **Qué es de cada opción:** sus celdas, sus cambios ("Lo que cambia") y su mes base.
  - **Qué es del año:** los aportes proyectados se comparten entre opciones.
  - **Acciones:**
    - "Duplicar Opción X" copia la opción elegida;
    - "Quitar opción" la borra, salvo la última o la que está en uso.
  - **Vistas:**
    - **Web:** pestañas con la letra, el autor y la nota de cada opción. La tabla resalta las celdas distintas de la Opción A. Debajo van "Las dos opciones, mes a mes" (lo que dejaría libre cada mes en cada opción) y "Lo que cambia en la Opción X".
    - **Móvil:** chips de opción, y la lista de meses con lo que deja libre cada uno y la diferencia frente a la A.
- **"Meses con la Opción X"** reemplaza a "Crear los 12 meses". Es una hoja que lista los 12 meses:
  - **Mes sin plan:** se crea con la columna de la opción.
  - **Mes en Borrador o Activo sin pagos, gastos ni ingresos recibidos:** se puede **actualizar**, es decir, reemplazar su plan por la columna. Viene marcado si nació del año o no tiene gastos; si no, desmarcado.
  - **Mes con registros o cerrado:** no se toca, y la hoja dice por qué.
  - **Al confirmar:** la opción queda "en uso" en el año.
  - **Siempre disponible:** replicar y editar el año ya no se bloquean cuando hay meses creados.
- **Crear un mes desde el año:**
  - **Categorías sin fila:** sus gastos se copian como están en el mes base, y el resumen del año las muestra con ese total, no en $0.
  - **Créditos:** cada mes trae la cuota de los créditos que todavía se pagan ese mes, según su tabla. La de un crédito que ya terminó no entra, y la de uno nuevo sí. Al replicar, la fila de la categoría ya baja en los meses después de la última cuota.
  - **Tarjetas:** cada mes trae la línea de cada tarjeta, como al crear un mes.
- **Backend:**
  - **Migración V14:** tabla `anual_opcion`. Las celdas y los eventos pasan a ser de una opción, y cada año existente gana su Opción A.
  - **Endpoints de opciones:** `POST /api/anuales/{anio}/opciones` (duplicar) y `DELETE /api/anuales/{anio}/opciones/{id}`.
  - **Endpoints existentes:** los de celdas, eventos y replicar reciben `opcionId`.
  - **Meses:** `POST /api/anuales/{anio}/meses` con `{opcionId, actualizar: [mes, ...]}`, que crea y actualiza en una transacción.

**Fuera de alcance:**
- Aportes proyectados distintos por opción.
- Comparar más de dos opciones en "mes a mes": se compara la elegida contra la A.
- Deshacer una actualización.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- **`steward-plan-anual`:**
  - nuevo requisito "Opciones del plan anual";
  - "Replicar el mes base" se replica en una opción y ya no se bloquea con los meses creados;
  - "Crear los meses desde el plan anual" pasa a crear o actualizar meses, con créditos, tarjetas y categorías sin fila.
- **`steward-planear`:** "Plan anual" con las opciones y la hoja "Meses con la Opción X", en web y móvil.

## Impact

- **Dominio:**
  - `PlanAnual` con `opciones: OpcionAnual[]` y `opcionEnUso`;
  - `rules/anual.ts`: `resumenAnual(estado, anio, opcionId?)`, `duplicarOpcionAnual`, `quitarOpcionAnual`, `mesesDesdeAnual` (lo que la hoja muestra), `crearOActualizarMeses`, y la creación de un mes con créditos, tarjetas y categorías sin fila;
  - `PlanPort`, en demo y en conectado;
  - semilla con el año 2027 en una Opción A.
- **Backend:**
  - V14;
  - `AnualUseCase` y `AnualR2dbcAdapter` con opciones, y `AnualController`;
  - pruebas de contrato y de migración.
- **PWA:** `anual-page.ts` con las opciones, "mes a mes" y la hoja "Meses con la Opción X".
- **App:** la pantalla del año con chips de opción y la hoja de meses.
- **Datos reales:** con esto, Daniel actualiza marzo a diciembre de 2027 desde su año.
