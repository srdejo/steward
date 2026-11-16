# Proposal

## Why

- **Escritorio:** el detalle de un crédito en la web es la columna móvil de 560 px. Desde 1024 px queda mucho espacio vacío y la tabla de cuotas se ve corta.
- **Eliminar:** un crédito no se puede eliminar. Si el hogar lo pagó por fuera, lo trasladó o lo agregó por error, se queda para siempre en Créditos, en "Deben en créditos" y en el plan de cada mes.

Fuente: canvas *Presupuesto Hogar v3*, artboards `CreditoWeb` ("Detalle de crédito y eliminar (web)", nuevo) y `Credito` (móvil, con "Eliminar crédito" al final).

## What Changes

- **Detalle de crédito en escritorio** (desde 1024 px, `CreditoWeb`):
  - **Encabezado:** entidad, nombre, saldo y fecha del saldo, con "Corregir con extracto" y "Registrar abono" a la derecha.
  - **Cuatro indicadores:**
    - Cuota y día de pago;
    - Pagado, con la barra y "cuota N de M";
    - Termina, con las cuotas que faltan;
    - Intereses del año siguiente.
  - **Próximas cuotas:** 12, con una barra de capital e interés por cuota.
  - **Últimos pagos:** con la cuenta de donde salió cada uno.
  - **Al lado:**
    - cómo baja el saldo, con "Cambiar";
    - el simulador de abono extra;
    - "¿Ya no lo tienen?", con "Eliminar crédito".
- **Eliminar crédito**, en la web y en la app:
  - **Confirmación:** una hoja dice qué pasa.
  - **Qué se borra:** el crédito sale de Créditos. Su cuota sale del plan del mes en curso y de los siguientes que no estén cerrados, salvo la cuota que ya tenga un pago.
  - **Qué se conserva:** los pagos y abonos registrados quedan en el historial, sin crédito. Los ítems de meses cerrados o con pagos se quedan, sin enlace.
  - **Backend:** `DELETE /api/creditos/{id}`. Un crédito de otro hogar responde 404.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- **`steward-cuentas`:** nuevos requisitos "Detalle de crédito en escritorio" y "Eliminar un crédito".
- **`steward-finanzas`:** nuevo requisito "Eliminar un crédito del hogar" (backend).
- **`steward-mobile-app`:** la app sale como 2.2.1 en TestFlight.

## Impact

- **Dominio:**
  - `eliminarCredito` en `rules/credito.ts`;
  - `CuentasPort.eliminarCredito`, en demo y en conectado;
  - `api.eliminarCredito`.
- **Backend:**
  - `ICuentasServicePort.eliminarCredito`;
  - `ICreditoPersistencePort.eliminar`, que suelta los movimientos, quita las cuotas sin pagos de los meses abiertos y borra el crédito;
  - `DELETE /api/creditos/{id}`;
  - pruebas de contrato.
- **PWA:** `credito-page.ts` con la vista de escritorio (`data.ancho: 'escritorio'`) y la hoja "Eliminar crédito".
- **App:** `credito/[id].tsx` con "Eliminar crédito". Versión 2.2.1 (`app.json` y `AGENTS.md`).
