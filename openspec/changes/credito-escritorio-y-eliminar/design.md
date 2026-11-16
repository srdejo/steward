# Design

## Context

- **PWA:** `credito-page.ts` es una sola columna. La ruta `cuentas/credito/:id` no tiene `data.ancho`, así que el shell la limita a 560 px.
- **Vista:** `vistaCredito` ya da todo lo que muestra el detalle: saldo, método, progreso, cuotas que faltan, el mes en que termina, las próximas cuotas y los intereses del año siguiente.
- **Backend:** el crédito vive en la tabla `credito`. Lo apuntan `movimiento.credito_id` (cuotas y abonos) e `item_plan.credito_id`, con FK diferidas sin `ON DELETE`, así que hay que soltarlas antes de borrarlo.
- **Pagos del crédito:** salen de sus movimientos. Al soltarlos, el crédito borrado ya no tiene pagos, y el historial de cada cuenta los sigue mostrando.

## Goals / Non-Goals

**Goals:**
- Que el detalle de escritorio use el ancho.
- Eliminar un crédito sin perder lo registrado.

**Non-Goals:**
- Archivar o "dar por pagado" un crédito: eliminarlo basta por ahora.
- Deshacer la eliminación.

## Decisions

### D1. Qué se borra y qué se conserva

`eliminarCredito(estado, { creditoId, fecha })` en el dominio y `CreditoR2dbcAdapter.eliminar(id, desde)` en el backend hacen lo mismo:
1. **Movimientos:** quedan con `creditoId = null`.
2. **Ítems que se quitan:** los enlazados al crédito en los planes con `ref ≥ mes de fecha` y estado distinto de `CERRADO`, si no tienen movimientos (`PAGO` o `GASTO`) que apunten a ellos.
3. **Ítems que se quedan:** los demás enlazados quedan con `creditoId = null`. Así un mes cerrado o una cuota pagada no cambia sus cifras.
4. **Crédito:** se borra.

En el backend, los cuatro pasos van en una transacción (`ITransaccionPort`), con sentencias SQL directas sobre las tablas.

### D2. Confirmación

- **Componentes:** la hoja (PWA) o la alerta (app) toma el nombre y el número de pagos de `VistaCredito`.
- **Texto:**
  - título: "¿Eliminar {nombre}?";
  - "Sale de Créditos y su cuota sale del plan de {mes en curso} en adelante.";
  - "Se conservan los N pagos registrados, en el historial de las cuentas.";
  - "Si la cuota de este mes ya tiene un pago, se queda en el plan."
- **Al confirmar:** `cuentas.eliminarCredito(id)` y navega a `/cuentas?pestana=creditos`.

### D3. Escritorio

- **Ruta:** `cuentas/credito/:id` pasa a `data.ancho: 'escritorio'`.
- **Vista:** `credito-page.ts` lee `anchoEscritorio()` y, desde 1024 px, arma el artboard `CreditoWeb` con las mismas secciones y señales que la vista móvil. Las hojas (método, corregir saldo, abono, eliminar) no cambian.
- **Desde de cada pago:** sale del movimiento de cada pago, con `VistaCredito.pagos` extendido con la cuenta de origen. Si no hay movimiento, no se muestra.

## Risks / Trade-offs

- **[Riesgo] Eliminar por error.** → La hoja de confirmación dice lo que pasa, y lo registrado se conserva. El crédito se puede volver a agregar.
- **[Trade-off] Ítems sin enlace en meses pasados.** → Conservan nombre y monto. Solo pierden el "cuota N de M", que sale del crédito.
