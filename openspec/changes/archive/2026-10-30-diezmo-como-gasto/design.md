# Design

## Context

Hoy (Etapas 3 y 4) el diezmo tiene un circuito propio, fuera del plan:
- **Dominio** (`packages/domain`):
  - `diezmoPlaneado` suma el diezmo de los fijos con regla, de los eventos de ingreso del anual y de los aportes con diezmo. Lo usan `vistaOpcion`, `compararOpciones` y `resumenMes` como una fila "Calculado" que se suma sola al plan y a lo comprometido;
  - `diezmosPendientes` arma obligaciones a partir de los ingresos recibidos con `aplicaDiezmo` y de los aportes, y `entregarDiezmo` las cierra con un movimiento `DIEZMO_ENTREGADO` (`diezmoDe`);
  - el cierre agrega una fila "Diezmo" (plan contra entregado);
  - el anual tiene una fila "Diezmo" calculada y el KPI "diezmo del año".
- **Backend:**
  - `regla_diezmo`; `movimiento.aplica_diezmo`; `diezmo_cubierto` (entrega → movimientos que cubre); `hogar.diezmo_en_hoy`;
  - endpoints `/api/diezmo/pendientes`, `/api/diezmo/entregas` y `/api/hogar/diezmo-en-hoy`;
  - `PlanUseCase.crearPlan` reproduce `crearMes`, y `conCuotas` agrega las cuotas de los créditos.
- **Categorías:** cuatro del sistema; "Diezmo" está reservado como nombre (`RESERVADA`).
- **El mismo patrón ya existe** para los créditos: al crear el mes, `cuotasDeCreditos` agrega a la opción un ítem enlazado (`creditoId`) por cada crédito con saldo, y al agregar un crédito su cuota entra a la opción principal del mes en curso.
- **Producción** se encendió el 2026-10-29 (Etapa 9) con el modelo viejo: puede haber planes, recibidos y entregas reales antes de que salga esta etapa.

Decisión de Daniel: el diezmo se presupuesta como gasto, con un ítem independiente por cada ingreso (fijo o extra), y se marca cuando se lleva.

## Goals / Non-Goals

**Goals:**
- El diezmo es un ítem más del plan: editable, quitable, pagable desde una cuenta, y en el cuadre.
- Un ítem por ingreso, con el monto sugerido por la regla.
- Nada se descuenta ni se suma solo.
- Los datos que ya existen siguen cuadrando.

**Non-Goals:**
- Conectar la app Expo (Etapa 11). Aquí solo se ajusta para que compile y sus pruebas pasen.
- Recalcular los ítems cuando cambian la regla o el ingreso después de crear el mes.
- Cambiar la regla de diezmo, el onboarding o la vista previa del diezmo.

## Decisions

### D1. Categoría del sistema "Diezmo" y tipo de ítem `DIEZMO`

**Categoría.** "Diezmo", tipo `DIEZMO`, `sistema = true`, `orden = 0` (va primero), color del diseño para el diezmo. Se crea con el hogar (`Categoria.delSistema` y `seed.ts`) y la migración la agrega a los hogares existentes. No se renombra ni se borra: renombrarla responde `RESERVADA`. En Ajustes aparece sin "Editar".

**Ítem.** Tipo `DIEZMO`, con dos enlaces opcionales y excluyentes:
- `ingresoFijoId`: el diezmo de un ingreso fijo;
- `aporteId`: el movimiento `APORTE` que lo origina.

El diezmo de un evento del anual no lleva enlace: el nombre lo identifica.

**Alternativa descartada:** un solo `origenId` sin tipo, porque no deja poner llaves foráneas.

**Llaves foráneas:**
- `item_plan.ingreso_fijo_id` → `ingreso_fijo`, `ON DELETE SET NULL`;
- `item_plan.aporte_id` → `movimiento`, diferida, como las de V4.

### D2. Cuándo nacen los ítems (dominio y backend, mismas cifras)

`diezmosDelMes(estado, ref, items)` en el dominio, que el backend reproduce en `PlanUseCase`:

