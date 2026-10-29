# Design

## Context

Estado al empezar (ver proposal.md, "Why"):

- **Backend.** El de la Etapa 4 (`backend-plan-mes-hoy`):
  - `cuenta` con `saldo_cuadre`, `fecha_cuadre` y `cuadrada`, sin cuadre ni saldo estimado;
  - `movimiento` con INGRESO_FIJO, DIEZMO_ENTREGADO, APORTE, PAGO y GASTO, con `cuenta_id` y `origen`, pero sin orden de registro;
  - `item_plan` sin enlace a un crédito;
  - `GET /api/finanzas` lee los movimientos desde dos meses antes del mes en curso (D4 de la Etapa 4).
- **Dominio compartido.** Ya tiene, con tests:
  - `saldoEstimado` (el último cuadre más el efecto de los movimientos con `seq` posterior a `seqCuadre`), `cuadrarCuentas` y `moverDinero`;
  - `simularAbono`, `cuotasRestantes`, `porcentajePagado`, `actualizarSaldoCredito` y `registrarAbono`;
  - `marcarPago`, que con `item.creditoId` baja el saldo en la parte de capital.

  No tiene cómo crear un crédito, y `crearMes` no sabe de créditos.
- **PWA.**
  - `superposicion.ts` numera los movimientos reales después de todo lo de prueba y pone `seqCuadre = base` en todas las cuentas reales. Así el saldo estimado suma todo lo leído, pero pierde lo que sale de la ventana de meses.
  - `PuertosConectados` rechaza cuadrar y mover con `ETAPA_5`, y deja los créditos en el adaptador de prueba.

## Goals / Non-Goals

**Goals:**
- Que cuadrar, mover dinero y los créditos sean reales y compartidos, con las cifras de las vistas calculadas por el mismo dominio en el cliente (D3 de la Etapa 4).
- Que el saldo estimado sea el mismo para los dos miembros y no dependa de la ventana de meses que lee la app.
- Que un crédito nuevo entre al plan sin pasos extra, y que pagar su cuota baje su saldo.

**Non-Goals:**
- "Probarlo como opción" de un crédito (Etapa 7: necesita varias opciones por mes).
- Cerrar el mes y repartir el sobrante (Etapa 6). "Sin registrar" del Cierre ya suma los ajustes reales, porque el Cierre se calcula en el cliente.
- Editar o borrar un crédito o una cuenta, o deshacer un cuadre o una transferencia: el dominio no lo tiene.
- Enlazar a mano un ítem con un crédito desde Planear: la API lo admite (`creditoId`), pero ninguna pantalla lo pide en esta etapa.
- Cuentas con saldo negativo (sobregiro): el esquema ya exige `saldo_cuadre >= 0`, y se mantiene.

## Decisions

### D1. Orden de registro: `seq` en `movimiento` y `seq_cuadre` en `cuenta`

El saldo estimado del dominio depende del orden de registro, no de la fecha:
- un pago con fecha de ayer registrado después del cuadre de hoy sí cuenta;
- uno registrado antes del cuadre no cuenta.

Por eso el backend guarda ese orden:
- **`movimiento.seq`**, `bigint GENERATED ALWAYS AS IDENTITY`, único. La migración numera los existentes por `creado_en` y luego `id`.
- **`cuenta.seq_cuadre`**, el `seq` del último movimiento que ya estaba incluido en su `saldo_cuadre`.
  - Al crear una cuenta, es el `seq` máximo del momento (0 si no hay movimientos), como `agregarCuenta` (`seqCuadre: s.secuencia`).
  - En las cuentas que ya existen queda en 0. Así su saldo estimado sigue sumando todo lo registrado desde su saldo inicial, que es lo que la app hace hoy.

La alternativa era que el backend calculara el saldo estimado y lo mandara. Se descarta por D3 de la Etapa 4: las cifras las calcula el dominio en el cliente, y el backend solo reproduce las reglas de escritura (aquí, la diferencia del cuadre, D3).

### D2. Lectura: los movimientos que siguen contando en un saldo

`GET /api/finanzas` lee:
- los movimientos de la ventana (desde dos meses antes);
- más los de cualquier mes cuyo `seq` sea mayor que el `seq_cuadre` mínimo de las cuentas del hogar.

Sin cuadres, esto lee todo lo registrado desde que existen las cuentas. Es acotado en la práctica: un hogar registra decenas de movimientos al mes, y cuadrar recorta la lectura. Si crece, se puede cambiar por un saldo acumulado por cuenta sin tocar el contrato.

Cada movimiento lleva:
- `seq`;
- `cuentaDestinoId` (TRANSFERENCIA);
- `creditoId` (PAGO de un ítem enlazado y ABONO_CREDITO).

Cada cuenta lleva `seqCuadre`, y cada ítem, `creditoId`.

