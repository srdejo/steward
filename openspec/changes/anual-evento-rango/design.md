# Design

## Context

Un evento del plan anual hoy es `{ mes, enAdelante }`. En el dominio, `eventosDelMes` (`rules/consultas.ts`) y las reglas de `rules/anual.ts` lo aplican a su mes o, con `enAdelante`, a todos los meses siguientes. En el backend, `PlanAnual.Evento.aplica(mes)` hace lo mismo; la columna es `anual_evento.en_adelante` (V11).

Hay dos clientes de la API:
- la PWA, que se despliega con el backend;
- la app 2.2.3, ya publicada en el App Store, que envía y lee `enAdelante`.

El demo guarda su estado en `localStorage`, con eventos que solo tienen `enAdelante`.

## Goals / Non-Goals

**Goals:**
- Un evento va de su mes a un mes "hasta" del mismo año, elegido en la hoja de la web y de la app.
- La app 2.2.3 sigue funcionando sin actualizarse.

**Non-Goals:**
- Rangos que crucen de un año a otro.
- Montos distintos dentro del rango: es el mismo monto cada mes.
- Cambiar los eventos del mes (`plan-mes`): solo el plan anual.

## Decisions

### D1. El modelo: `hasta` en lugar de `enAdelante`

- **Dominio:**
  - `EventoAnual` cambia `enAdelante: boolean` por `hasta: number` (de 1 a 12, con `hasta >= mes`).
  - `DatosEvento` acepta `hasta?` y, por compatibilidad, `enAdelante?`.
  - `normalizarEvento` resuelve `hasta ?? (enAdelante ? 12 : mes)`, y valida `mes <= hasta <= 12` (si no, `MONTO_INVALIDO`, como los otros datos del evento).
- **Una sola regla:** `aplicaEn(e, mes) = e.mes <= mes && mes <= e.hasta`.
  - La usan `eventosDelMes`, el resumen, las celdas distintas, el diezmo y los ítems del mes.
  - Hoy esas reglas repiten la condición `mes === m || (enAdelante && mes < m)`, así que se busca y se cambia en cada sitio.
- **Datos viejos:**
  - La superposición (`superposicion.ts`) mapea `hasta ?? (enAdelante ? 12 : mes)`.
  - El demo hace lo mismo al leer el estado guardado (en `leerEstado`, como las otras migraciones del demo).
  - La semilla pasa a `hasta`.
- **Alternativa descartada:** guardar `meses: number[]`. Permite huecos que nadie pidió y complica la hoja y la API.

### D2. Backend y compatibilidad

- **V16:**
  - `ALTER TABLE anual_evento ADD COLUMN hasta smallint`;
  - `UPDATE ... SET hasta = CASE WHEN en_adelante THEN 12 ELSE mes END`;
  - `SET NOT NULL`, con un `CHECK (hasta BETWEEN mes AND 12)`.
  - `en_adelante` se deja de leer y se quita en la misma migración. Al quitarla, el código viejo ya no puede volver sin una migración, y se acepta: el respaldo previo al despliegue cubre la vuelta atrás.
- **`PlanAnual.Evento`:**
  - cambia `enAdelante` por `hasta`;
  - `aplica(m) = mes <= m && m <= hasta`.
- **`EventoRequest`:** gana `Integer hasta`.
  - Con `hasta`, se usa ese valor.
  - Si no viene, `enAdelante` true da 12, y si no, el mismo mes.
  - Un `hasta` fuera de rango responde 400 `DATOS_INVALIDOS`.
- **`EventoResponse`:** lleva `hasta` y también `enAdelante = hasta == 12 && mes < 12`.
  - Así, la app 2.2.3 ve bien los eventos "en adelante".
  - Un evento "marzo a junio" lo ve solo en marzo: es el costo aceptado hasta actualizar la app (2.2.4).
- **Replicar, duplicar opción y los meses:** usan `Evento.aplica`, y no cambian más allá de copiar `hasta`.

### D3. Web: la hoja "Algo distinto en un mes"

- El grupo de radios "Solo en / En adelante" se reemplaza por una fila "Desde {mes} hasta [select]":
  - el `select` va del mes del cambio a diciembre;
  - por defecto, el mismo mes;
  - debajo, en texto tenue, "Solo en mayo", "Mayo a agosto · 4 meses" o "De mayo en adelante".
- Si se cambia el mes del cambio y el "hasta" queda antes, el "hasta" sube al mes nuevo.
- "En cuánto queda el mes" sigue mostrando el mes del cambio y, con rango, agrega "en cada uno de los N meses".
- "Lo que cambia" agrupa por el mes inicial y rotula el rango: "Mar a jun · Curso".
- Las celdas resaltadas y la lista móvil de la PWA salen del dominio y no cambian.

### D4. App

- `CambioHoja` en `src/app/(app)/anual/[anio].tsx` cambia el par "Solo / En adelante" por:
  - una fila "Hasta" que abre una lista de meses (de su mes a diciembre), en una hoja o un selector, igual que el mes;
  - el mismo texto de ayuda que en la web.
- La descripción del cambio en la lista usa el rango.
- La app nueva se publica como 2.2.4: tarea aparte, con confirmación de Daniel.

### D5. Diseño

- **Canvas Presupuesto Hogar v3:** se actualizan los artboards de la hoja de cambio, el web (AnualCambios) y el móvil (AnualCambioMovil), con:
  - la fila "Desde · Hasta";
  - el texto de ayuda;
  - "Lo que cambia" con un rango.
- Se publica el artefacto antes de implementar la UI.

## Risks / Trade-offs

- **[Riesgo] La app 2.2.3 edita un evento con rango:** envía `enAdelante: false` sin `hasta`, y el rango se perdería (quedaría solo en su mes).
  - Mitigación: al **editar**, si no viene `hasta`, el backend conserva el `hasta` guardado cuando `enAdelante` no cambia su lectura. Es decir, `enAdelante` false conserva un `hasta < 12`, y `enAdelante` true pone 12.
  - Se cubre con una prueba de contrato.
- **[Trade-off] Se quita `en_adelante` en V16:** es más limpio, pero volver al backend anterior necesita restaurar el respaldo. Como los datos de producción son de prueba (salvo noviembre en ejecución, que no tiene eventos anuales), es aceptable.
- **[Riesgo] Estado del demo guardado con `enAdelante`:** lo cubre la lectura de D1, con una prueba que carga un estado viejo.
