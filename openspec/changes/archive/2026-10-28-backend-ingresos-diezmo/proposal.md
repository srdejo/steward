# Proposal

## Why

Con la Etapa 2, el hogar, sus miembros y las invitaciones ya viven en el backend. Pero lo que define el presupuesto de cada persona sigue en el dispositivo:
- su regla de diezmo;
- sus ingresos fijos;
- sus cuentas;
- el diezmo que se genera al recibir un ingreso.

Así, el onboarding solo guarda de verdad los pasos 1 y 5, y lo que uno configura no lo ve el otro miembro. Esta es la Etapa 3 del ROADMAP. Su criterio de cierre: un hogar nuevo completa los 5 pasos del onboarding y, al marcar el salario como recibido, aparece la obligación de diezmo calculada según su regla.

## What Changes

- **Backend: ingresos y diezmo**, en una capacidad nueva, `steward-finanzas`:
  - **Regla de diezmo por persona**: activa, porcentaje, base Bruto o Neto, y si aplica a los aportes. Cada quien ve y edita solo la suya.
  - **Ingresos fijos por persona**: nombre, bruto, neto, día de pago y cuenta opcional. Crear, editar y quitar solo los propios.
  - **"Recibí"**: registra el ingreso fijo del mes en curso. Si su dueño tiene la regla activa, genera la obligación de diezmo. Dos veces en el mismo mes responde `YA_RECIBIDO`.
  - **Obligaciones de diezmo pendientes del mes y "Entregado"**: entregar cierra una o varias obligaciones con un movimiento de diezmo entregado. Una obligación no se puede entregar dos veces.
  - **"Diezmo en Hoy"** (Separado o Agrupado) del hogar.
  - **Lectura de las finanzas del hogar** en una sola llamada, para la PWA.
- **Backend: cuentas básicas**: nombre, titular (yo o conjunta) y saldo aproximado, para el paso 4 del onboarding y "+ Agregar". Cuadrar, saldo estimado, mover dinero y créditos siguen para la Etapa 5.
- **Backend: cambios en el hogar** (`steward-hogar`):
  - al aceptar una invitación con "diezmar de mis aportes", la persona queda con una regla de diezmo (10 % del bruto, aplicada a los aportes), igual que en el dominio, en lugar de un flag en el miembro;
  - al salir del hogar, se desactivan los ingresos fijos de la persona en ese hogar y se quitan sus cuentas propias.
- **PWA en modo conectado**:
  - el onboarding guarda los pasos 2 a 4 en el backend;
  - Ajustes edita ingresos, regla y "Diezmo en Hoy" reales;
  - en Hoy, "Recibí", la tarjeta "Disponible para diezmar" y "Entregado" van contra el backend;
  - Cuentas lista las cuentas reales y "+ Agregar" las crea. "Cuadrar cuentas" y "Mover dinero" avisan que llegan en la Etapa 5.
- **Lo que sigue con datos de prueba**: plan, pagos, gastos, aportes, créditos y cierre. El aviso "Datos de prueba" se mantiene.
- **Migración Flyway `V2`**: tablas de regla, ingreso fijo, cuenta y movimiento. `miembro.diezmo_aportes` pasa a una regla. **BREAKING** solo para la base local: la columna se elimina después de migrarla, y en el VPS no hay datos todavía.

## Capabilities

### New Capabilities
- `steward-finanzas`: ingresos fijos, regla de diezmo, recibir y obligaciones de diezmo, entregar, "Diezmo en Hoy" y cuentas básicas en el backend, con su aislamiento por hogar. Las etapas 4 y 5 la amplían con movimientos y cuadre.

### Modified Capabilities
- `steward-hogar`:
  - "Aceptar una invitación": el diezmo sobre aportes se guarda como regla de diezmo;
  - "Salir del hogar": qué pasa con los ingresos fijos y las cuentas de quien sale.
- `steward-acceso-onboarding`: en modo conectado, los pasos 2 a 4 guardan en el backend.
- `steward-ajustes`: en modo conectado, ingresos, regla y "Diezmo en Hoy" son reales.
- `steward-hoy`: en modo conectado, "Recibí", "Disponible para diezmar" y "Entregado" son reales. Los aportes, también con diezmo, siguen de prueba hasta la Etapa 4.
- `steward-cuentas`: en modo conectado, las cuentas son reales y "+ Agregar" las crea. Cuadrar y mover todavía no están.
- `steward-ui-shell`: la lista de módulos que siguen con el adaptador de prueba en modo conectado.

## Impact

- **`backend/`**:
  - modelos, puertos, casos de uso y adaptadores R2DBC nuevos, junto con `FinanzasController`;
  - migración `V2__ingresos_diezmo.sql`;
  - contrato nuevo, también en modo AOT;
  - cambio en `InvitacionUseCase` (aceptar) y `HogarUseCase` (salir).
- **`frontend/`**:
  - `PuertosConectados` gana `ingresos` y `cuentas` conectados y una superposición de los datos reales sobre el adaptador de prueba;
  - el aviso de Etapa 5 en Cuentas.
- **`packages/domain`**: el adaptador de prueba acepta una función que superpone datos reales al leer el estado. Las reglas no cambian, y el backend reproduce sus cifras.
- **API nueva**:
  - `GET /api/finanzas`;
  - `PUT /api/regla-diezmo`;
  - `POST`, `PUT` y `DELETE /api/ingresos-fijos`;
  - `POST /api/ingresos-fijos/{id}/recibido`;
  - `GET /api/diezmo/pendientes`;
  - `POST /api/diezmo/entregas`;
  - `PUT /api/hogar/diezmo-en-hoy`;
  - `POST /api/cuentas`.
- **Sin cambios** en `infra/`, el despliegue ni la app Expo.