**PWA** (`superposicion.ts`): numera los reales con `base + seq` y las cuentas con `seqCuadre = base + seqCuadre`. Así el dominio calcula el mismo saldo que el backend usó al cuadrar.

Los movimientos que entran solo por el saldo (de meses viejos) no afectan las vistas de Hoy ni de Planear, que filtran por mes.

### D3. Cuadrar: el backend calcula la diferencia

`POST /api/cuentas/cuadre` (`{saldos: [{cuentaId, saldoBanco}]}`), en una transacción. Primero verifica que todas las cuentas sean del hogar (si una no lo es, `CUENTA_NO_ENCONTRADA` y no cuadra ninguna). Luego, por cada cuenta:

1. `SELECT ... FOR UPDATE` de la cuenta.
2. Saldo estimado: `saldo_cuadre` + la suma del efecto de los movimientos con `seq > seq_cuadre`, con la misma tabla de efectos que `efecto()` del dominio, en SQL (`CASE` por tipo y origen). Una clase `SaldoEstimado` con tests la documenta y la comparte con el test de paridad.
3. Si la diferencia no es cero, inserta el AJUSTE_CUADRE (monto = diferencia, con signo; `origen = CUENTA`, `cuenta_id` = la cuenta, nota "Gastos sin registrar", mes en curso).
4. Actualiza la cuenta: `saldo_cuadre`, `fecha_cuadre = hoy`, `cuadrada = true`, `seq_cuadre` = el `seq` máximo leído en el paso 2, o el del ajuste si se insertó.

**Carrera conocida.** Un movimiento que se confirma mientras otra transacción cuadra la misma cuenta puede quedar con un `seq` menor que el `seq_cuadre` nuevo sin haber entrado en la suma. Se acepta: son dos personas en un hogar, cuadrar es raro, y el siguiente cuadre lo corrige como "Gastos sin registrar". Bloquear la cuenta en cada registro costaría en todos los pagos.

### D4. Créditos: tabla `credito` y pagos derivados

- **`credito`**: `id`, `hogar_id` (CASCADE), `nombre`, `entidad`, `saldo bigint >= 0`, `saldo_actualizado_en date`, `cuota bigint > 0`, `tasa_em numeric(5,2)` (0 a 10), `dia_pago`, `total_original bigint > 0`. Que el total original no sea menor que el saldo se valida solo al crear, en el caso de uso: después, "Actualizar saldo" puede subirlo (intereses de mora). `saldo` puede bajar a 0 y quedarse ahí.
- **`item_plan.credito_id`**: FK diferida a `credito` (como las de V4, para el borrado en cascada del hogar).
- **`movimiento.credito_id`**: FK diferida. Va en los PAGO de un ítem enlazado y en los ABONO_CREDITO.
- **Últimos pagos**: no se guardan aparte. Son los movimientos con `credito_id`, los 6 más recientes por crédito, mapeados a `{fecha, monto, tipo: CUOTA | ABONO}`, en la lectura de finanzas. Así no hay dos fuentes de verdad.

**Saldo atómico.** Pagar la cuota y abonar actualizan el saldo con un `UPDATE` que lee y escribe en la misma sentencia:
- cuota: `saldo = greatest(0, saldo - greatest(0, :monto - round(saldo * tasa_em / 100)))`;
- abono: `saldo = saldo - :monto WHERE saldo >= :monto`. Si no actualiza filas, responde `ABONO_MAYOR`.

Corre en la misma transacción que el movimiento. `round` de PostgreSQL redondea las mitades hacia arriba, igual que `Math.round` con montos positivos.

### D5. La cuota entra al plan (dominio y backend)

Una sola regla, en el dominio (`cuotasDeCreditos(estado, escenario)`) y en `PlanUseCase`. Para cada crédito con `saldo > 0` sin ítem con su `creditoId` en la opción, agrega:
- categoría: la primera de tipo `CREDITO` (la del sistema), o la primera del hogar si no hay;
- nombre: `Cuota {nombre en minúsculas}`;
- monto: la cuota;
- vencimiento: el día de pago;
- tipo: `CREDITO`, con `creditoId`.

Se aplica en dos momentos:
- **`agregarCredito`**: en la Opción A (la principal) del mes en curso, si tiene plan y no está Cerrado. No crea planes.
- **`crearMes`** (y `crearPlan` del backend), al final, en los tres modos. Antes quita los ítems copiados de créditos con `saldo = 0`.

`FIJOS` no pone en $0 los ítems `CREDITO`: ya era así en el dominio, porque solo cambia los `VARIABLE`.

El dominio cambia (no solo el backend) para que demo y conectado den lo mismo. Los tests de `crearMes` del seed siguen pasando: el seed ya tiene "Cuota libre inversión" enlazada, y el crédito tiene saldo.

