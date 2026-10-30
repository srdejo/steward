## Context

`Movimiento` ya separa `ref` (el mes al que pertenece) de `fecha` (cuándo se registró), y los aportes ya usan esa separación: se registran para el mes en curso o el siguiente. Los pagos, los gastos y "Recibí" no: el backend fija `mesEnCurso()`, `PuertosConectados.mesDelBackend` rechaza otro mes y las hojas de Hoy calculan su mes con `mesDe(hoy)`. Las reglas del dominio (`marcarPago`, `registrarGasto`, `marcarRecibido`) ya reciben `ref`.

Decisiones de Daniel (2026-10-30): selector de mes en Hoy, chips de categoría, "Con la Opción A faltarían", y llamar Ejecución y Plan a Hoy y Planear.

## Goals / Non-Goals

**Goals:**
- Ejecutar el mes siguiente desde Hoy sin perder el mes en curso.
- Que los dos miembros vean lo mismo: el mes de cada registro lo guarda el backend.
- Una sola pregunta para clasificar un gasto en la hoja de Planear.

**Non-Goals:**
- Registrar en meses anteriores desde Hoy.
- Un estado nuevo del mes, o pasar el mes siguiente a Activo antes de tiempo.
- Migraciones o cambios en cómo se calculan los saldos.

## Decisions

### D1. Ventana de meses: el mes en curso y el siguiente

El backend valida en `FinanzasUseCase` que el mes sea uno de los dos, con el mismo mensaje y código que los aportes (400 `DATOS_INVALIDOS`). `mes` es opcional en el cuerpo de `POST /api/pagos`, `POST /api/gastos` y `POST /api/ingresos-fijos/{id}/recibido`; sin él es el mes en curso, así que los clientes que no lo mandan, como la app Expo, no cambian.

`POST /api/planes/{id}/escenarios/{e}/ingresos/{l}/recibido` no lleva `mes`: lo toma del plan, que debe ser del mes en curso o del siguiente.

**Alternativa descartada: cualquier mes abierto.** Abre registrar en meses lejanos por error, y Daniel solo pidió adelantarse.

### D2. El selector vive en un servicio de la PWA

`MesDeHoy` (`features/hoy`) guarda el mes elegido en un signal y lo recuerda en `localStorage`, con `try/catch`. Si lo guardado ya no es el mes en curso ni el siguiente, vuelve al mes en curso, así que al cambiar de mes nadie queda en uno viejo por accidente. `HoyPage` y sus hojas (`pagar`, `gasto`, `recibir`, `aporte`, `registros`) leen de ahí en vez de `mesDe(hoy)`.

Se usa un servicio, no un parámetro en la URL, para no cargar todas las rutas hijas de Hoy con `?mes=`.

Es del dispositivo: cada miembro puede estar viendo un mes distinto. Lo que se comparte son los registros.

### D3. El mes siguiente sigue en Borrador

Se ejecuta su opción principal, igual que un mes en curso sin opción elegida. Esto no agrega reglas: `usarEscenario` ya impide cambiar de opción cuando la principal tiene pagos (`MES_NO_BORRADOR`). Si tiene varias opciones sin elegir, Hoy muestra "Opción A · elige otra en Planear".

Sin plan, Hoy muestra lo que ya muestra hoy para un mes sin plan, con el enlace a planear ese mes.

**Alternativa descartada: que `estadoEfectivo` lo vuelva Activo.** Rompe "Un mes futuro MUST abrirse en planeación" y quitaría "+ Duplicar" antes de tiempo.

### D4. "Recibí" es por mes

El índice `movimiento_recibido_uq` ya es por ingreso fijo y mes, y `movimiento_recibido_linea_uq` por línea, así que el salario se puede recibir una vez en octubre y otra en noviembre. Recibirlo en noviembre no toca la línea de octubre: si en octubre no llegó nada, esa línea se edita o se quita en Planear.

### D5. `PuertosConectados`

`mesDelBackend(ref)` acepta el mes en curso o el siguiente, y `marcarPago`, `registrarGasto` y `marcarRecibido` mandan `mes`. Lo demás (`resumenMes(ref)`, las vistas de los registros) ya recibe el mes o lo toma del movimiento. `GET /api/finanzas` ya trae los planes y los movimientos desde dos meses antes en adelante.

### D6. Hoja del gasto: chips de categoría y tipo deducido

| Tipo de categoría | Tipo del ítem | Pregunta adicional |
| --- | --- | --- |
| `FIJO` | `FIJO` | |
| `VARIABLE` | `VARIABLE` | |
| `CREDITO` | `CREDITO` | |
| `DIEZMO` | `DIEZMO` | |
| `TARJETA` | `FIJO`, o `CUOTA` con "¿A cuotas?" | Cuota actual y total si está activo |
| `OTRO` | `FIJO`, o `VARIABLE` con "Cambia cada mes" | |

Al editar, los interruptores nacen del tipo actual del ítem. Un ítem cuyo tipo no coincide con su categoría (datos de antes) conserva su tipo mientras no se cambie la categoría, para que abrir y guardar no lo altere.

Diezmo sigue al final de los chips, porque un gasto nuevo casi nunca lo es. El backend no cambia: sigue recibiendo `categoriaId` y `tipo`.

### D7. Saldo negativo en Planear

`Opción A dejaría libre` pasa a `Con la Opción A faltarían`, con el valor absoluto en rojo, cuando `libre < 0`. En cero o positivo no cambia. Se decide en `mes-page`; no es una regla del dominio.

### D8. Ejecución y Plan son nombres visibles

Cambian los textos que ve la persona: la barra y el menú (`shell.ts`), los títulos y los enlaces de volver ("Plan"), y los accesos ("Ver ejecución", "Ver en Ejecución"). El rótulo de la pantalla pasa de "Hoy · VIE 30" a "Ejecución · VIE 30".

No cambian las rutas `/hoy` y `/planear`, para no romper enlaces ni la PWA instalada, ni las carpetas `features/hoy` y `features/planear`, ni los specs `steward-hoy` y `steward-planear`. En los specs, "Hoy" y "Planear" siguen nombrando esas pantallas; el nombre visible lo define `steward-ui-shell`.

La app Expo conserva Hoy y Planear hasta la Etapa 12.

**Alternativa descartada: renombrar también rutas y código.** Es un cambio grande que nadie ve, y mezclaría el diff con la funcionalidad.

## Risks / Trade-offs

- **[Registrar en el mes equivocado]** → El mes se ve en el título y en el selector, y la hoja lo repite ("Se registra en noviembre") cuando no es el mes en curso. Un error se corrige borrando el registro y volviéndolo a hacer: corregir no cambia el mes.
- **[Un salario recibido dos veces por error, en octubre y en noviembre]** → Se permite, porque son meses distintos. El índice no lo puede distinguir de dos salarios reales; cada uno se ve en su mes y se puede borrar.
- **[Un pago de noviembre baja el saldo de la cuenta en octubre]** → Es lo correcto: el dinero salió hoy. El saldo sigue el orden de registro.
- **[El cierre de octubre]** → Solo cuenta lo de octubre. Los registros de noviembre no aparecen ni desactualizan el cierre, porque `ultimoSeq` se compara dentro del mes.

## Migration Plan

Sin migración de base. Backend, PWA y deploy con la secuencia habitual (backup, binario nativo, contrato contra el binario, deploy), con confirmación de Daniel. Rollback: volver al binario anterior; los registros de noviembre siguen siendo válidos para él, porque son movimientos normales de un mes futuro.

## Open Questions

Ninguna.
