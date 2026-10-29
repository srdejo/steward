# Design

## Context

Estado al empezar (ver proposal.md, "Why"):

- **Backend.** El de la Etapa 5 (`backend-cuentas-creditos`).
  - `plan_mes.estado` ya admite CERRADO, y `PlanUseCase` y `FinanzasUseCase` responden `MES_CERRADO` cuando el plan está Cerrado. Pero nada lo pone en Cerrado.
  - "Recibí" y "Entregado" no miran si el mes está cerrado.
  - Cada movimiento tiene su orden de registro (`seq`).
- **Dominio compartido.** Ya tiene, con tests:
  - `vistaCierre`: las filas plan vs. real, "Sin registrar" (suma de AJUSTE_CUADRE), el sobrante y el plan libre;
  - `repartoValido` y `cerrarMes`, que guarda un `CierreMes` y pone el plan en CERRADO;
  - `asegurarAbierto`: un mes está cerrado si su plan está CERRADO **o** tiene cierre;
  - `ingresosDelMes`, que suma "Sobrante de {mes}" con el `aSiguiente` del cierre del mes anterior;
  - `vistaCierre` de un mes cerrado, que devuelve lo guardado.
- **PWA.** `superposicion.ts` deja `cierres: []`, y `PuertosConectados.cierre.cerrar` rechaza con `ETAPA_6`. La vista del Cierre ya se calcula con los datos reales.

Decisiones de Daniel al proponer:
- el sobrante lo calcula la PWA y el backend guarda la foto;
- se cierra el mes en curso o uno anterior, sin "Reabrir".

## Goals / Non-Goals

**Goals:**
- Que cerrar el mes sea real y compartido, con las cifras del mismo dominio que las muestra.
- Que la foto guardada no quede vieja sin que nadie lo note: si alguien registró algo en el mes después de calcularla, no se cierra.
- Que un mes cerrado sea de solo lectura en el backend, igual que en el dominio.

**Non-Goals:**
- Reabrir un mes cerrado.
- Que el backend recalcule el sobrante o las filas, porque duplicaría `ingresosDelMes`, los aportes implícitos y el diezmo planeado (D1).
- Mover el "A ahorro" a una cuenta: el dominio solo lo registra en el cierre, sin movimiento.
- Detectar un cambio en el plan (no en lo registrado) entre calcular y cerrar (ver Risks).
- Plan anual (Etapa 8) y varias opciones (Etapa 7).

## Decisions

### D1. La PWA manda la foto; el backend la valida y la guarda

`POST /api/cierres`:

```
{anio, mes, filas: [{nombre, plan|null, real}], sinRegistrar, sobrante, aAhorro, aSiguiente, ultimoSeq}
```

La PWA arma el cuerpo con `vistaCierre` sobre el estado superpuesto, el mismo que muestra la pantalla.

Lo que el backend sí comprueba por su cuenta:
1. **El mes:** `ref <= mes en curso`. Si es futuro, `DATOS_INVALIDOS`.
2. **El reparto:** `repartoValido` (los dos ≥ 0, suma = `max(0, sobrante)`). Si no, `REPARTO_INVALIDO` (400).
3. **"Sin registrar":** la suma de los AJUSTE_CUADRE del mes, en SQL. Si no coincide, `CIERRE_DESACTUALIZADO`.
4. **Lo registrado:** `max(seq)` de los movimientos del mes `<= ultimoSeq`. Si hay uno posterior, `CIERRE_DESACTUALIZADO` (409), con "Alguien registró algo en {mes}; revisa el cierre otra vez".
5. **Una sola vez:** el índice único `(hogar_id, ref_anio, ref_mes)` de `cierre_mes`. Su violación es `MES_CERRADO`, aunque lleguen dos a la vez.

Así, lo que se guarda siempre corresponde a todo lo registrado en el mes. Lo único que no se puede comprobar es la aritmética de las filas, que es la del dominio compartido.

La alternativa (recalcular en Java) la descartó Daniel.

### D2. Datos: `V6__cierre_mes.sql`