### D6. API

| Método y ruta | Cuerpo | Respuesta | Errores |
|---|---|---|---|
| `POST /api/cuentas/cuadre` | `{saldos: [{cuentaId, saldoBanco}]}` | 200, las cuentas cuadradas | `CUENTA_NO_ENCONTRADA`, `DATOS_INVALIDOS` |
| `POST /api/transferencias` | `{desde, hacia, monto}` | 201, el movimiento | `MISMA_CUENTA`, `CUENTA_NO_ENCONTRADA`, `DATOS_INVALIDOS` |
| `POST /api/creditos` | `{nombre, entidad, saldo, totalOriginal, cuota, tasaEM, diaPago}` | 201, el crédito | `DATOS_INVALIDOS` |
| `PUT /api/creditos/{id}/saldo` | `{saldo}` | 200, el crédito | `CREDITO_NO_ENCONTRADO`, `DATOS_INVALIDOS` |
| `POST /api/creditos/{id}/abonos` | `{monto, usuarioId, origen: {tipo, cuentaId?}}` | 201, el movimiento | `ABONO_MAYOR`, `CREDITO_NO_ENCONTRADO`, `CUENTA_NO_ENCONTRADA`, `MIEMBRO_NO_ENCONTRADO` |

Los ítems (`POST`/`PUT .../items`) aceptan `creditoId` opcional. En `PUT`, si no viene, se conserva el que tenía.

Todo va en un `CuentasUseCase` nuevo (cuadre, transferencias, créditos). Toma de `FinanzasUseCase` la validación de origen y miembro, que pasa a un componente común (`Registro`). `FinanzasUseCase.pagar` llama al puerto de créditos cuando el ítem tiene `creditoId`.

### D7. PWA

- **`PuertosConectados.cuentas`**: `cuadrar`, `mover`, `agregarCredito`, `actualizarSaldo` y `registrarAbono` van por HTTP y releen las finanzas. Las lecturas (`cuentas`, `creditos`, `credito`, `diferencia`, `simular`) siguen pasando por el adaptador de prueba sobre el estado superpuesto. `probarComoOpcion` sigue rechazando con `ETAPA_7`.
- **`superposicion.ts`**: reemplaza `creditos` con los reales (con `pagos` desde `ultimosPagos`), y pone `creditoId` en ítems y movimientos y `cuentaDestinoId` en las transferencias. Aplica el `seq` real (D2).
- **Pantallas:**
  - Cuentas gana "+ Agregar" en Créditos, con la hoja de `steward-cuentas`;
  - "Registrar abono" gana el selector de origen, el mismo de Marcar pago;
  - el aviso `pronto` de Cuadrar y Mover desaparece.
- **Puerto `CuentasPort.agregarCredito`**: en el adaptador de prueba, llama a `agregarCredito` del dominio.


## Risks / Trade-offs

- **[Lectura más grande sin cuadres]** → D2. Se mide en el recorrido; si molesta, un saldo acumulado por cuenta en el backend, sin cambiar el contrato.
- **[Carrera entre un registro y un cuadre]** → D3. Aceptada; la corrige el siguiente cuadre.
- **[La tabla de efectos vive en dos lenguajes]** (`efecto()` en TypeScript y el `CASE` en SQL) → un test de contrato que recorre todos los tipos y orígenes contra cifras escritas a mano del dominio. Un comentario en cada lado apunta al otro.
- **[Cuota pagada dos veces el mismo mes]** → ya la impide `movimiento_pago_uq`. El saldo solo baja si el INSERT del pago pasa, porque están en la misma transacción.
- **[Cambio en `crearMes` del dominio]** → afecta también al modo demo. Es lo esperado: un crédito con saldo siempre tiene su cuota en el plan. Los tests de `crearMes` cubren los tres modos con y sin créditos.

## Migration Plan

1. `V5__cuentas_creditos.sql`:
   - `credito`;
   - `cuenta.seq_cuadre` (default 0);
   - `movimiento.seq` (identity, numerando los existentes), `cuenta_destino_id` y `credito_id`;
   - el CHECK de `tipo` con AJUSTE_CUADRE, TRANSFERENCIA y ABONO_CREDITO;
   - `item_plan.credito_id`.

   Un test de migración, como `MigracionV3Test`.
2. Despliegue local como siempre (`local-deploy.ps1 -Project steward`). El VPS sigue sin backend.
3. Rollback: la migración solo agrega. Volver al build anterior funciona mientras no haya filas de los tipos nuevos: el backend anterior no las sabría leer.

## Open Questions

Ninguna. Las dos decisiones de alcance las tomó Daniel al proponer: créditos que se agregan con su cuota enlazada al plan, y Mover dinero dentro de esta etapa.
