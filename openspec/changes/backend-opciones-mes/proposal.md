# Proposal

## Why

Con la Etapa 6, todo el mes es real: el plan, lo registrado y el cierre. Pero cada mes tiene una sola opción:
- "+ Duplicar" avisa que llega en una próxima versión;
- Comparar no tiene qué comparar;
- "Probarlo como opción" de un crédito no crea nada.

El diseño propone planear el mes siguiente con varias opciones (A, B, C…), compararlas lado a lado y quedarse con una. Esta es la Etapa 7 del ROADMAP.

Criterio de cierre: dos personas proponen opciones distintas para noviembre (una duplicando y otra probando un abono a un crédito), las comparan lado a lado con las mismas cifras, y "Usar {X}" deja esa como el plan de noviembre y archiva las demás.

## What Changes

- **Varias opciones solo en meses en Borrador** (decisión de Daniel):
  - "+ Duplicar", "Probarlo como opción" y cambiar de opción con "Usar {X}" solo valen mientras el mes sigue en Borrador: un mes futuro, o el mes en curso antes de elegir opción.
  - Un mes Activo se sigue editando en su opción en uso, pero no gana opciones ni cambia de opción. Así los pagos ya hechos siempre quedan contra la opción que se ejecuta.
  - Responde `MES_NO_BORRADOR`, y el dominio compartido cambia igual, para que demo y conectado den lo mismo.
- **Backend, en la capacidad `steward-plan-mes`:**
  - **Duplicar una opción**: la copia con la siguiente letra libre, propuesta por quien la crea, con los mismos ítems sin avanzar cuotas, como `duplicarEscenario`.
  - **Probar un abono como opción**: si el mes no tiene plan, lo crea copiando el anterior. Luego duplica la opción principal y le agrega "Abono extra {crédito}" en Créditos, enlazado al crédito, como `probarAbonoComoOpcion`.
  - **"Usar {X}"** con varias opciones: esa queda como el plan del mes y las demás se archivan, no se borran.
  - **Quitar una opción** que ya no sirve (pedido de Daniel al revisar la propuesta): se borra con sus ítems, en Borrador, si no es la última vigente, no es la que está en uso y no tiene pagos ni gastos.
- **Las vistas siguen en el dominio compartido.** "Dejaría libre", Comparar con las filas que cambian y el autor de cada opción los calcula la PWA con `vistasOpciones` y `compararOpciones` sobre los datos reales.
- **PWA en modo conectado:**
  - "+ Duplicar", "Probarlo como opción", "Usar {X}" y "Quitar opción" van al backend;
  - Comparar muestra las opciones reales lado a lado;
  - desaparecen los avisos de "llega en una próxima versión" de la Etapa 7. Solo queda el de "Crear meses desde este plan" (Etapa 8).
- **Sin migración.** El esquema ya admite varias opciones por mes desde la Etapa 4.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-plan-mes`:
  - nuevos: "Duplicar una opción", "Quitar una opción" y "Probar un abono como opción";
  - "Usar la opción y estados del mes" admite varias opciones y la regla de Borrador.
- `steward-planear`: "Mes en borrador con escenarios" y "Comparar escenarios" en modo conectado.
- `steward-cuentas`: "Detalle de crédito con simulador": "Probarlo como opción" en modo conectado.
- `steward-ui-shell`: en modo conectado vienen del backend los planes con todas sus opciones.

## Impact

- **`packages/domain`**:
  - `duplicarEscenario`, `usarEscenario` y `probarAbonoComoOpcion` reciben la fecha de hoy y responden `MES_NO_BORRADOR` fuera de Borrador;
  - `quitarEscenario` nuevo, y `PlanPort.quitarOpcion`;
  - el adaptador de prueba les pasa `hoy()`;
  - tests.
- **`backend/`**:
  - `PlanUseCase` con duplicar, quitar una opción y probar un abono;
  - `usar` con la regla de Borrador;
  - el puerto de planes gana `crearEscenario` y `quitarEscenario`;
  - endpoints nuevos;
  - contrato nuevo, también en modo AOT.
- **`frontend/`**:
  - `PuertosConectados.plan.duplicar`, `plan.quitarOpcion` y `cuentas.probarComoOpcion` al backend;
  - "Quitar opción" en Mes en borrador, con su confirmación, también en modo demo;
  - fuera los rechazos `ETAPA_7` y los avisos de Comparar y de "+ Duplicar".
- **API nueva**:
  - `POST /api/planes/{id}/escenarios` y `DELETE /api/planes/{id}/escenarios/{escenarioId}`;
  - `POST /api/creditos/{id}/probar`.
- **Sin cambios** en `infra/`, el despliegue ni la app Expo (usa el adaptador de prueba del dominio).