1. **`crearMes`, las tres formas.** `copiarItems` deja fuera los ítems `DIEZMO`. Luego:
   - por cada ingreso fijo activo cuyo dueño tiene regla activa: "Diezmo · {ingreso}", `calcularDiezmo(regla)`, `ingresoFijoId`;
   - por cada evento `INGRESO` del plan anual de ese mes con `usuarioId` que tiene regla: "Diezmo · {evento}", sobre el monto del evento con la base `BRUTO` (como hoy en `diezmoPlaneado`), sin enlace;
   - por cada aporte del mes con `aplicaDiezmo` que todavía no tiene ítem enlazado (registrado antes de que existiera el plan): "Diezmo · aporte {fecha corta}", porcentaje de la regla de quien aportó (10 % si no tiene), `aporteId`.
2. **`registrarAporte` con `aplicaDiezmo`.** Si el mes tiene plan no cerrado, el ítem entra a la opción principal: la activa, o la A mientras ninguna lo está. Es la misma regla que `agregarCredito`. En el backend va en la misma transacción que el aporte. Si el mes no tiene plan, lo recoge el punto 1.
3. **`crearMesesDesdeAnual`.** Usa las mismas reglas del punto 1 (ingresos y diezmos). Los ítems `DIEZMO` del plan base no se copian. La categoría Diezmo no participa del "Ajuste del plan anual". El anual rechaza celdas en esa categoría (400 `DATOS_INVALIDOS`).

**Por qué no copiar el diezmo del mes anterior:** el monto sale de la regla y del ingreso actuales. Si se copiara, un aumento de salario quedaría con el diezmo viejo. El monto que se edite a mano dura solo ese mes.

### D3. Lo que se quita y lo que queda como historia

**Se quita:**
- del dominio: `diezmosPendientes`, `entregarDiezmo`, `definirDiezmoEnHoy`, `ObligacionDiezmo` y `diezmoEnHoy`;
- de los puertos: `PlanPort` y `FinanzasPort`;
- del backend: los tres endpoints y sus casos de uso;
- de la PWA: la tarjeta, "Entregado" y el ajuste.

**`diezmoPlaneado`** deja de usarse en el plan del mes, en comparar opciones, en Hoy y en el cierre. Se queda solo para el anual (fila calculada y KPI), renombrado `diezmoProyectado` para que no se confunda.

**Historia (`DIEZMO_ENTREGADO`):**
- el tipo sigue existiendo para leer, no se crea más;
- en `efecto()` y en el saldo estimado del backend sigue restando de su cuenta, sin cambios;
- en `resumenMes` y en el cierre cuenta como un gasto sin ítem: suma a "Pagado", a lo comprometido y a la fila "No estaba planeado" del cierre, como un `GASTO` con `itemId = null`;
- `diezmo_cubierto` y `movimiento.aplica_diezmo` se conservan para no perder historia, pero ya no se leen para nada nuevo.

### D4. Hoy, Planear y cierre

- **Hoy:** los ítems `DIEZMO` salen en Por pagar y en Ya pagado como los demás. "Recibí" solo registra el ingreso. La hoja de aporte inicia "Aplicar diezmo" con `regla.aplicaAportes` de quien aporta.
- **Planear:**
  - la opción agrupa por categoría, y Diezmo es una más (va primera por su orden);
  - se quita la fila "Diezmo · Calculado" bloqueada;
  - en comparar opciones, los ítems de diezmo entran a sus filas por categoría, sin la fila especial `'diezmo'`;
  - "Mes sin plan" sigue mostrando la línea informativa "Diezmo de la {prima}" en lo que trae el mes.
- **Cierre:** se quita la fila "Diezmo" especial; la categoría Diezmo sale como fila igual que las demás (plan contra real de sus ítems). El cierre del backend valida la foto que manda la PWA (Etapa 6), así que no hay regla nueva en el servidor.

### D5. Migración `V8__diezmo_como_gasto.sql`

1. **Categoría:**
   - `categoria.tipo` acepta `DIEZMO`;
   - `INSERT` de "Diezmo" (`orden 0`, sistema) en cada hogar.
2. **Ítem:**
   - `item_plan.tipo` acepta `DIEZMO`;
   - columnas `ingreso_fijo_id` y `aporte_id` con sus FK;
   - `CHECK (ingreso_fijo_id IS NULL OR aporte_id IS NULL)`.
