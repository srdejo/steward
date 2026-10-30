# Design

## Context

La Etapa 10 (`diezmo-como-gasto`) dejó el diezmo como ítems del plan y las líneas de ingreso por opción. En producción (2026-10-30), Daniel encontró que el plan es difícil de usar. La revisión en `steward.test` a ancho de teléfono mostró:

- **Planear:**
  - el mes Activo se muestra en solo lectura (`mes-page.ts`, `@default`), aunque el dominio (`guardarItem`, `escenarioEditable`) y el backend (`PlanUseCase.escenarioEditable`) ya permiten editar todo salvo un mes CERRADO;
  - las líneas y los gastos se editan en campos que guardan al salir (`MontoInput` con `confirmado`), sin aviso;
  - "+ Agregar" crea el gasto en $0;
  - no hay cómo quitar un gasto: `PlanPort.quitarItem` existe, pero la pantalla no lo usa;
  - la "×" de un ingreso quita sin confirmar.
- **Sin borrado:** no hay endpoint ni regla para borrar un plan de mes, ni un movimiento.
- **Diezmo:** el ítem guarda `ingresoFijoId` o `aporteId`, pero no la línea de la opción de la que salió. Además, `guardarIngresoPlan` no lo toca.
- **Hoy:** el diezmo muestra "Venció el día N" en rojo, porque usa `diaVence` como una factura.
- **Cuentas:** muestra el saldo estimado sin los movimientos que lo explican.
- **Ajustes:** muestra "Face ID al abrir" y "Ocultar montos", que todavía no hacen nada.

Producción ya tiene datos de la Etapa 10: líneas de ingreso, ítems de diezmo con `ingreso_fijo_id` y pagos.

## Goals / Non-Goals

**Goals:**
- Todo lo del plan se edita, también en el mes en curso, en hojas con "Guardar" explícito.
- Se puede borrar: un gasto del plan, un registro, el plan de un mes y todo ("Empezar de nuevo").
- El diezmo sigue a su ingreso sin pisar lo que se ajustó a mano.
- El saldo de cuentas y créditos sigue siendo coherente después de corregir o borrar.

**Non-Goals:**
- Corregir o borrar transferencias, ajustes de cuadre, abonos ni entregas de diezmo de antes.
- Deshacer un cuadre.
- Historial o papelera de lo borrado.
- La app Expo conectada (Etapa 12).
- Passkeys, biometría y "Ocultar montos" (Etapa 13).

## Decisions

### D1. Enlace del diezmo a su línea y "ajustado a mano"

**Modelo:**
- `ItemPlan` gana `ingresoPlanId: Id | null` (la línea de la opción de la que sale el diezmo) y `ajustadoAMano: boolean`;
- `IngresoPlan` gana `bruto: Pesos`;
- en el backend: `item_plan.ingreso_plan_id` (FK a `ingreso_plan`, `ON DELETE SET NULL`, diferida), `item_plan.ajustado_a_mano` (`DEFAULT false`) e `ingreso_plan.bruto` (`NOT NULL`).

**Monto sugerido** (`diezmoSugerido(estado, linea)`): la regla activa de `linea.usuarioId`, sobre `linea.bruto` si la base es BRUTO o sobre `linea.monto` si es NETO. Sin regla, se usa el 10 % sobre el monto, como en los aportes.

**Cuándo se recalcula** (`recalcularDiezmoDe(linea)`): al guardar una línea, su ítem de diezmo enlazado se recalcula si `!ajustadoAMano` y no tiene pagos.

**"Ajustado a mano":**
- Guardar un ítem `DIEZMO` con un monto distinto del sugerido lo marca `ajustadoAMano = true`.
- "Volver a calcular" (`POST .../items/{itemId}/recalcular`) pone el sugerido y lo desmarca.

**Al nacer:**
- `diezmosDelMes` y `ingresoFijoAlMes` enlazan cada diezmo de un ingreso fijo o de un evento a la línea que nace con él. Por eso las líneas se crean primero y luego los diezmos.
- `duplicarEscenario` y la copia del backend remapean `ingresoPlanId` a las líneas nuevas.
- Los diezmos de aportes siguen con `aporteId` y sin línea.

**Quitar una línea** quita su diezmo si no tiene pagos. Si tiene, el enlace queda en null.

**Alternativa descartada: recalcular a partir del ingreso fijo.** No sirve para las líneas EXTRA ni OTRO, ni para una opción B con otro salario.

**Por qué el bruto en la línea:** con base BRUTO, el diezmo sale del bruto, y la línea solo tenía el neto. La hoja muestra "Bruto" solo cuando la regla de la persona usa el bruto.

