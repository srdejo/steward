## Why

La app supone que la primera cuota de un crédito es la del mes en que se crea. Con "Johana", creado el 3 de noviembre de 2026 con la primera cuota en diciembre, el detalle muestra "Próxima cuota · noviembre", la tabla de próximas cuotas empieza en noviembre, la proyección baja el saldo a fin de noviembre y "Termina" queda un mes antes. Los datos guardados están bien (0 cuotas pagadas, sin pagos, cuota en los planes desde diciembre), pero no hay dónde decir en qué mes empieza a pagarse.

## What Changes

- Cada crédito tiene un campo opcional **"Primera cuota"** (mes y año). Sin él, la regla es la de hoy: la primera cuota es la del mes en curso, o la del siguiente si ya se pagó.
- Mientras el mes en curso sea anterior a la primera cuota:
  - las cuotas proyectadas, "Próxima cuota", "Próximas cuotas", la proyección de saldos, "Termina" e "Intereses en {año}" empiezan en ese mes;
  - el plan anual (`pagaEnMes`) no pone la cuota en los meses anteriores;
  - al crear el plan de un mes anterior, el crédito no trae su cuota;
  - al agregar el crédito, su cuota no entra al plan del mes en curso.
- Al llegar ese mes, el crédito se comporta como cualquier otro: el campo deja de influir.
- En la hoja de "+ Crédito" y en "Cambiar" (cómo baja el saldo), un selector "Primera cuota" con el mes en curso (por defecto) y los 12 siguientes. En la PWA y en la app.
- Backend: columna `primera_cuota` en `credito` (migración V19), en el crear, en el cambiar método y en la respuesta; `Amortizacion.pagaEnMes`, el plan del mes y el alta del crédito la respetan.
- Corrección de Johana: después de desplegar, se edita y se pone "Primera cuota: diciembre 2026". No hace falta tocar sus ítems: ya están desde diciembre.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-cuentas`: "Agregar crédito" (el selector y la cuota que no entra al mes en curso si la primera es después) y "Cómo baja el saldo de un crédito" (la primera cuota se puede cambiar desde "Cambiar"); requirement nuevo "Primera cuota de un crédito" con cómo afecta las proyecciones.
- `steward-plan-mes`: "Crear el plan de un mes" (un crédito cuya primera cuota es posterior al mes no trae su cuota).

## Impact

- **Dominio** (`packages/domain`): `model` (`Credito.primeraCuota: MesRef | null`), `rules/credito.ts` (`cuotasProyectadas`, `pagaEnMes`, `agregarCredito`, `camposMetodo`/`cambiarMetodoCredito`, `cuotasDeCreditos` en `crearMes`), `conectado/api.ts` y `puertos-conectados.ts`, `demo` (estados guardados sin el campo = null), pruebas.
- **Backend**: `Credito`, `Amortizacion.pagaEnMes`, `CuentasUseCase` (crear y cambiar método), `PlanUseCase.conCuotas`, `AnualUseCase` (vía `pagaEnMes`), `CreditoR2dbcAdapter`, `FinanzasDtos`, migración `V19__credito_primera_cuota.sql`, pruebas y contrato AOT.
- **PWA**: `features/cuentas/metodo-hoja.ts` (selector).
- **App**: `components/metodo-credito.tsx` (selector); nueva versión de la app (2.3.1 o mayor) para TestFlight y App Store.
- Sin cambios de datos existentes: la columna nace en null.
