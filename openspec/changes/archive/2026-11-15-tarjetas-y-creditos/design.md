# Design

## Context

- **Categorías:**
  - El dominio (`demo/seed.ts`) y el backend (`Categoria.porDefecto`, migración `V3`) crean cinco del sistema, entre ellas "Tarjetas y cuotas" (tipo `TARJETA`, #7C4DDB) y "Créditos" (`CREDITO`, #2E6B45).
  - Las tarjetas son ítems `FIJO` sueltos en `TARJETA`.
  - Las compras a cuotas son ítems `CUOTA` con `cuota: { actual, total }`. `nuevoMes` avanza `actual` y suelta el ítem al pasar de `total`.
- **Créditos:**
  - `Credito` tiene `saldo`, `cuota`, `tasaEM`, `diaPago`, `totalOriginal` y `pagos`.
  - `marcarPago` de un ítem con `creditoId` baja el saldo en cuota − saldo × EM, y guarda `capital` en el movimiento para devolverlo si se borra (`devolverCapital`).
  - `cuotasDeCreditos` agrega la cuota de cada crédito con saldo al nacer un mes.
  - `simularAbono` estima cuotas e intereses ahorrados.
  - En el backend, todo eso está en `CuentasUseCase`, `NacimientoMes` y `Registro`, con la tabla `credito` de `V5`.
- **Pantallas:**
  - La PWA tiene `cuentas-page.ts` (con las pestañas provisionales de `web-escritorio-completo`) y `credito-page.ts`.
  - La app tiene `(tabs)/cuentas.tsx` y `credito/[id].tsx`.
  - En modo conectado, la PWA y la app calculan las vistas en el dispositivo sobre las finanzas descargadas, y escriben en los endpoints.
- **Decisiones del usuario:**
  - Las tarjetas no llevan deuda.
  - El plan de pagos se calcula con el número de cuotas y la tasa efectiva anual, sin PDF.
  - Las compras a cuotas se convierten en créditos.
- **Dependencia:** este cambio parte de `web-escritorio-completo` (PR #8), que crea las pestañas y la vista de escritorio de Cuentas. Se archiva después de él.

## Goals / Non-Goals

**Goals:**
- Tarjetas con fechas y una línea del plan, con las mismas reglas en el dominio y en el backend.
- Tres métodos de crédito con una sola función de amortización compartida, y la proyección a 6 meses.
- Una sola categoría Créditos, sin perder montos en los datos reales.
- Paridad en PWA y app.

**Non-Goals:**
- La deuda de las tarjetas, sus compras e intereses.
- Leer planes de pago desde PDF o foto.
- Avisos con historia en el cierre.

## Decisions

### D1. `Tarjeta` como entidad propia, enlazada al ítem por `tarjetaId`

```ts
interface Tarjeta {
  id: Id;
  nombre: string;
  diaCorte: number;
  diaPago: number;
  uso: string;            // '' = sin uso
  pago: { tipo: 'COMPLETA'; estimado: Pesos } | { tipo: 'FIJO'; monto: Pesos };
}
```

- `ItemPlan` gana `tarjetaId: Id | null`. El ítem de una tarjeta es `tipo: 'FIJO'`, en Créditos: así Hoy, el cierre y el anual lo tratan como cualquier pago, sin un tipo nuevo.
- `estimado`, en las tarjetas que se pagan completas, es el monto del ítem para los meses nuevos. Al marcar pagado un ítem con `tarjetaId` y pago `COMPLETA`, `estimado` pasa a ser lo pagado. Por eso "el último valor pagado" no exige buscar en la historia. Si se borra ese pago, `estimado` no vuelve atrás: es solo una sugerencia para el próximo mes.
- `nuevoMes`: la plantilla copia los ítems con `tarjetaId` con el monto actual de la tarjeta (fijo o estimado), no con el del mes base. Agrega el ítem de cada tarjeta que no esté en la plantilla, como `cuotasDeCreditos`. Una tarjeta quitada ya no aporta ítem; sus ítems en meses existentes quedan sin enlace (`tarjetaId` en null).
- Agregar una tarjeta con `itemId`, un ítem de Créditos del mes en curso, enlaza ese ítem en lugar de crear otro (spec "Enlazar un ítem que ya existe").

*Alternativa descartada:* tarjeta como un tipo de `Cuenta`. Mezcla saldos (que la tarjeta no lleva) con fechas, y ensuciaría el saldo del hogar y el cuadre.

### D2. Fechas de una tarjeta, funciones puras en `rules/tarjetas.ts`

- `pagoDeCorte(fechaCorte)`: el siguiente día `diaPago` estrictamente después del corte. Es el mismo mes si `diaPago > diaCorte`; si no, el mes siguiente.
- `proximoPago(hoy)` y `proximoCorte(hoy)`: la primera fecha ≥ hoy. Si el día no existe en ese mes (31 en noviembre), se usa el último día del mes.
- `fechasTarjetas(hoy, dias = 35)`: la lista de cortes y pagos ordenada, con el valor en los pagos.
- `porPagarCiclo`: la suma del monto del próximo pago de cada tarjeta.
- Ayuda de una tarjeta que se paga completa: corte = próximo corte, pago = `pagoDeCorte(corte)` y siguiente = `pagoDeCorte(corte + 1 mes)`.
- Urgencia: ≤ 3 días alerta, ≤ 7 aviso. Son los mismos umbrales de `TonoVence`, y se reutiliza el tipo.

### D3. Créditos: método y una sola amortización

```ts
type MetodoCredito = 'TASA' | 'PLAN' | 'MANUAL';
interface Credito {
  // ...lo de hoy
  metodo: MetodoCredito;
  numeroCuotas: number | null;   // PLAN
  cuotasPagadas: number;         // PLAN (y TASA, si se conoce)
  valorFinanciado: Pesos | null; // PLAN
}
```

- `tasaEM` se guarda siempre como EM, con dos decimales, como hoy en `numeric(5,2)`. `emDeEa(ea) = ((1 + ea/100)^(1/12) − 1) × 100`, y la UI convierte la EA que se escriba.
- `cuotaFija(valor, n, em) = em === 0 ? round(valor / n) : round(valor × r / (1 − (1+r)^−n))`.
- `tabla(credito, desde, meses)` da `[{ k, interes, capital, saldo }]`, y la usan el detalle, la proyección, el pago y los intereses del año:
  - **TASA:** desde el saldo actual, interés = round(saldo × EM) y capital = min(cuota − interés, saldo).
  - **PLAN:** se recalcula la tabla completa desde `valorFinanciado` con `numeroCuotas` y la EM, y se toma desde la cuota `cuotasPagadas + 1`. Si el saldo se corrigió con el extracto y no coincide con la tabla, se amortiza desde el saldo corregido con la misma cuota y EM (igual que TASA), sin pasar de `numeroCuotas`.
  - **MANUAL:** sin tabla; el saldo es constante.
- Pago de la cuota en `marcarPago`:
  - **TASA:** como hoy.
  - **PLAN:** `cuotasPagadas += 1` y saldo = el de la fila *k* de la tabla. Se guarda `capital` = saldo anterior − saldo nuevo, así que `devolverCapital` sigue funcionando y además resta `cuotasPagadas` si el crédito es PLAN.
  - **MANUAL:** `capital = 0`; no cambia el saldo.
- "Actualiza el saldo con el extracto" (MANUAL): `saldoActualizadoEn < fecha del día de pago de este mes ≤ hoy`.

*Alternativa descartada:* guardar la tabla del plan de pagos en la base. Es derivable de tres números, y guardarla obliga a migrarla cada vez que se corrige.

### D4. Proyección

`proyeccionCreditos(estado, hoy, meses = 6)`:
- Para cada crédito, el saldo al final del mes en curso y de los 5 siguientes. Si la cuota del mes en curso ya se pagó, el fin de mes es el saldo de hoy; si no, se aplica una fila de la tabla.
- Los totales salen de esos saldos.
- `deberanAlCerrar` es la suma a diciembre del año en curso (amplía la tabla si hace falta).
- `interesesAnio(año + 1)` suma los intereses de las 12 filas de ese año.
- "Termina" es el mes de la última fila con saldo > 0, o null si es a mano.

Vive en `rules/credito.ts`; `CuentasPort.creditos()` devuelve `VistaCredito` con `metodo`, `termina`, `proxima: { interes, capital }`, `actualizar` y `proyeccion: Pesos[]`, más un `ResumenCreditos` con los indicadores.

### D5. Categoría única y migración `V12`

**Dominio y semilla:**
- `Categoria.porDefecto` y la semilla quedan con cuatro categorías, con Créditos en #7C4DDB.
- `TipoCategoria` conserva `'TARJETA'` para leer datos viejos, pero ninguna regla la crea.
- `VERSION_ESQUEMA` sube a 4: el adaptador demo vuelve a sembrar.

**Backend, `V12__tarjetas_creditos.sql`:**
1. Crea `tarjeta` (`id`, `hogar_id`, `nombre`, `dia_corte`, `dia_pago`, `uso`, `pago_tipo` COMPLETA/FIJO, `pago_monto`, `creado_en`) y agrega `item_plan.tarjeta_id`, con FK diferida como en V5.
2. Agrega a `credito`:
   - `metodo` (text NOT NULL DEFAULT 'TASA', CHECK con los tres métodos);
   - `numero_cuotas` (smallint);
   - `cuotas_pagadas` (smallint NOT NULL DEFAULT 0);
   - `valor_financiado` (bigint).
3. Une las categorías. En cada hogar:
   - `item_plan.categoria_id` de TARJETA pasa a la de CREDITO;
   - las celdas de `anual_celda` de TARJETA se suman a las de CREDITO del mismo mes, con un `INSERT ... ON CONFLICT DO UPDATE`, y se borran;
   - `anual_evento.categoria_id` de TARJETA pasa a CREDITO;
   - se borra la categoría TARJETA;
   - el color de Créditos pasa a #7C4DDB, si sigue en el de sistema #2E6B45.
4. Convierte las compras a cuotas. Cada serie de ítems `CUOTA`, agrupada por (hogar, nombre, `cuota_total`), se vuelve un crédito PLAN:
   - `valor_financiado` = monto × total y `numero_cuotas` = total, sin intereses;
   - `cuotas_pagadas` = la `cuota_actual` más alta entre los meses CERRADOS o con pago de esa cuota, o `cuota_actual − 1` del mes más reciente;
   - saldo = monto × (total − pagadas), y `dia_pago` = `dia_vence` (o 1);
   - los ítems se enlazan con `credito_id` y pasan a `tipo = 'CREDITO'`, con `cuota_*` en null.

   Se hace en SQL con CTEs. Lo cubre un `MigracionV12Test` con Testcontainers, que siembra un hogar con datos de antes de V12.

**PWA y app, sin backend:** el adaptador demo vuelve a sembrar. No hay datos de usuario locales que migrar.

### D6. Backend

- **Tarjetas:**
  - `TarjetaController`: `GET/POST /api/tarjetas`, `PUT/DELETE /api/tarjetas/{id}`.
  - `TarjetasUseCase`, con las mismas validaciones y el enlace a un ítem del mes en curso.
  - `NacimientoMes` agrega o actualiza la línea de cada tarjeta (D1).
  - `Registro.marcarPago` actualiza el `estimado`.
- **Créditos:**
  - `CuentasUseCase.agregarCredito` acepta `metodo` y sus campos.
  - Nuevo `PUT /api/creditos/{id}/metodo`.
  - "Corregir con extracto" sigue en el `PUT .../saldo` de hoy.
  - El pago de la cuota por método se replica en `Registro`.
- **Finanzas:** el `GET` de finanzas incluye `tarjetas` y los campos nuevos de los créditos, y `api.ts` y el adaptador conectado los leen.
- Contrato en `CuentasContratoTest` y uno nuevo `TarjetasContratoTest`. Los endpoints se documentan en `backend/README.md`.

### D7. Pantallas

- **PWA, escritorio:**
  - Pestaña Tarjetas: KPI, calendario de 36 columnas en una caja con scroll propio y tarjetas en cuadrícula, cada una con pago y corte.
  - Pestaña Créditos: indicadores, tabla, panel lateral del crédito elegido y la tabla de proyección.
  - El panel del crédito reutiliza los datos de `VistaCredito`.
- **PWA, móvil, y app:**
  - Tarjetas: lista "Próximas fechas" y "Mis tarjetas".
  - Créditos: tarjetas de crédito con barra de progreso (segmentada si son ≤ 24 cuotas).
- **"¿Cómo baja el saldo?":**
  - Es una hoja con el radiogroup de los tres métodos y sus campos, que se usa para agregar y para "Cambiar".
  - Con la tasa, un selector EM/EA junto al campo.
  - Con el plan de pagos: valor, número de cuotas, tasa EA, cuotas pagadas, y la cuota calculada en vivo.
- **Detalle de crédito:** la PWA reescribe `credito-page.ts` con el artboard `Credito`: método con "Cambiar", progreso, la tabla de próximas cuotas, el simulador de hoy, y "Corregir con extracto" y "Registrar abono". La app reescribe `credito/[id].tsx` igual.
- **Hoy:** el detalle de un ítem con `tarjetaId` sale de `detalleItem` en `ejecucion.ts` ("Corte 13 · valor del extracto"), así que las dos apps lo muestran igual sin tocar sus pantallas.

## Risks / Trade-offs

- **[Riesgo] La migración de compras a cuotas adivina `cuotas_pagadas`.** → Mitigación: la regla se basa en los pagos registrados; si no coincide, "Corregir con extracto" lo ajusta. Se prueba con un hogar sembrado en `MigracionV12Test`.
- **[Riesgo] Cambiar la semilla mueve todas las cifras de las pruebas** (Variables $720.000 → $400.000, Créditos $3.495.000). → Mitigación: el plan total se mantiene. Las pruebas de paridad se actualizan juntas en las dos apps, con las cifras del canvas (`HoyWeb`: Falta pagar $2.595.000, Pagado $2.033.000).
- **[Riesgo] Dos cambios abiertos tocan "Paridad con la PWA" y "Cuentas, cuadre y créditos".** → Archivar en orden: `planear-anio-desde-un-mes`, luego `web-escritorio-completo` y por último este. Los deltas de este ya incluyen el texto de los anteriores.
- **[Trade-off] La tabla del plan de pagos es aproximada** (sistema francés con la EM equivalente). → La UI lo dice, y el extracto la corrige.
- **[Trade-off] `estimado` no vuelve atrás al borrar un pago.** → Solo afecta la sugerencia del próximo mes, que se puede editar en el plan.

## Migration Plan

1. Desplegar el backend con `V12`. Flyway la aplica al arrancar, y si falla el arranque se puede volver a `steward.prev`.
2. Desplegar la PWA y enviar la app 2.2.0 a TestFlight.
3. Rollback: V12 no es reversible automáticamente. Antes de desplegar se hace un `pg_dump` del esquema `steward` en el VPS.

### D8. Tarjetas como categoría propia (V13)

A pedido del usuario, después de desplegar V12, Tarjetas vuelve como categoría del sistema (TARJETA, #7C4DDB), aparte de Créditos (#2E6B45):
- **V13** crea Tarjetas en cada hogar, o convierte una propia llamada "Tarjetas", y ordena Diezmo, Gastos fijos, Variables, Tarjetas y Créditos. También pasa a Tarjetas los ítems con `tarjeta_id`.
- **Al enlazar un ítem a una tarjeta** (de Tarjetas o de Créditos), el ítem pasa a Tarjetas. Las líneas que copia un mes nuevo también.
- **Al agregar una tarjeta**, si su día de pago de este mes ya pasó, la línea empieza el mes siguiente; así no aparece "Venció el 1" el mismo día en que se agrega.