3. **Ítems para los planes abiertos.** Para cada plan con estado distinto de `CERRADO` y mes mayor o igual al mes en curso (zona `America/Bogota`), y cada opción no archivada:
   - **por cada ingreso fijo activo** del hogar cuyo dueño tiene regla activa, un ítem `DIEZMO` con `round(base × porcentaje / 100)`. Se omite si en ese mes ya hay un `INGRESO_FIJO` recibido de ese ingreso que esté cubierto por una entrega (`diezmo_cubierto`): ese diezmo ya se llevó;
   - **por cada evento `INGRESO` del anual de ese mes** con un miembro con regla activa, su ítem (como `diezmosDelMes`);
   - **por cada aporte del mes con `aplica_diezmo`** no cubierto, su ítem.

   `round()` de Postgres sobre `numeric` redondea las mitades hacia arriba en positivos, como `Math.round`.
4. **`hogar.diezmo_en_hoy`:** `DROP COLUMN`.
5. **Líneas de ingreso (D8):**
   - tabla `ingreso_plan`, y `movimiento.ingreso_plan_id` → `ingreso_plan`, `ON DELETE SET NULL`;
   - a **todas** las opciones de los planes no cerrados (de cualquier mes, para que no pierdan sus ingresos) se les crea una línea `FIJO` por cada ingreso fijo activo, con su neto, y una `EXTRA` por cada evento `INGRESO` del plan anual de ese mes;
   - los movimientos ya recibidos no se tocan: una línea `FIJO` se lee recibida por su `ingreso_fijo_id` (D8).

Antes del deploy a producción: `deploy.ps1 -Projects steward -Action Backup`.

### D6. Datos de prueba (`seed.ts`) y escenarios de Hoy

En el seed, el diezmo del salario pasa a ser el ítem "Diezmo · Salario Daniel" ($700.000) en la categoría Diezmo, en todas las opciones de todos los planes, **sin pagar**: el seed no tiene ninguna entrega registrada, y el diezmo de octubre estaba pendiente. Cada opción gana su línea "Salario Daniel" por $6.288.000 (D8). Así Hoy sigue mostrando las cifras del escenario "Datos de ejemplo":
- Plan $5.390.000 = $4.690.000 de ítems + $700.000 de diezmo;
- Pagado $2.613.000 y Vs. plan −$62.000, porque el diezmo no está pagado;
- "Te queda libre $3.436.000", porque comprometido ya contaba los $700.000.

`VERSION_ESQUEMA` sube a 2 para que el estado guardado en los dispositivos se vuelva a sembrar. Si alguna cifra cambia, se ajusta el seed y no el escenario; si no se puede, se pausa y se decide con Daniel.

### D8. Líneas de ingreso de cada opción ("el plan es un cuaderno")

Decisión de Daniel (2026-10-29): todo en el plan se edita, también los ingresos.

**Modelo.** `Escenario.ingresos: IngresoPlan[]`, con:
- `id`, `nombre`, `monto`;
- `usuarioId | null`;
- `tipo`: `FIJO`, `EXTRA` u `OTRO`;
- `ingresoFijoId | null`.

En el backend es la tabla `ingreso_plan`, con `escenario_id` y `ON DELETE CASCADE`. `Movimiento` gana `ingresoPlanId | null`: la línea que se recibió.

**Nacimiento** (`crearMes`, `crearMesesDesdeAnual`):
- una `FIJO` por cada ingreso fijo activo, con su neto y su dueño;
- una `EXTRA` por cada evento `INGRESO` del anual de ese mes;
- con `COPIAR`/`FIJOS`, además, las `OTRO` de la opción principal del mes anterior.

Las `FIJO` y `EXTRA` no se copian, igual que el diezmo (D2). `duplicarEscenario` copia todas las líneas con ids nuevos.

**Ingreso fijo nuevo a mitad de mes** (`ingresoFijoAlMes`, y `crearIngreso` en el backend): entra a la opción principal del mes en curso si tiene plan abierto, con su ítem de diezmo si su dueño tiene regla. Es la misma regla que la cuota de un crédito nuevo (`agregarCredito`). Así se mantiene el escenario de Ajustes "Agregar un ingreso después del onboarding" (aparece en Hoy por recibir). Los meses ya creados más adelante no cambian.

