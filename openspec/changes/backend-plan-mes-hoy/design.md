# Design

## Context

Estado al empezar (ver proposal.md, "Why"):

- **Backend.** El de la Etapa 3 (`backend-ingresos-diezmo`):
  - `FinanzasUseCase` y `GET /api/finanzas`;
  - la tabla `movimiento`, con tipo y columnas opcionales, hoy solo INGRESO_FIJO y DIEZMO_ENTREGADO;
  - `diezmo_cubierto`;
  - `CalculoDiezmo`, que reproduce las cifras del dominio;
  - el mes en curso, decidido por el backend (America/Bogota).
- **Dominio compartido.** Ya tiene las reglas de esta etapa, con tests:
  - `crearMes` (COPIAR, FIJOS, CERO, con avance de cuotas), `guardarItem` y `quitarItem`, `usarEscenario`, `estadoEfectivo` (Borrador con opción elegida pasa a Activo al llegar el mes);
  - `marcarPago` (`YA_PAGADO` con nombre y fecha; un variable se registra como GASTO), `registrarGasto`, `registrarAporte`;
  - `esAporteImplicito` (origen EXTERNA), `diezmosPendientes` (también de aportes), `guardarCategoria`;
  - las vistas: `resumenMes` (libre, vsPlan, pagado), `vistasOpciones` y `vistaCierre`.
- **PWA.** `PuertosConectados` superpone `GET /api/finanzas` al estado de prueba en cada lectura (`superposicion.ts`, D5 de la Etapa 3). Hoy, Planear y Cuentas calculan con las reglas del dominio sobre el estado mezclado, y las hojas de Hoy registran con el id real del usuario.

## Goals / Non-Goals

**Goals:**
- Que el plan del mes y lo que se registra en Hoy sean reales y compartidos, con las cifras de las vistas calculadas por el mismo dominio en el cliente.
- Que el backend valide lo que el dominio valida al escribir: mes cerrado, pago duplicado, ítem que no está en el plan, categoría reservada o repetida.
- Que lo que queda para otras etapas (varias opciones, cierre, plan anual, créditos) no escriba en el estado de prueba algo que el usuario creería real.

**Non-Goals:**
- Varias opciones por mes, Duplicar, Comparar y "Usar esta" entre varias (Etapa 7). El esquema sí admite varias opciones.
- Cerrar el mes, el reparto del sobrante y "Sin registrar" en el backend (Etapa 6).
- Créditos en el backend, el vínculo ítem-crédito y que pagar una cuota baje el saldo del crédito (Etapa 5). Los ítems de tipo CUOTA y CREDITO se guardan sin `creditoId`.
- Plan anual y proyecciones de aportes (Etapa 8).
- Que el backend calcule "Te queda libre", "Vs. plan" o los totales: siguen en el dominio compartido (D3).

## Decisions

### D1. Una capacidad nueva para el plan; los registros, en `steward-finanzas`

- `steward-plan-mes` agrupa categorías, plan, opción e ítems: es planeación.
- Pago, gasto y aporte son movimientos, como "Recibí" y "Entregado", así que van con `steward-finanzas` y su tabla `movimiento`.

En el código:
- `PlanUseCase` y `PlanController` para lo nuevo de planeación;
- `FinanzasUseCase` y `FinanzasController` crecen con pagos, gastos y aportes, y extienden las obligaciones a los aportes;
- `GET /api/finanzas` sigue siendo la única lectura (D4).

### D2. Datos: `V3__plan_mes.sql`

- **`categoria`**: `id`, `hogar_id` (con ON DELETE CASCADE), `nombre`, `color`, `orden`, `tipo` (con CHECK en FIJO, TARJETA, VARIABLE, CREDITO, OTRO) y `sistema`.
  - Índice único `(hogar_id, lower(nombre))`, que garantiza `DUPLICADA`.
  - La migración inserta las cuatro del sistema para cada hogar que ya existe. `HogarUseCase.crear` las inserta en la misma transacción que el hogar.
- **`plan_mes`**: `id`, `hogar_id` (con CASCADE), `ref_anio`, `ref_mes`, `estado` (con CHECK en BORRADOR, ACTIVO, CERRADO) y `escenario_activo_id`.
  - Índice único `(hogar_id, ref_anio, ref_mes)`, que garantiza `YA_EXISTE`.
