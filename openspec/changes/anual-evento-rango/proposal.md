# Proposal

## Why

Al planear el año, "Algo distinto en un mes" solo deja elegir "Solo en {mes}" o "De {mes} en adelante". Muchos cambios duran unos meses y luego terminan: un arriendo temporal, un curso de marzo a junio o un ingreso extra hasta la temporada. Hoy hay que agregar un evento por cada mes. Daniel pidió que el rango se elija: "de {mes} hasta {mes}".

## What Changes

- **El rango del evento:** un evento del plan anual va de su mes hasta otro mes del mismo año, entre el mes del evento y diciembre.
  - Hasta el mismo mes es "Solo en {mes}"; hasta diciembre es "De {mes} en adelante".
  - Un evento aplica a cada mes de ese rango: en el resumen, en las celdas resaltadas, en el diezmo y al crear o actualizar los meses.
- **Web:** en la hoja "Algo distinto en un mes", "Solo en / En adelante" se reemplaza por "Desde {mes} hasta [mes]". El "hasta" se elige y por defecto es el mismo mes.
  - "Lo que cambia" muestra el rango ("Mar a jun · Curso"), y "Antes de guardar" dice en cuánto queda el mes.
- **App (Expo):** la misma hoja con el rango; la lista de los meses muestra el cambio en cada mes del rango.
- **Backend:** el evento guarda `hasta`.
  - Una migración V16 lo llena desde `en_adelante`: diciembre si estaba en adelante, si no el mismo mes.
  - La API acepta `hasta` y sigue aceptando `enAdelante` (sin `hasta`), y responde los dos, para que la app 2.2.3 publicada siga funcionando.
- **Diseño:** la hoja de cambio con el rango, en web y móvil, en el canvas Presupuesto Hogar v3.

## Capabilities

### New Capabilities
<!-- Ninguna -->

### Modified Capabilities
- `steward-plan-anual`: el evento lleva el mes hasta el que se repite, en lugar de "solo ese mes" o "en adelante"; crear los meses usa ese rango.
- `steward-planear`: "Algo distinto en un mes" pide "Desde {mes} hasta {mes}", y "Lo que cambia" muestra el rango.

## Impact

- **`packages/domain`:**
  - `EventoAnual` y `DatosEvento` cambian `enAdelante` por `hasta`;
  - `aplicaEn` y las reglas de `rules/anual.ts` (resumen, celdas distintas, diezmo, ítems del mes);
  - la superposición y la API conectada (`hasta`, con `enAdelante` como respaldo);
  - el demo y sus pruebas.
- **`backend`:**
  - V16 sobre `anual_evento`;
  - `PlanAnual.Evento.aplicaEn`, `EventoRequest` y `EventoResponse`, `AnualUseCase` y el adaptador R2DBC;
  - las pruebas de contrato y de migración, y el `README`.
- **`frontend`:** `cambio-hoja.ts`, la lista "Lo que cambia" en `anual-page.ts`, las pruebas y el `README`.
- **`mobile`:** la hoja de cambio en `src/app/(app)/anual/[anio].tsx` y sus pruebas. Hace falta una versión nueva de la app (2.2.4) para tener el rango; la 2.2.3 sigue leyendo los eventos con rango sin romperse.
- **Compatibilidad:** la app 2.2.3 envía `enAdelante` y lee `enAdelante`.
  - El backend responde `enAdelante = true` solo cuando `hasta` es diciembre y el mes es anterior.
  - Un evento "marzo a junio" se ve en la 2.2.3 solo en marzo, hasta que se actualice la app.