### D2. Un ingreso fijo editado propaga a los meses abiertos

`guardarIngresoFijo` (editar) y `FinanzasUseCase.editarIngreso` recorren las opciones de los planes no cerrados de `mes ≥ mes en curso`. En cada línea `FIJO` con ese `ingresoFijoId` que tenga `monto == neto anterior` y `bruto == bruto anterior`, y que no esté recibida en su mes:
- ponen el valor nuevo;
- aplican D1 a su diezmo.

Así una línea cambiada a mano no se pisa, sin necesidad de otra marca. El nombre también se copia si la línea tenía el nombre anterior.

### D3. Corregir y borrar registros

**Dominio:**
- `corregirRegistro(estado, { movimientoId, monto?, origen?, nota? })` y `borrarRegistro(estado, { movimientoId })`;
- tipos permitidos: `PAGO`, `GASTO`, `INGRESO_FIJO` y `APORTE`; otro tipo responde `DATOS_INVALIDOS`;
- `asegurarAbierto` del mes del registro.

**Backend:**
- `PATCH /api/registros/{id}` con `{monto?, origen?, nota?}` y `DELETE /api/registros/{id}`, en `FinanzasUseCase`, en una transacción;
- 404 `REGISTRO_NO_ENCONTRADO`.

**Créditos:**
- `movimiento.capital bigint NULL`, que se llena en `pagar` (lo que bajó `pagarCuota`) y en `abonar` (el abono).
- `pagarCuota` pasa a devolver cuánto bajó (`RETURNING`).
- Borrar un pago con `credito_id` y `capital` hace `credito.saldo += capital`.
- Un pago de cuota no corrige su monto (400 `DATOS_INVALIDOS`): se borra y se marca otra vez, para no recalcular intereses.
- Los movimientos anteriores, con `capital` null, se borran sin tocar el saldo, y la hoja lo advierte.

**Cuadre:** no hay que hacer nada especial. El saldo estimado es `saldoCuadre + Σ efectos con seq > seqCuadre`:
- borrar o corregir algo con `seq ≤ seqCuadre` no cambia el saldo, y es lo correcto, porque el banco ya lo reflejó;
- la hoja lo dice comparando `seq` con el `seqCuadre` de la cuenta.

**Aporte:** al borrarlo, su ítem de diezmo (`aporteId`) se quita si no tiene pagos. Si los tiene, `item_plan.aporte_id` queda en null; la FK pasa a `ON DELETE SET NULL` en `V9` si no lo estaba.

### D4. Borrar el plan de un mes y empezar de nuevo

**`borrarPlan(estado, ref)`.** En el backend es `DELETE /api/planes/{id}`, o `DELETE /api/meses/{anio}-{mes}` para un mes cerrado sin plan, y `GET /api/meses/{anio}-{mes}/borrado` devuelve los conteos para la confirmación. En una transacción:
1. borra los movimientos del mes de tipo `PAGO`, `GASTO` e `INGRESO_FIJO`, devolviendo a cada crédito su `capital`;
2. borra el plan, en cascada con sus opciones, líneas e ítems;
3. borra el cierre del mes.

Los `APORTE`, `AJUSTE_CUADRE`, `TRANSFERENCIA`, `ABONO_CREDITO` y `DIEZMO_ENTREGADO` del mes se conservan. Un aporte se queda; su diezmo nacerá otra vez cuando se cree el mes (D2 de `diezmo-como-gasto`).

**`empezarDeNuevo(estado)`.** En el backend es `POST /api/hogar/empezar-de-nuevo`, en una transacción:
1. para cada cuenta: `saldo_cuadre := saldo estimado actual`, `fecha_cuadre := hoy` y `seq_cuadre := último seq`, conservando `cuadrada`;
2. borra todos los movimientos, planes, cierres, planes anuales y proyecciones del hogar;
3. los créditos conservan su saldo actual.

**Por qué conservar el saldo de las cuentas:** el dinero real no cambia al borrar el plan; perder lo registrado no debe mover lo que hay en el banco.

### D5. Planear: hojas de edición y mes en curso

- **Componentes nuevos** en `features/planear`:
  - `ingreso-hoja.ts` (nombre, monto, bruto si aplica, persona, y "Aplicar diezmo" al crear);
  - `gasto-plan-hoja.ts` (todos los campos del ítem y, si es diezmo, su origen y "Volver a calcular").
- **Cómo se abren:** con estado local de `mes-page`, no con rutas, porque la hoja depende de la opción elegida.
- **"Guardar":**
  - llama al puerto;
  - con éxito, cierra la hoja y muestra "Guardado" en un aviso que se va solo (`role="status"`);
  - con error, el mensaje queda en la hoja.