- **`escenario`**: `id`, `plan_id` (con CASCADE), `letra`, `creado_por`, `nota` y `archivado`. Único `(plan_id, letra)`. En esta etapa solo se crea la `A`.
- **`item_plan`**: `id`, `escenario_id` (con CASCADE), `categoria_id` (FK, sin cascada), `nombre`, `monto bigint`, `dia_vence`, `tipo` (con CHECK en FIJO, VARIABLE, CUOTA, CREDITO), `cuota_actual`, `cuota_total` y `orden`.
- **`movimiento`** crece:
  - el CHECK de `tipo` suma APORTE, PAGO y GASTO;
  - columnas nuevas: `item_id` (FK a item_plan, sin cascada, que se protege con `ITEM_CON_PAGOS`), `nota` y `origen` (con CHECK en CUENTA, EXTERNA, NINGUNO; NOT NULL, con default `NINGUNO` y backfill a `CUENTA` donde hay `cuenta_id`);
  - índice único parcial `(item_id, ref_anio, ref_mes) WHERE tipo = 'PAGO'`, que garantiza `YA_PAGADO` aunque lleguen dos a la vez. Los variables se registran como GASTO y no lo tocan, igual que en el dominio.

El estado efectivo (Borrador que pasa a Activo) se calcula al leer, como `estadoEfectivo`, sin tareas programadas. En la base solo cambia a ACTIVO o CERRADO por una acción (cerrar llega en la Etapa 6).

Alternativa descartada: guardar la opción como JSON dentro de `plan_mes`. Validar la categoría, proteger los ítems con pagos y apuntar el pago a su ítem pide filas.

### D3. Las vistas se calculan en el cliente, con el dominio compartido

El backend no calcula "Te queda libre", "Vs. plan", "Pagado", los aportes implícitos ni las vistas de las opciones. Guarda los datos y valida las escrituras. La PWA, y después la app Expo, calculan con `packages/domain` sobre lo que devuelve `GET /api/finanzas`.

- Así hay **una sola implementación** de las fórmulas de Hoy, que ya tiene tests con las cifras del handoff. El backend no las duplica en Java.
- Lo que el backend sí reproduce son las reglas de **escritura**, porque ahí decide qué se acepta:
  - `YA_PAGADO`, `MES_CERRADO`, `ITEM_NO_ENCONTRADO`, `RESERVADA`, `DUPLICADA`;
  - el avance de cuotas de `crearMes`;
  - las obligaciones de diezmo, porque "Entregado" se valida contra ellas (Etapa 3).

El mensaje de `YA_PAGADO` ("Ya lo pagó Esposa el 12 oct") usa `CalculoDiezmo.fechaCorta` y el nombre del miembro que pagó. Se lleva a un `Formato` común, porque ya no es solo del diezmo.

Alternativa descartada: un `GET /api/hoy` con el resumen calculado en Java. Duplicaría `resumenMes` y sus casos borde (variables, aportes implícitos, ajustes), y obligaría a mantener dos versiones iguales.

### D4. `GET /api/finanzas` crece, con una ventana de meses

Suma `categorias` y `planes` (con sus opciones e ítems y el `estado` efectivo), y los movimientos de todos los tipos. Planes y movimientos van desde **dos meses antes del mes en curso en adelante**:
- `planInicio` muestra dos meses recientes;
- Hoy usa el mes en curso;
- Planear y los aportes usan los meses que vienen.

El mes de un movimiento es su `ref` (un aporte para noviembre es de noviembre).

### D5. PWA: la superposición reemplaza el plan y todos los movimientos

`superponerFinanzas` pasa a reemplazar del estado de prueba:
- `categorias`;
- `planes` (todos);
- `movimientos`: todos, no solo los del mes. Lo real es la única fuente de lo registrado;
- `cierres` queda vacío: no hay cierres reales hasta la Etapa 6, y los de prueba marcarían como cerrados meses que en el backend están abiertos.

Siguen de prueba `creditos`, `anuales` y `proyecciones` (Etapas 5 y 8).

`PuertosConectados`:

