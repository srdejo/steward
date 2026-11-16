# Proposal

## Why

El año solo se arma desde un mes que ya existe, y tal cual: no hay dónde ajustarlo antes de replicar. Una opción nueva solo nace duplicando otra. Y "Cambiar mes base" desaparece cuando los meses del año ya se crearon, como pasa hoy con el 2027 de Daniel.

Daniel quiere este flujo: crear una opción desde un mes base (el mes actual u otro), ajustar ese mes base, y después agregar los eventos del año.

Fuente: canvas *Presupuesto Hogar v3*, artboard `AnualMesBaseWeb` ("Nueva opción y su mes base editable (web)").

## What Changes

Todo en la web. La app no cambia.

- **"+ Nueva opción desde un mes base"**, al lado de "Duplicar":
  - se elige la fuente: un mes con plan (por defecto el mes en curso), "Solo fijos e ingresos" o "Desde cero";
  - la opción nueva toma la siguiente letra, con una **copia del mes en su mes base**, y se abre su editor.
- **Mes base editable de cada opción** (`/planear/anual/:anio/base?opcion=C`), un editor como el plan de un mes:
  - los gastos por categoría con el monto de cada mes editable en la celda;
  - "+ Agregar a {categoría}" y quitar;
  - al lado, lo que entra, sale y queda libre al mes, y el total aproximado del año, que descuenta los créditos que terminan;
  - "Copiar otro mes" reemplaza el mes base por otro, con confirmación.
- **"Usar este mes en los 12 meses"**:
  - llena las celdas de la opción con el mes base, como replicar hoy, con los créditos que terminan;
  - conserva los eventos;
  - lleva al paso de lo que cambia.
- **"Cambiar mes base"** se muestra siempre, también con los meses ya creados, y abre el editor del mes base de la opción elegida.
- **Los meses creados desde el año** ("Meses con la Opción X") toman sus ítems del mes base editado de la opción, si lo tiene.
- **Lo que no cambia:** los ingresos siguen siendo los fijos de Ajustes y los aportes proyectados; el mes base solo guarda gastos.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- **`steward-plan-anual`:** nuevo requisito "Mes base editable de una opción", que es el backend.
- **`steward-planear`:** nuevo requisito "Nueva opción y su mes base en la web".

## Impact

- **Dominio:**
  - `OpcionAnual.mesBase: { origen: MesRef | null; items: ItemPlan[] } | null`;
  - `nuevaOpcionDesdeBase`, `copiarMesBase`, `guardarItemBase`, `quitarItemBase` y `usarMesBase` en `rules/anual.ts`;
  - la plantilla de la opción sale de `mesBase` si existe;
  - `PlanPort` y `api`.
- **Backend:**
  - V15 con la tabla `anual_base_item`;
  - `POST /api/anuales/{anio}/opciones` con `{desde: {tipo, anio?, mes?}}` además de `{desdeId}`;
  - `PUT /api/anuales/{anio}/opciones/{id}/base` (copiar otro mes);
  - `POST/PUT/DELETE /api/anuales/{anio}/opciones/{id}/base/items[/{itemId}]`;
  - `POST /api/anuales/{anio}/opciones/{id}/base/usar`;
  - el anual responde `mesBase` en cada opción;
  - pruebas de contrato y de migración.
- **PWA:**
  - `anual-base-page.ts` (el editor);
  - la hoja "Nueva opción desde un mes base";
  - `anual-page.ts` con el botón y "Cambiar mes base" siempre visible.
- **App:** sin cambios, pero tiene que seguir leyendo el anual con el campo nuevo.
