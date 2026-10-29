# Proposal

## Why

Con la Etapa 3, los ingresos, el diezmo y las cuentas ya viven en el backend. Pero el plan del mes y lo que se registra en Hoy (pagos, gastos y aportes) siguen en el dispositivo de cada persona: lo que paga una no lo ve la otra. Esta es la Etapa 4 del ROADMAP y cierra el objetivo actual (dos miembros comparten un plan del mes).

Criterio de cierre: con un plan activo de un escenario, se marca un pago, se registra un aporte y un gasto, y "Te queda libre" y "Vs. plan" cuadran con lo registrado.

## What Changes

- **Backend: el plan del mes**, en una capacidad nueva, `steward-plan-mes`:
  - **Categorías del hogar**: las cuatro del sistema (Gastos fijos, Tarjetas y cuotas, Variables, Créditos) nacen con cada hogar, y los hogares que ya existen las reciben en la migración. "+ Nueva" y renombrar, con las reglas del dominio (el diezmo no es categoría, sin nombres repetidos).
  - **Crear el mes** en Borrador con la Opción A: "Copiar mes anterior", "Solo fijos e ingresos" o "Desde cero". Las cuotas avanzan y las terminadas no se copian.
  - **Ítems de la Opción A**: agregar, editar y quitar. Un ítem con pagos en el mes no se quita.
  - **"Usar opción A"** deja el mes listo para activarse al llegar. Borrador pasa a Activo al iniciar el mes, como en el dominio.
  - **Mes Cerrado**: no admite cambios ni registros. Cerrar el mes llega en la Etapa 6.
- **Backend: lo que se registra en Hoy**, en la capacidad `steward-finanzas`:
  - **Marcar pago** de un ítem del plan del mes en curso, con quién pagó y desde dónde: una cuenta del hogar, "Su cuenta" (externa) o sin cuenta. Un fijo ya pagado responde "Ya lo pagó {nombre} el {dd mmm}". Un ítem variable acumula como gasto.
  - **Registrar gasto** contra un ítem o "No estaba planeado", con nota.
  - **Registrar aporte**: quién, cuánto, para este mes o el siguiente, cuenta destino opcional y "Aplicar diezmo". Un aporte con diezmo genera su obligación, como en el dominio.
  - **Lectura de las finanzas**: crece con categorías, planes y los movimientos de los meses que muestra la app.
- **Las vistas siguen en el dominio compartido.** El backend guarda y valida. "Te queda libre", "Vs. plan", los aportes implícitos y los totales los calcula la PWA con las reglas de `packages/domain` sobre los datos reales, igual que en la Etapa 3.
- **PWA en modo conectado:**
  - Hoy (Marcar pago, + Aporte, Registrar gasto), Planear (crear el mes, editar la Opción A, "Usar opción A") y las categorías de Ajustes van contra el backend.
  - Lo que no entra todavía avisa en qué etapa llega, sin cambiar nada: "+ Duplicar" y Comparar (Etapa 7), "Cerrar {mes}" (Etapa 6), "Crear meses desde este plan" (Etapa 8), y "Probarlo como opción" de un crédito (Etapas 5 y 7).
- **Sigue con datos de prueba:** créditos, plan anual y cierre. El aviso "Datos de prueba" se mantiene.
- **Al conectar, el plan de prueba desaparece.** En modo conectado, Hoy y Planear muestran solo los planes reales. Un hogar sin plan del mes en curso ve "Mes sin plan" y lo crea ("Desde cero" o "Solo fijos e ingresos").
- **Migración Flyway `V3`**: tablas de categoría, plan, escenario e ítem. `movimiento` gana los tipos PAGO, GASTO y APORTE, el ítem, la nota y el origen.

## Capabilities

### New Capabilities
- `steward-plan-mes`: categorías del hogar, el plan de cada mes con su Opción A, sus ítems y sus estados (Borrador, Activo, Cerrado) en el backend, con el aislamiento entre hogares.

### Modified Capabilities
- `steward-finanzas`:
  - nuevos: marcar pago, registrar gasto y registrar aporte;
  - "Obligaciones de diezmo" incluye los aportes con diezmo;
  - "Finanzas del hogar en una lectura" incluye categorías, planes y movimientos de más meses.
- `steward-hoy`: en modo conectado, + Aporte, Marcar pago y Registrar gasto van al backend, y el diezmo de los aportes también.
- `steward-planear`: en modo conectado, crear el mes, editar la Opción A y usarla van al backend. Duplicar, Comparar, Cerrar y "Crear meses desde este plan" avisan en qué etapa llegan.
- `steward-ajustes`: en modo conectado, las categorías son del backend.
- `steward-cuentas`: en modo conectado, "Probarlo como opción" de un crédito avisa que llega después.
- `steward-ui-shell`: la lista de lo que sigue con el adaptador de prueba en modo conectado.

## Impact

- **`backend/`**:
  - migración `V3__plan_mes.sql`;
  - modelos, puertos y adaptadores de categoría, plan, escenario e ítem;
  - `PlanUseCase`, junto con lo nuevo de `FinanzasUseCase` (pago, gasto, aporte);
  - `PlanController` y los endpoints nuevos de finanzas;
  - las categorías al crear un hogar (`HogarUseCase`);
  - contrato nuevo, también en modo AOT.
- **`frontend/`**:
  - `PuertosConectados` conecta `plan` y `movimientos` y las categorías de `hogar`, y la superposición crece;
  - los avisos de Etapa 6, 7 y 8 en Planear y en el detalle de crédito.
- **`packages/domain`**: sin cambios de reglas. El backend reproduce `crearMes`, `guardarItem`, `marcarPago`, `registrarGasto`, `registrarAporte` y `guardarCategoria`.
- **API nueva**:
  - `POST /api/categorias` y `PATCH /api/categorias/{id}`;
  - `POST /api/planes` y `POST /api/planes/{id}/usar`;
  - `POST /api/planes/{id}/escenarios/{escenarioId}/items`, y `PUT` y `DELETE` sobre `.../items/{itemId}`;
  - `POST /api/pagos`, `POST /api/gastos` y `POST /api/aportes`.
- **Sin cambios** en `infra/`, el despliegue ni la app Expo.