- **`cierre_mes`**: `id`, `hogar_id` (CASCADE), `ref_anio`, `ref_mes`, `sin_registrar bigint`, `sobrante bigint`, `a_ahorro bigint >= 0`, `a_siguiente bigint >= 0`, `cerrado_por` (FK a usuario) y `cerrado_en date`. Único `(hogar_id, ref_anio, ref_mes)`.
- **`cierre_fila`**: `cierre_id` (CASCADE), `orden`, `nombre`, `plan bigint null` y `real bigint`. PK `(cierre_id, orden)`.

Se usan tablas y no `jsonb`: así no hace falta un codec JSON de R2DBC, que es otra pieza para la imagen nativa, y las filas se leen con el mismo SQL explícito que lo demás.

El cierre, sus filas y el cambio de `plan_mes.estado` a CERRADO van en una transacción.

### D3. "Mes cerrado" = plan Cerrado **o** cierre guardado

Igual que `asegurarAbierto`. Un `MesCerrado` (consulta en el puerto de cierres: `estaCerrado(hogar, ref)`) lo usan:
- `PlanUseCase`: `escenarioEditable`, `crearPlan` (un mes cerrado sin plan no gana plan) y `usar`;
- `FinanzasUseCase`: `itemDelMes`, `mesAbierto` (gasto sin ítem y aportes), `recibir` y `entregar` (las dos del mes en curso).

Cuadrar, mover y abonar no lo consultan: son de las cuentas. Su ajuste o movimiento cae en el mes en curso aunque esté cerrado, y la foto guardada no cambia, porque `vistaCierre` de un mes cerrado devuelve lo guardado.

### D4. Lectura

`GET /api/finanzas` gana `cierres`: los de `ref >= mes en curso − 3`, uno más que la ventana de planes, porque el "Sobrante de {mes}" del primer mes leído sale del cierre del anterior. Cada uno trae sus filas en orden.

El plan de un mes cerrado ya viene con `estado: CERRADO`. Un mes cerrado sin plan solo trae su cierre.

### D5. PWA

- **`superposicion.ts`**: `cierres` con los reales, `ref`, filas, montos, `cerradoPor` y `cerradoEn`. Nunca los de prueba.
- **`PuertosConectados.cierre.cerrar(ref, reparto)`**:
  1. calcula la vista con el dominio sobre lo superpuesto (`this.demoActual.cierre.vista(ref)`);
  2. toma `ultimoSeq`, el mayor `seq` de los movimientos reales de ese mes (0 si no hay);
  3. hace el POST y relee las finanzas.

  Ante `CIERRE_DESACTUALIZADO`, relee primero las finanzas y luego propaga el error, para que la pantalla ya muestre las cifras nuevas junto al mensaje (como `YA_PAGADO` en la Etapa 4).
- **Pantalla de Cierre**: en modo conectado, un mes posterior al mes en curso no muestra "Cerrar {mes}". En modo demo no cambia (el dominio deja cerrar cualquier mes).

## Risks / Trade-offs

- **[La PWA podría mandar filas mal calculadas]** → se guardan tal cual. El cálculo es el del dominio compartido, con tests. El reparto y "Sin registrar" sí los comprueba el backend. Es la decisión D1.
- **[Un cambio en el plan entre calcular y cerrar no se detecta]**, por ejemplo subir el monto de un ítem del mes. Solo cambia la columna "plan" de la foto, no el sobrante (que sale de lo real). Se acepta. Si molesta, `ultimoSeq` puede crecer a una versión del plan.
- **[Cerrar no se deshace]** → la pantalla ya pide repartir el sobrante explícitamente antes de habilitar el botón. Reabrir queda fuera.
- **[Ajustes de cuadre después de cerrar el mes en curso]** caen en un mes cerrado y no aparecen en su "Sin registrar" guardado. Es coherente con el dominio: el cierre es una foto.

## Migration Plan

1. `V6__cierre_mes.sql`, solo agrega tablas. Un test de migración no hace falta: no transforma datos.
2. Despliegue local como siempre. El VPS sigue sin backend.
3. Rollback: volver al build anterior funciona. Los cierres guardados quedan sin leer, y los planes en Cerrado siguen bloqueados, que es lo esperado.

## Open Questions

Ninguna.
