# Proposal

## Why

Hoy el diezmo vive fuera del plan:
- al recibir un ingreso con regla se crea sola una obligación, la tarjeta "Disponible para diezmar", que se cierra con "Entregado";
- en el plan del mes, el diezmo se suma solo a lo comprometido como una fila "Calculado" que no se puede editar.

Al empezar a usar Steward en producción (2026-10-29), Daniel lo planteó así: el diezmo **se presupuesta como un gasto y se marca cuando se lleva**. Además, cada diezmo es independiente: el del salario de cada persona y el de cada ingreso extra son gastos distintos. Al revisarlo, también pidió que **todo en el plan se pueda editar, también los ingresos**: el plan es un cuaderno en blanco donde cada opción del mes supone sus propios ingresos.

Va antes que la app móvil conectada (Etapa 11), para que esa app nazca con el modelo nuevo y no se haga dos veces.

## What Changes

- **Diezmo como ítems del plan.** Una categoría del sistema "Diezmo" y un tipo de ítem `DIEZMO`, enlazado al ingreso que lo origina:
  - al crear el plan de un mes (`COPIAR`, `FIJOS` o `CERO`), un ítem "Diezmo · {ingreso}" por cada ingreso fijo activo cuyo dueño tiene regla activa, con el monto sugerido por la regla (porcentaje sobre el bruto o el neto). No se copia del mes anterior: se calcula de nuevo;
  - al registrar un aporte con "Aplicar diezmo", su propio ítem "Diezmo · aporte {fecha}" en el plan de ese mes (si el mes no tiene plan, lo gana al crearlo);
  - por cada evento de ingreso del plan anual del mes con dueño que tiene regla, también su ítem ("Diezmo · Prima").

  Cada ítem se edita, se quita y se marca con "Marcar pago" (desde una cuenta) como cualquier gasto, y cuenta en el cuadre de esa cuenta.
- **Ingresos como líneas de cada opción.** Cada opción del mes tiene sus propias líneas de ingreso:
  - nacen de Ajustes (una por ingreso fijo, con su neto) y del plan anual (una por prima o evento de ingreso del mes);
  - se editan, se quitan y se agregan a mano ("+ Ingreso") en Planear, sin tocar Ajustes ni las otras opciones;
  - Hoy muestra las de la opción en uso, y "Recibí" confirma o cambia el monto que llegó;
  - al crear un mes, las de Ajustes y del anual se calculan de nuevo, y las agregadas a mano se copian con `COPIAR` y `FIJOS`.
- **Se quita lo automático (BREAKING en la API):**
  - las obligaciones de diezmo, la tarjeta "Disponible para diezmar" y "Entregado" (`GET /api/diezmo/pendientes` y `POST /api/diezmo/entregas`);
  - el ajuste "Diezmo en Hoy" (`PUT /api/hogar/diezmo-en-hoy` y el campo `diezmoEnHoy` de las finanzas);
  - la fila "Diezmo · Calculado" del plan del mes, de comparar opciones y del cierre, y el diezmo sumado solo a lo comprometido de Hoy.
- **Se conserva:**
  - la regla de diezmo de cada persona, ahora para sugerir el monto, y su "aplica a aportes" como valor inicial de "Aplicar diezmo";
  - la fila "Diezmo" calculada del plan anual y su KPI "diezmo del año";
  - la lectura de las entregas ya registradas (`DIEZMO_ENTREGADO`), como historia: siguen restando de su cuenta y cuentan como gasto sin ítem de su mes.
- **Migración de datos:** a los planes no cerrados del mes en curso en adelante se les agregan sus ítems de diezmo, salvo los que ya tengan una entrega registrada, y a todos los planes no cerrados, sus líneas de ingreso.
- **App Expo (`mobile/`):** usa el mismo dominio con datos de prueba; se ajusta lo mínimo para que siga compilando y sus pruebas pasen (sin la tarjeta). Conectarla al backend es la Etapa 11.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-plan-mes`: la categoría del sistema "Diezmo"; los ítems de diezmo al crear el plan y al aportar; las líneas de ingreso de cada opción, al crear el mes y al duplicar.
- `steward-finanzas`: recibir es sobre una línea de ingreso, con monto opcional, y ya no genera obligación; se quitan "Obligaciones de diezmo", "Entregar el diezmo" y "Diezmo en Hoy"; el aporte con diezmo agrega su ítem; la lectura de las finanzas sin `diezmoEnHoy`.
- `steward-hoy`: los ingresos de Hoy son las líneas de la opción en uso; se quita "Diezmo al recibir"; los ítems de diezmo se ven y se marcan como los demás; el aporte con diezmo.
- `steward-planear`: los ingresos de cada opción se editan; el diezmo deja de ser una fila calculada y bloqueada en las opciones; crear meses desde el anual trae los ítems de diezmo.
- `steward-plan-anual`: "Crear los meses desde el plan anual" agrega las líneas de ingreso y los ítems de diezmo.
- `steward-ajustes`: sin "Diezmo en Hoy"; "Diezmo" aparece como categoría del sistema, no editable.
- `steward-ui-shell`: sin "Diezmo en Hoy" ni la tarjeta en lo que viene del backend y en la fidelidad al diseño.

## Impact

- **`packages/domain`:** modelo (`TipoItem`, `TipoCategoria`, enlaces del ítem, líneas de ingreso de la opción; sin `diezmoEnHoy`), `ingresosDelMes`, `marcarRecibido`,, `crearMes`, `registrarAporte`, `crearMesesDesdeAnual`, `resumenMes`, `vistaOpcion`/`compararOpciones`, cierre; se quitan `diezmosPendientes`, `entregarDiezmo` y `definirDiezmoEnHoy` del dominio y de los puertos; datos de prueba.
- **`backend/`:** migración `V8` (categoría y tipo de ítem, enlaces, sin `diezmo_en_hoy`, ítems para los planes abiertos, tabla `ingreso_plan` y sus líneas); `PlanUseCase` (con las líneas de ingreso y sus endpoints, y recibir una línea), `AnualUseCase`, `FinanzasUseCase`; se quitan tres endpoints; contrato y docs.
- **`frontend/`:** Hoy (líneas de ingreso y "Recibí" con monto), aporte, Planear (opciones con ingresos editables, comparar, cierre), Ajustes, adaptador HTTP.
- **`mobile/`:** Hoy y aporte, lo mínimo (Etapa 11 la conecta).
- **Producción:** un deploy con migración, con `deploy.ps1 -Action Backup` antes.