**Edición.**
- Dominio: `guardarIngresoPlan` y `quitarIngresoPlan`, con las mismas reglas que los ítems (`MES_CERRADO`).
- Quitar una línea recibida responde `INGRESO_RECIBIDO`.
- Backend: `POST /api/planes/{id}/escenarios/{escenarioId}/ingresos`, `PUT` y `DELETE` de `.../ingresos/{ingresoId}`.

**Lectura** (`ingresosDelMes`):
- `PLANEACION` (la opción que se ve), `PLAN` (la columna plan del cierre) y `EJECUCION` (Hoy) usan las líneas de la opción en vez de los ingresos fijos de Ajustes y los eventos del anual. Después siguen los aportes o proyecciones y el sobrante, como hoy.
- Un mes sin plan, o un mes cerrado cuya opción no tiene líneas, usa lo de antes: los fijos de Ajustes y los eventos del anual.
- En `EJECUCION`, una línea está recibida si hay un `INGRESO_FIJO` del mes con su `ingresoPlanId`, o, si es `FIJO`, uno con su `ingresoFijoId` (lo recibido antes de este cambio). Cuenta con el monto recibido si lo está, y con el de la línea si no.
- Un `INGRESO_FIJO` del mes que no corresponde a ninguna línea (su línea se quitó) se muestra igual, con su nombre, para que lo real nunca desaparezca.
- `vistaOpcion` pasa a calcular los ingresos por opción: `ingresosDelMes(estado, ref, modo, escenario)`.

**"Recibí"** (`marcarRecibido`):
- recibe `lineaId` o `ingresoFijoId` (este último solo si el mes no tiene plan) y un `monto` opcional;
- el movimiento sigue siendo `INGRESO_FIJO`, con `ingresoPlanId` y, si la línea es `FIJO`, `ingresoFijoId` y `bruto`;
- `YA_RECIBIDO` aplica por línea, y por ingreso fijo en el mes;
- la cuenta es la del ingreso fijo enlazado, o ninguna.

En el backend: `POST /api/planes/{id}/escenarios/{escenarioId}/ingresos/{ingresoId}/recibido` (monto opcional) para una línea, y `POST /api/ingresos-fijos/{id}/recibido` sigue para un mes sin plan, ahora también con monto opcional.

**Por qué no editar el ingreso fijo desde el plan:** Ajustes guarda el salario base con el que nacen los meses nuevos. El plan de cada mes y opción es su propio cuaderno, y cambiarlo no debe mover los demás meses.

### D7. App Expo

`mobile/` usa el dominio con datos de prueba (Etapa 1.5). Se quitan la tarjeta "Disponible para diezmar" de `hoy.tsx` y lo que use `entregarDiezmo` o `diezmoEnHoy`, y `aporte.tsx` toma el valor inicial de la regla. Sus pruebas (`npm test` en `mobile/`) deben pasar. Sin rediseño: eso entra con la Etapa 11.

## Risks / Trade-offs

- **[Producción ya tiene datos con el modelo viejo]** → La migración agrega los ítems a los planes abiertos y omite los diezmos ya entregados. Además, backup antes del deploy y prueba de la migración sobre una copia de `steward.test` con entregas y planes abiertos.
- **[Un ítem duplicado si la migración no ve una entrega]**, por ejemplo una entrega agrupada que cubre varios ingresos → se puede quitar a mano: es un ítem normal sin pagos.
- **[Cambiar la regla no actualiza los meses creados]** → Es lo esperado (Non-Goals) y Ajustes lo explica.
- **[Quitar endpoints rompe clientes viejos]** → El único cliente es la PWA, que se publica con el mismo deploy. La app Expo no está conectada.

## Migration Plan

1. Dominio y pruebas (`packages/domain`).
2. Backend con `V8` y contrato (JVM y AOT).
3. PWA y Expo.
4. Recorrido en `steward.test`.
5. En producción: backup, deploy (binario nativo) y verificación.

**Rollback:** `deploy.ps1 -Action Rollback` vuelve al binario anterior, pero `V8` no se deshace sola (quita una columna). Volver de verdad es restaurar el backup.

## Open Questions

Ninguna. El color de la categoría Diezmo sale del token de diezmo del diseño; si no hay uno, se usa el acento `#2E4A3B`.
