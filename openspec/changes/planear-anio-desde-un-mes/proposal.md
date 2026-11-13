# Proposal

## Why

El plan anual nace vacío: una cuadrícula de 12 meses con todo en $0 que hay que llenar celda por celda. Así no se sabe por dónde empezar. Lo natural es partir de un mes que ya funciona, copiarlo en el año y agregar solo lo que es distinto (primas, matrícula, SOAT, Navidad, un aumento). Además, en escritorio Planear se ve como una columna angosta de 560 px, con mucho espacio vacío.

Fuente: canvas de diseño *Presupuesto Hogar v3*, artboards `PlanInicioWeb`, `AnualBase`, `AnualCambios`, `AnualBaseMovil`, `AnualMesesMovil`, `AnualCambioMovil` y `PlanInicio`.

## What Changes

- **Replicar un mes en el año (paso 1):**
  - Planear el año empieza eligiendo el mes base: un mes con plan (su opción en uso o la Opción A), "Solo fijos e ingresos" o "Desde cero".
  - El año se llena con ese mes en los 12 meses: cada categoría con su total, y los aportes de cada persona como proyectados.
  - Si el año ya tiene plan, se puede replicar otra vez: las celdas se reemplazan, lo que cambia se conserva.
- **Lo que cambia (paso 2):**
  - "Algo distinto en un mes" agrega un ingreso o un gasto en un mes, con su categoría (por defecto, "Eventos del año").
  - Puede ser "Solo en {mes}" o "De {mes} en adelante" (un aumento, un gasto nuevo).
  - La lista "Lo que cambia" muestra cada uno y permite corregirlo o quitarlo.
  - "Crear los 12 meses" crea los meses desde el mes base, más lo que cambia, cada uno en su categoría.
- **Borrar el plan del año:** "Borrar plan de {año}", con confirmación, para empezar de nuevo. Los meses ya creados no cambian.
- **Web, desde 1024 px:**
  - La tabla de 12 meses resalta las celdas que cambian frente al mes base.
  - Debajo, la lista "Lo que cambia" y el formulario.
- **Móvil (app y PWA angosta):**
  - En lugar de la tabla con scroll horizontal, una lista de los 12 meses con lo que queda libre y lo que cambia en cada uno. Los meses seguidos que no cambian se agrupan.
  - El cambio se agrega en una hoja.
- **Planear en web, a todo el ancho:**
  - Arriba, la tarjeta del año con los pasos.
  - Debajo, "Próximos meses" y "Este mes y anteriores" como tarjetas en cuadrícula.
- **Backend:**
  - Un endpoint para replicar el mes base y otro para borrar el plan anual.
  - Los eventos ganan categoría y "de ese mes en adelante", y se pueden corregir y quitar.
  - "Crear meses" usa el mes base como plantilla.
  - Los años que ya tienen plan anual siguen funcionando igual.

**No se incluye:**
- Elegir en qué meses replicar: se replica en los 12. Los meses que ya tienen plan no cambian al crear los meses.
- Copiar los ingresos extra del mes base (ventas, bonos). Se agregan como "algo distinto".

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-planear`:
  - "Planear inicio" gana la vista de escritorio a todo el ancho y la tarjeta del año.
  - "Plan anual" pasa de cuadrícula vacía a mes base + lo que cambia, con su vista móvil.
- `steward-plan-anual`:
  - Replicar el mes base.
  - Eventos con categoría y "de ese mes en adelante", y corregir o quitar eventos.
  - Crear los meses desde el mes base.
- `steward-mobile-app`: "Distribución solo por TestFlight" pasa a la versión 2.1.0. "Paridad con la PWA": El plan anual ya no se desplaza en horizontal en móvil; usa la lista de meses.

## Impact

- **Dominio** (`packages/domain/src/rules/anual.ts`, modelo y puertos):
  - `replicarMes`, `editarEvento` y `quitarEvento`.
  - `EventoAnual` gana `categoriaId` y `enAdelante`.
  - `PlanAnual` gana `base`.
  - `resumenAnual` marca las celdas que cambian y agrupa "lo que cambia".
  - `crearMesesDesdeAnual` usa la base.
- **Backend:**
  - Migración `V11`: `plan_anual.base_anio` / `base_mes`, y `anual_evento.categoria_id` / `en_adelante`.
  - `AnualUseCase`, `NacimientoMes`, `AnualController` (nuevos `POST /api/anuales/{anio}/replicar`, `PUT` y `DELETE /api/anuales/{anio}/eventos/{id}`) y el contrato.
- **PWA:**
  - `planear-inicio-page.ts`: vista de escritorio.
  - `anual-page.ts`: pasos, tabla y lista de cambios.
  - Hoja de cambio y adaptador HTTP.
- **App móvil:** `(tabs)/planear.tsx` (tarjeta del año) y `anual/[anio].tsx` (pasos, lista de meses y hoja).
- Sin dependencias nuevas.
