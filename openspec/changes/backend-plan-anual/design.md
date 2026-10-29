# Design

## Context

Estado al empezar (ver proposal.md, "Why"):

- **Backend.** El de la Etapa 7 (`backend-opciones-mes`). No sabe nada del plan anual.
- **Dominio compartido.**
  - `PlanAnual { anio, estado BORRADOR | CREADO, filas: [{ categoriaId, montos[12] }], eventos[] }` y `ProyeccionAporte { usuarioId, ref, monto }` en `EstadoHogar.proyecciones`.
  - `resumenAnual`: los ingresos fijos llenos en las 12 columnas, los eventos de ingreso, una fila tenue por persona con proyecciones, las filas de gasto del anual, el diezmo calculado, "Eventos del año" y los KPI.
  - `agregarEvento`, `editarMontoAnual` (falla si la categoría no tiene fila) y `crearMesesDesdeAnual`.
  - `ingresosDelMes` usa las proyecciones: un mes sin aportes reales de una persona muestra su proyección tenue.
  - **No existe** cómo crear un anual ni una proyección: solo la semilla.
- **PWA.** `PuertosConectados.plan.anual`, `agregarEvento` y `editarMontoAnual` delegan en el adaptador de prueba; `crearMesesDesdeAnual` rechaza con `ETAPA_8`. `superposicion.ts` deja `anuales` y `proyecciones` de prueba. El aviso "Datos de prueba" y "Restablecer" se ven en modo conectado.

Decisiones de Daniel al proponer:
- "Crear plan anual" lo crea vacío;
- los aportes proyectados son editables por persona.

## Goals / Non-Goals

**Goals:**
- Que el plan anual y sus proyecciones sean reales y compartidos, con las vistas calculadas por el mismo dominio.
- Que el hogar pueda crear y llenar un anual desde cero.
- Que en modo conectado ya no quede nada de prueba.

**Non-Goals:**
- Borrar o editar eventos del año: el dominio solo los agrega.
- Borrar un plan anual.
- Que el cierre de un mes actualice el anual. La pantalla lo menciona, pero el dominio no lo hace; queda para después.
- Llenar el anual desde el último mes (Daniel eligió vacío).

## Decisions

### D1. Dominio (demo y conectado igual)

- **`crearAnual(estado, { anio, hoy })`**: el año no puede ser anterior al de `hoy` (`DATOS_INVALIDOS`) ni tener anual (`YA_EXISTE`). Crea `{ anio, estado: 'BORRADOR', filas: [], eventos: [] }`. Las filas en $0 no se guardan: las pone la vista.
- **`resumenAnual`**:
  - **gastos:** una fila por categoría del hogar en orden, salvo "Eventos del año" (que ya es su propia fila). Los montos salen de la fila guardada, o ceros.
  - **ingresos:** una fila de aportes por cada miembro del hogar (`usuarios`), tenue, aunque no tenga proyecciones, para que se pueda editar.

  Cambia la vista del demo: aparecen filas en $0 para las categorías sin fila y para el miembro sin proyecciones. Los tests de la semilla se ajustan donde cuentan filas.
- **`editarMontoAnual`**: si la categoría existe y no tiene fila, la crea con ceros. Una categoría que no es del hogar responde `NO_EXISTE`.
- **`editarProyeccion(estado, { usuarioId, ref, monto })`**: `monto >= 0`; con 0 quita la proyección. El usuario tiene que ser del hogar, y el año, tener anual.
- **`crearMesesDesdeAnual`**: salta los meses con cierre (un mes cerrado sin plan no gana plan, como en la Etapa 6).
- **`PlanPort`** gana `crearAnual(anio)` y `editarProyeccion(usuarioId, ref, monto)`.

### D2. Datos: `V7__plan_anual.sql`

- **`plan_anual`**: `id`, `hogar_id` (CASCADE), `anio`, `estado` (BORRADOR, CREADO). Único `(hogar_id, anio)`, que garantiza `YA_EXISTE`.
- **`anual_celda`**: `anual_id` (CASCADE), `categoria_id` (FK diferida, como las de V4), `mes` 1..12, `monto >= 0`. PK `(anual_id, categoria_id, mes)`, y se guarda con upsert. Solo se guardan las celdas tocadas; la lectura arma `montos[12]` con ceros donde no hay.
- **`anual_evento`**: `id`, `anual_id` (CASCADE), `nombre`, `mes`, `monto > 0`, `tipo` (INGRESO, GASTO) y `usuario_id` (FK a usuario, null).
- **`proyeccion_aporte`**: `hogar_id` (CASCADE), `usuario_id`, `anio`, `mes`, `monto > 0`. PK `(hogar_id, usuario_id, anio, mes)`. Poner 0 borra la fila.

