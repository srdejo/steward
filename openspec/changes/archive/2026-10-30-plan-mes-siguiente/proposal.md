## Why

Daniel empieza a ejecutar el mes siguiente a final de mes: el salario que recibe el 30 de octubre paga los gastos de noviembre. Hoy solo deja registrar en el mes del calendario, tanto en la PWA como en el backend, así que ese salario y esos pagos no tienen dónde quedar. Además, usando las hojas de la Etapa 11 salieron dos detalles: Categoría y Tipo piden casi lo mismo en la hoja del gasto, y "dejaría libre" con un monto negativo no se entiende.

## What Changes

- Hoy tiene un selector de mes entre el mes en curso y el siguiente. Todo lo que se registra en Hoy queda en el mes que se está viendo, con la fecha real.
- El backend acepta el mes en "Recibí", en pagos y en gastos: el mes en curso (por defecto) o el siguiente. Otro mes responde 400 `DATOS_INVALIDOS`.
- La hoja del gasto en Planear elige la categoría con chips y deduce el tipo. Se quitan el select de categoría y los chips de Tipo. En "Tarjetas y cuotas" aparece "¿A cuotas?", y en una categoría propia, "Cambia cada mes".
- Con saldo negativo, Planear dice "Con la Opción A faltarían $X", en rojo y sin signo.
- Los destinos principales pasan a llamarse **Ejecución**, **Plan** y **Cuentas**, en lugar de Hoy, Planear y Cuentas: con el selector, la pantalla puede mostrar un mes que no es el de hoy.

Fuera de alcance:
- Registrar en un mes anterior: sigue sin poderse desde Hoy.
- Cambiar el estado del mes siguiente: sigue en Borrador hasta que llegue su mes.
- Cuadrar, mover dinero y abonos: siguen en el mes en curso, porque no dependen del plan.
- La app Expo: solo lo mínimo para compilar; conserva sus nombres hasta la Etapa 12.
- Las rutas (`/hoy`, `/planear`) y los nombres internos: no cambian.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-hoy`: el selector de mes y el resumen del mes elegido.
- `steward-finanzas`: "Recibí", pagos y gastos aceptan el mes en curso o el siguiente.
- `steward-ui-shell`: los nombres de los destinos principales.
- `steward-planear`: la hoja del gasto con chips de categoría, el texto con saldo negativo y el acceso a Hoy desde el mes siguiente.

## Impact

- `backend/`: `FinanzasUseCase` y `FinanzasController`, DTOs de "Recibí", pagos y gastos. Sin migración: `movimiento` ya guarda el mes aparte de la fecha.
- `frontend/`: `features/hoy` (selector y hojas), `features/planear` (`gasto-plan-hoja`, `mes-page`), `core/datos/http` (`api`, `PuertosConectados`).
- `packages/domain/`: sin reglas nuevas de dinero; `marcarPago`, `registrarGasto` y `marcarRecibido` ya reciben el mes.
- Los saldos de las cuentas no cambian de regla: dependen del orden de registro, no del mes.
