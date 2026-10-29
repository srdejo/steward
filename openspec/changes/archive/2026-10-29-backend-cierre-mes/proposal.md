# Proposal

## Why

Con la Etapa 5, todo lo que se registra en el mes es real y compartido. Pero el mes nunca termina:
- "Cerrar {mes}" avisa que llega en una próxima versión;
- un mes pasado sigue admitiendo pagos y gastos;
- lo que sobró no pasa al mes siguiente.

El Cierre ya muestra el plan vs. real con los datos reales, porque lo calcula el dominio en la PWA. Lo que falta es guardar el cierre en el backend.

Esta es la Etapa 6 del ROADMAP.

Criterio de cierre: una persona cierra el mes repartiendo el sobrante entre ahorro y el mes siguiente; las dos ven el mes Cerrado, en solo lectura, con el reparto, y el mes siguiente muestra el ingreso "Sobrante de {mes}".

## What Changes

- **Backend: cerrar el mes**, en la capacidad `steward-plan-mes`:
  - **"Cerrar {mes}"** guarda la foto del cierre que manda la PWA: las filas plan vs. real, "Sin registrar", el sobrante, lo que va a ahorro y lo que pasa al mes siguiente, quién cerró y cuándo.
  - **Validaciones del backend:**
    - el reparto suma el sobrante;
    - "Sin registrar" coincide con los ajustes de cuadre del mes;
    - la foto se calculó con lo último registrado. Si alguien registró algo después, responde `CIERRE_DESACTUALIZADO` y la PWA recalcula.
  - **Qué meses se cierran:** el mes en curso o uno anterior, una sola vez. Un mes futuro no se cierra, y cerrar no se deshace.
  - **Mes cerrado:** el plan pasa a Cerrado y queda en solo lectura, aunque el mes no tuviera plan.
- **Backend: los registros respetan el mes cerrado**, en `steward-finanzas`:
  - "Recibí" y "Entregado" también responden `MES_CERRADO`, como en el dominio; pagos, gastos y aportes ya lo hacían.
  - Cuadrar, mover dinero y los abonos no se bloquean: son de las cuentas, no del plan.
  - La lectura de finanzas trae los cierres, incluido el del mes anterior a la ventana, para el "Sobrante de {mes}".
- **Las cifras siguen en el dominio compartido.** El sobrante, las filas y el "Sobrante de {mes}" los calcula la PWA con `vistaCierre` e `ingresosDelMes`, como en la Etapa 4 (D3). El backend no los recalcula: valida la foto y la guarda.
- **PWA en modo conectado:**
  - "Cerrar {mes}" va al backend;
  - los cierres reales se superponen, así que un mes cerrado muestra lo guardado y el siguiente trae su sobrante;
  - sigue de prueba solo el plan anual.
- **Migración Flyway `V6`:** tabla `cierre_mes`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-plan-mes`:
  - nuevo: "Cerrar el mes";
  - "Usar la opción y estados del mes" deja de decir que cerrar llega después, y un mes cerrado sin plan también es de solo lectura.
- `steward-finanzas`:
  - nuevo: "Registros en un mes cerrado";
  - "Finanzas del hogar en una lectura" incluye los cierres.
- `steward-planear`: en modo conectado, "Cerrar {mes}" va al backend.
- `steward-ui-shell`: la lista de lo que sigue con el adaptador de prueba en modo conectado.

## Impact

- **`backend/`**:
  - migración `V6__cierre_mes.sql`;
  - modelo, puerto y adaptador de cierre;
  - `CierreUseCase` y `POST /api/cierres`;
  - `FinanzasUseCase` (lectura y `MES_CERRADO` en recibir y entregar);
  - `PlanUseCase`, que considera el cierre al ver si un mes está cerrado;
  - contrato nuevo, también en modo AOT.
- **`frontend/`**:
  - `PuertosConectados.cierre`;
  - la superposición de los cierres;
  - el manejo de `CIERRE_DESACTUALIZADO` en la pantalla de Cierre.
- **`packages/domain`**: sin cambios de reglas.
- **API nueva**: `POST /api/cierres`.
- **Sin cambios** en `infra/`, el despliegue ni la app Expo.