| Puerto | Qué hace en modo conectado |
|---|---|
| `movimientos.marcarPago`, `registrarGasto` | Van al backend y releen las finanzas. `YA_PAGADO` relee antes de propagar el error, como `YA_RECIBIDO` |
| `movimientos.resumenMes`, `previsualizarGasto` | Siguen en el adaptador de prueba, sobre el estado superpuesto |
| `ingresos.registrarAporte` | Va al backend |
| `ingresos.entregarDiezmo` | Ya no reparte entre real y prueba: todas las obligaciones son reales |
| `plan.crearMes`, `guardarItem`, `quitarItem`, `usar` | Van al backend |
| `plan.duplicar`, `comparar` | Rechazan con `ReglaError('ETAPA_7', …)`; con una sola opción, Comparar muestra el aviso |
| `plan.crearMesesDesdeAnual` | `ETAPA_8` |
| `plan.inicio`, `mes`, `loQueTrae`, `anual`, `agregarEvento`, `editarMontoAnual` | Siguen en el adaptador de prueba, sobre el estado superpuesto |
| `cierre.vista` | Sigue en el adaptador de prueba, sobre lo real |
| `cierre.cerrar` | `ETAPA_6` |
| `cuentas.probarComoOpcion` | `ETAPA_7` |
| `hogar.categorias`, `guardarCategoria` | Van al backend |

Los ids de ítems y de opciones son los del backend (UUID). Las pantallas no cambian: la UI ya recibe esos ids en las vistas que calcula el dominio.

Las pantallas que llaman a lo bloqueado (Mes en borrador, Comparar, Plan anual, Cierre, Detalle de crédito) muestran el mensaje del `ReglaError`. Donde hoy no hay lugar para un error, se agrega el mismo aviso `role="status"` que en Cuentas.

### D6. El mes en curso y los registros

- **Pagos y gastos**: solo en el mes en curso del backend, igual que "Recibí". La PWA valida el mes antes de llamar (`MES_NO_DISPONIBLE`).
- **Aportes**: mes en curso o siguiente.
- **El plan**: cualquier mes que no esté Cerrado.

### D7. Proteger los ítems con pagos

El dominio deja quitar un ítem con pagos, y el pago queda huérfano. En el backend, la FK `movimiento.item_id` sin cascada y un chequeo previo responden `ITEM_CON_PAGOS`, para que lo pagado no desaparezca de "Pagado". Es más estricto que el dominio. La PWA muestra el mensaje en la hoja del ítem.

## Risks / Trade-offs

- **[Al conectar, el plan de prueba desaparece]** Un hogar que ya usaba la PWA conectada deja de ver el plan de ejemplo en Hoy. → Es lo correcto (spec `steward-ui-shell`), y Hoy lleva a "Mes sin plan". Queda en la guía del recorrido (tarea 5.2).
- **[La lectura crece con los meses]** `GET /api/finanzas` trae planes y movimientos desde dos meses atrás en adelante. → Para un hogar son decenas o cientos de filas. Si crece, se parte por mes o se agrega ETag (Etapa 9).
- **[Plan vs. real del cierre con datos reales y sin cerrar]** Cierre muestra la tabla real pero no cierra. → La pantalla lo avisa; la Etapa 6 completa el flujo.
- **[Cuotas de crédito sin crédito]** Pagar "Cuota libre inversión" no baja el saldo del crédito de prueba. → Los créditos siguen de prueba hasta la Etapa 5, que agrega `credito_id` al ítem.
- **[Más estricto que el dominio en `ITEM_CON_PAGOS`]** El modo demo permite lo que el conectado no. → Se documenta en la spec; si conviene, el dominio adopta la misma regla después.

## Migration Plan

1. `V3` corre al arrancar, con Flyway:
   - inserta las categorías del sistema para los hogares existentes ("Jimenez Navarro" en `steward.test`);
   - amplía `movimiento` con backfill del `origen`.
2. Desplegar con `local-deploy.ps1 -Project steward`. El VPS sigue con el backend reservado.
3. En `steward.test`, "Jimenez Navarro" no tiene planes reales: Hoy muestra "Este mes no tiene plan", y el mes se crea desde Planear.

Rollback local: restaurar la base, como en las etapas anteriores.

## Open Questions

- ¿El dominio compartido debe adoptar `ITEM_CON_PAGOS` para que demo y conectado se comporten igual? No cambia este diseño; se decide al revisar el modo demo.