- **Fila del plan:** solo texto y monto, sin campos. `MontoInput.confirmado` queda sin uso en Planear.
- **Mes en curso:** `mes-page` usa la misma vista editable para `ACTIVO`, sin pestañas ni "+ Duplicar", con "Ver hoy" y "Cierre de mes".
- **Borrar el plan:** "Borrar plan de {mes}" va al final de la página, como acción destructiva, en los estados Borrador, Activo y Cerrado.

### D6. Hoy: hoja del registro

- **Ruta:** `hoy/registro/:id`, en `registro-hoja.ts`, con el movimiento, su ítem o línea, la cuenta y el aviso del cuadre (D3).
- **Varios registros:** un ítem variable con varios gastos, o los aportes de una persona, abren primero la lista (`hoy/registros?item=` o `?aportes=usuarioId`).
- **El diezmo en Por pagar:** el detalle sale de su línea o su aporte ("Del {nombre de la línea} · día N", "Del aporte del {dd mmm}"). No pasa por `detalleVencimiento`, que solo aplica a los otros tipos.

### D7. Cuentas y Ajustes

- **Detalle de cuenta:** la ruta `cuentas/cuenta/:id` lista lo de `estado.movimientos` con `seq > seqCuadre` que afecta a la cuenta, con la regla de `efecto()`. Es solo dominio: `movimientosDeCuenta(estado, cuentaId)`.
- **Ajustes:**
  - "Empezar de nuevo" lleva una confirmación que pide escribir EMPEZAR;
  - "Face ID al abrir" y "Ocultar montos" quedan detrás de una constante `SEGURIDAD_DISPONIBLE = false`;
  - el modo demo sigue guardando sus preferencias, sin mostrarlas.

### D8. Migración `V9__usabilidad_plan.sql`

1. **Línea de ingreso:** `ingreso_plan.bruto bigint`.
   - Backfill: el `bruto` del ingreso fijo enlazado, o el `monto` si no tiene ingreso fijo.
   - Después, `NOT NULL`.
2. **Enlace del diezmo:** `item_plan.ingreso_plan_id` y `ajustado_a_mano boolean NOT NULL DEFAULT false`.
   - Backfill: cada ítem `DIEZMO` con `ingreso_fijo_id` se enlaza a la línea `FIJO` de su misma opción con ese ingreso fijo.
   - Cada ítem `DIEZMO` sin enlace se enlaza a la línea `EXTRA` de su opción cuyo nombre coincide con "Diezmo · {nombre}".
   - Se marca `ajustado_a_mano` cuando su monto difiere del sugerido con la regla actual.
3. **Crédito:** `movimiento.capital bigint NULL`.
4. **Aporte:** la FK `item_plan.aporte_id` pasa a `ON DELETE SET NULL` (`DEFERRABLE`).

La migración es aditiva. Antes del deploy: `deploy.ps1 -Projects steward -Action Backup`.

## Risks / Trade-offs

- **[Borrar es irreversible]** → Toda confirmación dice qué se borra. "Empezar de nuevo" pide escribir EMPEZAR, y antes de un deploy queda el backup. No hay papelera (Non-Goal).
- **[Un pago de cuota anterior a V9, sin `capital`]** → Se borra sin devolver el saldo, y la hoja lo advierte: "Revisa el saldo de Libre inversión".
- **[El backfill de "ajustado a mano"]** → Puede marcar un diezmo que coincide por casualidad o dejar uno sin marcar. Es inofensivo: "Volver a calcular" lo corrige.
- **[El mes en curso editable cambia lo que Hoy compara]** → Es lo esperado. Pagado no cambia, y "Vs. plan" se recalcula con el plan nuevo.

## Migration Plan

1. Archivar `diezmo-como-gasto` antes de aplicar, para que las specs principales tengan el diezmo como gasto.
2. Dominio y pruebas.
3. Backend con `V9` y contrato (JVM y AOT).
4. PWA y Expo (mínimo).
5. Probar `V9` sobre una copia de `steward.test` con datos de la Etapa 10.
6. Recorrido en `steward.test`.
7. Producción: backup, binario nativo, contrato contra el binario y deploy (con confirmación).

**Rollback:** volver al binario anterior es seguro, porque `V9` solo agrega columnas y relaja una FK.

## Open Questions

Ninguna. Las decisiones de Daniel (2026-10-30) fueron:
- borrar el mes y "Empezar de nuevo";
- se borra todo, con aviso;
- hojas con "Guardar";
- el diezmo recalculado salvo si se ajustó a mano;
- corregir o borrar registros.
