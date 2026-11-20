## Why

Internet, agua, luz y gas se pagan cada mes en el portal de cada empresa con un código de usuario o referencia. Hoy esos datos viven fuera de Steward, así que al pagar hay que buscarlos aparte. Como cada mes planeado tiene su propia copia de cada gasto, guardar el dato en un solo mes no basta: tiene que llegar a los meses ya planeados y a los que se creen después, sin complicar a quien no lo use.

## What Changes

- Cada gasto del plan puede tener, opcionalmente, **datos de pago**: un **enlace de pago** (http o https) y un **código de usuario o referencia**. Los gastos de diezmo no los tienen.
- En la hoja del gasto (Planear, en la PWA y en la app), una sección plegada **"Datos de pago (opcional)"**. Cerrada por defecto si el gasto no tiene datos; quien no la abre no ve ningún cambio. Indica que no se guarden contraseñas.
- Al guardar con datos de pago cambiados, la casilla **"Aplicar también a los meses ya planeados"** (marcada por defecto) los lleva a los gastos con el mismo nombre y categoría de las otras opciones del mes y de los meses posteriores que no estén cerrados, y a los mes base del plan anual de ese año en adelante.
- Los datos de pago se copian al crear un mes (Copiar el anterior, Solo fijos) y al crear los meses desde el plan anual (mes base o mes replicado). Los gastos del mes base también los tienen.
- En **Hoy**, solo los gastos con enlace muestran un "Pagar ↗" que abre el portal en otra pestaña o en el navegador. En **Marcar pago**, el enlace y el código con un botón **Copiar**. Los gastos sin datos se ven igual que ahora.
- Backend: migración V20 con `enlace_pago` y `codigo_pago` en `item_plan` y `anual_base_item`; el ítem los recibe y devuelve; nuevo campo `aplicarAMeses` al editar. Sin el campo, un PUT conserva los datos guardados (la app 2.3.1 no los conoce y no los borra).
- App: versión 2.3.2.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-plan-mes`: requirement nuevo "Datos de pago de un gasto" (campos, validación, copia al crear el mes y aplicar a los meses planeados).
- `steward-plan-anual`: requirement nuevo "Datos de pago en el mes base" (el mes base los guarda y los meses creados desde el plan anual los traen).
- `steward-hoy`: requirement nuevo "Pagar en línea desde Hoy" ("Pagar ↗" y el código con Copiar en Marcar pago).

## Impact

- **Dominio** (`packages/domain`): `ItemPlan.enlacePago` y `codigoPago` (opcionales), `guardarItem` (validación y `aplicarAMeses`), `copiarItems` (ya copia el ítem completo), mes base del anual, `conectado/api.ts` y `puertos-conectados.ts`, pruebas.
- **Backend**: `V20__gastos_datos_pago.sql`, `PlanMes.ItemPlan`, `PlanDtos.ItemRequest`/`ItemResponse`, `PlanUseCase` (guardar ítem y crear mes), `AnualUseCase` (mes base y meses creados), `PlanR2dbcAdapter`, `AnualR2dbcAdapter`, pruebas y contrato AOT.
- **PWA**: `features/planear/gasto-plan-hoja.ts`, el mes base anual (`anual-base-page.ts`), `features/hoy` (fila de Por pagar y `pagar-hoja.ts`), escritorio de Hoy.
- **App**: `components/hojas-plan.tsx`, Hoy y Marcar pago; versión 2.3.2 en TestFlight y App Store.
- Sin cambios de datos existentes: las columnas nacen en null.