Las proyecciones van por hogar y no por anual, como en el dominio (`EstadoHogar.proyecciones`). Pero el caso de uso exige que el año tenga anual para editarlas, para que siempre haya dónde verlas.

### D3. API

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/anuales` | `{"anio"}` | 201, el anual |
| `PUT /api/anuales/{anio}/celdas` | `{"categoriaId", "mes", "monto"}` | 204 |
| `POST /api/anuales/{anio}/eventos` | `{"nombre", "mes", "monto", "tipo", "usuarioId"?}` | 201, el evento |
| `PUT /api/anuales/{anio}/proyecciones` | `{"usuarioId", "mes", "monto"}` | 204 |
| `POST /api/anuales/{anio}/crear-meses` | — | 200, los meses creados (`[{anio, mes}]`) |

Va en `AnualUseCase` y `AnualController`. El año va en la ruta porque es único por hogar. El hogar sale de la sesión, así que un año de otro hogar no se puede ni nombrar.

### D4. Crear los meses (backend)

`AnualUseCase.crearMeses` reproduce `crearMesesDesdeAnual`:
1. **Plantilla:** la opción principal del último plan del hogar anterior al 1 de enero del año (consulta: el plan más reciente con `ref < (anio, 1)`).
2. **"Eventos del año":** se busca la categoría por nombre. Si no existe y hay eventos de gasto, se crea (`orden` 90, tipo `OTRO`, color `#5F625C`).
3. **Por cada mes sin plan y sin cierre:**
   - los ítems de la plantilla de cada categoría con fila, en el orden de las categorías, más el ajuste a la columna, más los eventos de gasto del mes;
   - **si la columna es menor que lo copiado**, la categoría entra como un solo ítem por el monto de la columna (o nada si es 0). El dominio antes ponía un ajuste negativo, pero los ítems no pueden ser negativos (`item_plan.monto >= 0`, y `guardarItem` los rechaza). Se descubrió al implementar y el dominio cambia igual;
   - un plan en Borrador con la Opción A, nota "Del plan anual".

   Si otro miembro lo creó a la vez, `YA_EXISTE` se ignora en ese mes.
4. **El anual pasa a CREADO.**

Todo en una transacción. Responde los meses que creó.

Las cuotas de los créditos (D5 de la Etapa 5) **no** se agregan aquí: `crearMesesDesdeAnual` del dominio no lo hace, y el anual ya tiene la fila Créditos con su monto. Se mantiene la paridad.

### D5. Lectura

`GET /api/finanzas` gana:
- `anuales`, con `anio` desde el año del primer mes de la ventana: `[{anio, estado, celdas: [{categoriaId, mes, monto}], eventos}]`;
- `proyecciones` de esos años.

`superposicion.ts` arma `PlanAnual` (con `filas` de 12 montos) y `proyecciones` con lo real. No quedan anuales de prueba.

### D6. PWA

- **`PuertosConectados.plan`**: `crearAnual`, `editarMontoAnual`, `agregarEvento`, `editarProyeccion` y `crearMesesDesdeAnual` van por HTTP y releen. `anual` sigue en el dominio sobre lo superpuesto. Fuera `ETAPA_8`.
- **`PuertosConectados.demo`** devuelve `null`: ya no hay nada que restablecer. El aviso y la sección de Ajustes dependen de `demo`, así que desaparecen solos en modo conectado.
- **Pantalla del anual:**
  - sin anual, muestra "Crear plan anual {año}" (año en curso o futuro);
  - las filas de aportes son editables como las de gasto: tenues, con el mismo campo de monto.
- **Planear inicio:** su enlace al anual ya existe ("Ver año").

## Risks / Trade-offs

- **[La vista del anual cambia en demo]** (filas en $0 para categorías y miembros sin datos) → es lo que hace falta para llenar un anual vacío. Los tests de la semilla se ajustan.
- **[Quitar el adaptador de prueba del modo conectado]** → `demo` en `null` cambia lo que ven Ajustes y el shell. Si alguna pantalla usa `demo` sin comprobar, falla. Se revisan los usos y lo cubren los tests de modo conectado.
- **[Crear meses de un año con meses pasados]** → si se crea el anual del año en curso, "Crear meses" también crea los meses pasados sin plan ni cierre, en Borrador. Es el comportamiento del dominio; se acepta, y esos meses se pueden cerrar.

## Migration Plan

`V7` solo agrega tablas. Despliegue local como siempre. Rollback: volver al build anterior funciona; los anuales guardados quedan sin leer.

## Open Questions

Ninguna.
