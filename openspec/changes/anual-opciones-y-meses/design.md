# Design

## Context

- **Dominio:** `PlanAnual` = `{ anio, estado, filas, eventos, base }`, y las proyecciones viven en `EstadoHogar.proyecciones`.
  - `crearMesesDesdeAnual` salta los meses con plan y no toca créditos ni tarjetas.
  - `replicarMes` falla si el año está `CREADO`.
  - `resumenAnual` muestra en $0 las categorías sin fila.
- **Backend:** tablas `plan_anual` (estado, base), `anual_celda (anual_id, categoria_id, mes)` y `anual_evento (anual_id)`. Las proyecciones van en su propia tabla, por hogar y mes.
  - `AnualUseCase.crearMeses` replica la regla del dominio: plantilla del mes base, ajuste por categoría y eventos, solo para los meses sin plan.
- **Crear un mes normal** (`crearMes`) ya trae `cuotasDeCreditos` y `lineasDeTarjetas`, y avanza las cuotas de los ítems "cuota N de M".
- **El caso real:** 2027 de Daniel tiene marzo a diciembre creados antes de llenar el año, solo con el salario y su diezmo, y el año quedó `CREADO`.
- **Diseño:** artboards `AnualOpcionesWeb`, `AnualOpcionesMovil` y `AnualActualizarMovil`.

## Goals / Non-Goals

**Goals:**
- Que nunca quede un mes vacío sin que se sepa, y que se pueda arreglar sin borrar mes por mes.
- Opciones del año con la misma idea que las de un mes.
- Que un mes creado desde el año traiga lo mismo que uno copiado: créditos vivos, tarjetas y todas las categorías.

**Non-Goals:**
- Aportes proyectados por opción.
- Comparar más de dos opciones lado a lado.
- Deshacer.

## Decisions

### D1. Modelo

```ts
interface OpcionAnual { id: Id; letra: string; creadoPor: Id; nota: string; filas: FilaAnual[]; eventos: EventoAnual[]; base: MesRef | null }
interface PlanAnual { anio: number; estado: 'BORRADOR' | 'CREADO'; opciones: OpcionAnual[]; opcionEnUso: Id | null }
```

- **Opción A:** `crearAnual` crea la A.
- **Semilla:** `VERSION_ESQUEMA` 6 deja el 2027 de prueba en la A. Las semillas viejas se vuelven a sembrar, como en cada cambio de esquema.
- **Funciones con opción:** las de celdas, eventos y replicar reciben `opcionId?`, y `opcionDe(anual, id?)` resuelve: el id, si no la en uso, si no la primera.
- **`resumenAnual(estado, anio, opcionId?)`:** calcula con la opción resuelta y devuelve también `opciones` (letra, autor, nota, libre del año) y `libreA` (lo que deja libre cada mes la A), para "mes a mes" y "vs A".

### D2. Backend y migración V14

1. **Tabla de opciones:** `anual_opcion (id, anual_id, letra, creado_por, nota, base_anio, base_mes)`, única por `(anual_id, letra)`.
2. **Columna en el año:** `plan_anual.opcion_en_uso_id` (nullable).
3. **Opción A de cada año existente:** se crea con su base y su creador (el primer miembro del hogar), y queda en uso si el año ya estaba `CREADO`.
4. **Celdas:** `anual_celda` gana `opcion_id NOT NULL`, que se llena con la A, y su clave única pasa a `(opcion_id, categoria_id, mes)`.
5. **Eventos:** `anual_evento` gana `opcion_id NOT NULL`, también llenada con la A.
6. **Base en el año:** `base_anio` y `base_mes` salen de `plan_anual` cuando ya se copiaron a la A.

**Endpoints:**
- **Opciones:**
  - `POST /api/anuales/{anio}/opciones {desdeId}` → 201 con la opción;
  - `DELETE /api/anuales/{anio}/opciones/{id}` → 204, o 409 `OPCION_EN_USO`.
