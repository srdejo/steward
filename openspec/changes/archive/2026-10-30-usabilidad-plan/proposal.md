# Proposal

## Why

Al usar Steward en el teléfono después de la Etapa 10 (2026-10-30), Daniel encontró que el plan "sirve, pero no es claro". La revisión en `steward.test` mostró por qué:
- el mes en curso solo se lee en Planear;
- no se puede borrar un plan, un gasto del plan ni un registro hecho por error;
- los montos se guardan solos al salir del campo, sin aviso, y se pierden si no se sale bien;
- el diezmo no sigue al ingreso cuando este cambia.

Esta etapa va antes de la app móvil conectada (ahora Etapa 12), para que esa app nazca con un plan usable.

## What Changes

- **Editar el mes en curso.** Un mes Activo se edita en Planear como un Borrador (ingresos, gastos y diezmos), sin varias opciones. Solo un mes Cerrado queda en solo lectura.
- **Hojas con "Guardar".**
  - Tocar un ingreso o un gasto del plan abre una hoja con todos sus campos (nombre, monto, categoría, tipo, día) y "Guardar", y al guardar se ve "Guardado".
  - "Quitar" pide confirmación.
  - "+ Gasto" y "+ Ingreso" abren la misma hoja, con monto.
  - Se quitan los campos que guardan al salir.
- **Corregir o borrar un registro.** Desde Hoy, cualquier pago, gasto, ingreso recibido o aporte se abre en una hoja para cambiar su monto, su cuenta o su nota, o para borrarlo con confirmación.
  - El ítem vuelve a Por pagar.
  - El saldo estimado de la cuenta se restituye, salvo lo que ya quedó en un cuadre.
  - El saldo de un crédito se restituye si su pago registró cuánto bajó.
- **Borrar el plan de un mes.** "Borrar plan de {mes}" (con confirmación que dice cuántos pagos, gastos e ingresos recibidos se borran) deja el mes "Sin plan" para volver a crearlo, también si está cerrado (se borra su cierre).
- **Empezar de nuevo.** En Ajustes, borra todos los planes, cierres, planes anuales y lo registrado del hogar. Conserva miembros, ingresos fijos, reglas, categorías, cuentas y créditos, con el saldo que tienen hoy.
- **El diezmo sigue al ingreso.**
  - Cada ítem de diezmo de una línea de ingreso queda enlazado a esa línea y se recalcula solo cuando cambia su monto.
  - Si se editó a mano, se marca "ajustado a mano" y ofrece "Volver a calcular".
  - Un diezmo ya pagado no cambia.
  - Cambiar un ingreso fijo en Ajustes actualiza las líneas que todavía tenían el valor anterior en los meses abiertos desde el mes en curso, y con ellas sus diezmos.
  - "+ Ingreso" trae "Aplicar diezmo".
- **Claridad:**
  - el diezmo en Hoy dice "Del {ingreso} · día N" en vez de "Venció" en rojo;
  - las categorías de Planear muestran que se abren;
  - cada cuenta muestra sus movimientos desde el último cuadre;
  - Ajustes oculta "Face ID al abrir" y "Ocultar montos" hasta que funcionen (Etapa 13).
- **App Expo (`mobile/`):** solo lo mínimo para que compile y sus pruebas pasen con el dominio nuevo.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-plan-mes`: borrar el plan de un mes; empezar de nuevo; el diezmo que sigue a su línea de ingreso; editar el mes en curso.
- `steward-finanzas`: corregir y borrar registros; un ingreso fijo editado actualiza los meses abiertos; registros en un mes cerrado.
- `steward-hoy`: abrir un registro de Ya pagado para corregirlo o borrarlo; el diezmo sin "Venció"; marcar un pago.
- `steward-planear`: editar en hojas con "Guardar"; el mes en curso editable; borrar el plan del mes.
- `steward-cuentas`: los movimientos de una cuenta.
- `steward-ajustes`: "Empezar de nuevo"; seguridad y privacidad sin lo que aún no funciona.

## Impact

- **`packages/domain`:**
  - `ItemPlan` con `ingresoPlanId` y `ajustadoAMano`; `IngresoPlan` con `bruto`;
  - reglas `borrarPlan`, `empezarDeNuevo`, `corregirRegistro`, `borrarRegistro`, `recalcularDiezmo`;
  - `guardarIngresoPlan` y `guardarIngresoFijo` propagan al diezmo;
  - puertos nuevos y datos de prueba.
- **`backend/`:**
  - migración `V9` (enlace del diezmo a su línea, `ajustado_a_mano`, `bruto` de la línea, `capital` del movimiento);
  - endpoints para borrar un plan, empezar de nuevo, corregir y borrar un registro, y volver a calcular un diezmo;
  - contrato.
- **`frontend/`:** hojas de ingreso y gasto, Planear del mes en curso, hoja del registro en Hoy, detalle de cuenta, Ajustes.
- **`mobile/`:** lo mínimo para compilar.
- **Producción:** un deploy con migración aditiva (backup antes, con confirmación de Daniel).
- **Orden:** depende de que `diezmo-como-gasto` se archive antes, para que las specs principales ya tengan el diezmo como gasto.