- **Lo que ya existía:** celdas, eventos y replicar aceptan `opcionId` en el cuerpo; sin él, se usa la en uso o la A.
- **Meses:** `POST /api/anuales/{anio}/meses {opcionId, actualizar: [3..12]}` → 200 con `[{anio, mes, accion: CREADO|ACTUALIZADO}]`. El viejo `POST /api/anuales/{anio}/crear-meses` desaparece; la PWA y la app pasan al nuevo.
- **Lectura:** `GET /api/finanzas` trae los anuales con `opciones` y `opcionEnUso`.

### D3. Crear o actualizar un mes (dominio y backend, misma regla)

`mesesDesdeAnual(estado, anio, opcionId)` arma lo que muestra la hoja: por mes, la acción (`CREAR`, `ACTUALIZABLE` con `marcado`, o `BLOQUEADO` con su motivo) y un resumen de lo que tiene hoy.
- **Registros:** son los movimientos `PAGO`, `GASTO` o `INGRESO_FIJO` del mes, más su cierre.
- **`marcado`:** está marcado si alguna opción del mes tiene la nota "Del plan anual" o si no tiene ítems que no sean de diezmo.

`crearOActualizarMeses(estado, { anio, opcionId, actualizar, creadoPor, hoy })`:
1. **Validar:** si algún mes de `actualizar` está bloqueado, todo falla con `MES_CON_REGISTROS`.
2. **Meses que se actualizan:** se borra su plan (`borrarPlan` no aplica, porque no hay registros), se crean de nuevo y conservan su estado (`ACTIVO` o `BORRADOR`). Si el plan estaba Activo, la nueva Opción A queda en uso.
3. **Crear cada mes:** se usa la función de `crearMesDesdeColumna`, que ahora también:
   - **Categorías sin fila:** toma los ítems de la plantilla tal cual.
   - **Créditos:**
     - de la plantilla se quitan los ítems con `creditoId` cuyo crédito no tiene cuota en ese mes (`cuotasProyectadas`);
     - después se aplica `cuotasDeCreditos` para agregar la de los créditos sin ítem que sí pagan ese mes.
   - **Compras a cuotas viejas:** los ítems con `cuota` avanzan `meses entre la base y el mes`, y se quitan si pasan del total.
   - **Tarjetas:** se aplica `lineasDeTarjetas`.
4. **Al final:** `opcionEnUso` pasa a la opción usada y el estado del año a `CREADO`.

**Ajuste de la columna:** si los ítems de créditos o tarjetas cambian frente a la plantilla, ese cambio no cuenta para el "Ajuste del plan anual". El ajuste se calcula contra la plantilla ya filtrada por mes. Por eso, al replicar, la columna de Créditos baja después de la última cuota (spec "Un crédito que termina"). Así un crédito que termina no deja un "Ajuste" fantasma.

### D4. Replicar sin bloqueo

`replicarMes` deja de fallar con el año `CREADO`. Calcula las celdas por mes:
- **Base:** el total de la categoría en el mes base;
- **Créditos:** menos la cuota de cada ítem de crédito que ya no paga en ese mes.

### D5. PWA y app

- **PWA (`anual-page.ts`):**
  - pestañas de opciones, con "+ Duplicar" y "Quitar opción";
  - celdas distintas de la A, con anillo azul `#3C64A8`;
  - sección "Las dos opciones, mes a mes";
  - "Lo que cambia en la Opción X";
  - la hoja `meses-anual-hoja.ts`, compartida entre escritorio y móvil.
- **App:**
  - `anual/[anio].tsx` con chips y la diferencia "vs A";
  - la hoja de meses en un `Modal` `formSheet`.
- **La opción elegida:** en las dos se recuerda en la URL (`?opcion=B`).

## Risks / Trade-offs

- **[Riesgo] Actualizar borra lo que se editó a mano en un mes.** → Solo se puede en meses sin registros. Un mes hecho a mano sale desmarcado, y la hoja lo avisa.
- **[Riesgo] La migración V14 toca datos reales.** → Respaldo antes del despliegue, y una prueba de migración con un año `CREADO` con celdas y eventos.
- **[Trade-off] Los aportes proyectados se comparten entre opciones.** → Es lo más común (el aporte no depende del carro). Si hace falta, otra etapa los lleva a la opción.
