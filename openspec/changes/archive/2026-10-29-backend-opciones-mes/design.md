# Design

## Context

Estado al empezar (ver proposal.md, "Why"):

- **Backend.** El de la Etapa 6 (`backend-cierre-mes`).
  - **Ya admite varias opciones por mes**, desde la Etapa 4: `escenario` con letra, autor, nota y archivado; índice único `(plan_id, letra)`; `plan_mes.escenario_activo_id`.
  - **`PlanUseCase`** crea el plan con la Opción A, edita sus ítems (`escenarioEditable`, por id de opción) y la usa. `planes.usar` ya archiva las demás.
  - **`PlanMes.estadoEn(hoy)`** da el estado efectivo: un Borrador con opción elegida es Activo cuando llega su mes.
- **Dominio compartido.**
  - `duplicarEscenario` (copia sin avanzar cuotas, siguiente letra, `MUCHAS_OPCIONES`), `usarEscenario` y `probarAbonoComoOpcion`. Este último crea el mes si no existe y exige `plan.estado === 'BORRADOR'`, con el estado guardado, no el efectivo.
  - `duplicarEscenario` y `usarEscenario` solo bloquean CERRADO.
  - Las vistas: `vistasOpciones`, `compararOpciones` y `nombreAutor`.
- **PWA.** `PuertosConectados.plan.duplicar` y `cuentas.probarComoOpcion` rechazan con `ETAPA_7`. Mes y Comparar muestran avisos en modo conectado. `usar` ya va al backend.

Decisión de Daniel al proponer: varias opciones solo en Borrador.

## Goals / Non-Goals

**Goals:**
- Que varias opciones por mes, Comparar y "Usar {X}" sean reales y compartidos.
- Que los pagos de un mes nunca queden contra una opción archivada.
- Que demo y conectado apliquen la misma regla de Borrador.

**Non-Goals:**
- Crear una opción en blanco. El diseño solo duplica; "+ Duplicar" es la única entrada.
- Desarchivar opciones, o quitar una archivada desde la PWA (las archivadas no se muestran; la API sí lo permite si no está en uso).
- Editar la nota de una opción después de creada.
- El plan anual y "Crear meses desde este plan" (Etapa 8).

## Decisions

### D1. "Borrador" es el estado efectivo, en el dominio y en el backend

`esBorrador(plan, hoy) = estadoEfectivo(plan, hoy) === 'BORRADOR'`, que en el backend es `plan.estadoEn(hoy) == BORRADOR`. Es decir:
- un mes futuro, elegida o no su opción;
- el mes en curso (o uno pasado) que todavía no tiene opción elegida.

Reglas:

| Acción | Borrador | Activo | Cerrado |
|---|---|---|---|
| Duplicar, probar un abono | sí | `MES_NO_BORRADOR` | `MES_CERRADO` |
| Usar otra opción | sí | `MES_NO_BORRADOR` | `MES_CERRADO` |
| Usar la opción en uso | sí | sí, sin cambios | `MES_CERRADO` |
| Quitar una opción (D5) | sí | `MES_NO_BORRADOR` | `MES_CERRADO` |
| Editar ítems de una opción | sí | sí | `MES_CERRADO` |

El dominio cambia de firma:
- `duplicarEscenario(estado, { ..., hoy })`;
- `usarEscenario(estado, { ..., hoy })`;
- `probarAbonoComoOpcion(estado, { ..., hoy })`.

Pasa a usar el estado efectivo en vez del guardado, y el adaptador de prueba pasa `hoy()`. Los tests del dominio que duplican noviembre siguen igual, porque noviembre está en Borrador el 26 oct.

`probarAbonoComoOpcion` ya exigía Borrador, pero con el estado guardado. Ahora usa el efectivo y el mismo código `MES_NO_BORRADOR`.

### D2. API

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `POST /api/planes/{id}/escenarios` | `{"desde": escenarioId, "nota"?}` | 201, el plan completo |
| `DELETE /api/planes/{id}/escenarios/{escenarioId}` | — | 204 |
| `POST /api/creditos/{id}/probar` | `{"anio", "mes", "abono"}` | 201, `{planId, escenarioId}` |

`POST /api/planes/{id}/usar` no cambia de forma, solo gana la regla de D1.

Duplicar responde el plan entero, porque la PWA relee las finanzas de todos modos y al contrato le sirve ver las letras.

### D3. Backend

- **`IPlanPersistencePort.crearEscenario(Escenario)`**: inserta la opción con sus ítems (ids nuevos). La letra la elige el caso de uso: la primera de A a Z no usada. Si dos personas duplican a la vez y eligen la misma letra, el índice único `(plan_id, letra)` falla. Se traduce a un reintento con la siguiente letra, una vez; si vuelve a fallar, `MUCHAS_OPCIONES` no aplica y responde 409 `YA_EXISTE`. Es raro y se acepta.
- **`PlanUseCase.duplicar`** reproduce `duplicarEscenario`: copia los ítems sin avanzar cuotas, con el `creditoId`, nota opcional (hasta 60) y autor la sesión.
- **`PlanUseCase.probarAbono`**:
  1. `crearPlan(ref, COPIAR)` si no hay plan;
  2. duplica la principal con nota "abono a crédito";
  3. agrega el ítem del abono con `categoriaDeCreditos` (de la Etapa 5).

  Todo en una transacción. Vive en `PlanUseCase`, que ya tiene los puertos de planes, categorías y créditos. La ruta va en `CuentasController` por coherencia de URL (`/api/creditos/...`), y llama al puerto de servicio del plan.
- **`PlanUseCase.usar`**: aplica D1 con `IClockPort`, que `PlanUseCase` todavía no tenía.

### D4. PWA

- **`PuertosConectados.plan.duplicar(planId, escenarioId)`** → POST, relee y devuelve el id de la opción nueva. Es la de la letra más alta del plan leído: la PWA lo necesita para abrirla.
- **`cuentas.probarComoOpcion`** → POST, relee y devuelve `{planId, escenarioId}` del backend.
- **Fuera los rechazos `ETAPA_7`** y los avisos:
  - "+ Duplicar" en Mes en borrador;
  - Comparar "llega en una próxima versión";
  - "Probarlo como opción".

  `MES_NO_BORRADOR` llega del backend, o del dominio en modo demo, y la pantalla lo muestra con su mensaje: "{Mes} ya está en curso; su plan no gana opciones".
- **Hoy, Planear y el Cierre no cambian.** Usan `escenarioPrincipal`, que con varias opciones ya devuelve la elegida o la primera vigente.

### D5. Quitar una opción (pedido de Daniel al revisar la propuesta)

Se borra de verdad (`DELETE FROM escenario`, con cascada a `item_plan`). No se archiva, porque archivar ya es lo que hace "Usar" con las que no se eligen; esta es la que el hogar descartó.

Reglas, en este orden:
1. **Mes en Borrador** (D1). Si no, `MES_NO_BORRADOR` o `MES_CERRADO`.
2. **No es la opción en uso** (`escenario_activo_id`). Si no, `OPCION_EN_USO`: primero se usa otra.
3. **Queda al menos otra opción vigente.** Si no, `ULTIMA_OPCION`.
4. **Ninguno de sus ítems tiene pagos o gastos** (`hayDeItem`). Si no, `OPCION_CON_PAGOS`. En Borrador solo puede pasar en el mes en curso sin opción elegida.

**Dominio:** `quitarEscenario(estado, { planId, escenarioId, hoy })` con las mismas reglas, y `PlanPort.quitarOpcion(planId, escenarioId)`. La letra queda libre: `siguienteLetra` ya toma la primera no usada.

**PWA:**
- cada opción de Mes en borrador gana "Quitar opción" cuando hay más de una vigente y no es la que está en uso;
- tocarlo abre una hoja de confirmación de la app ("¿Quitar la Opción {X}? Se borran sus gastos."), no un diálogo del navegador.

## Risks / Trade-offs

- **[Un pago contra una opción que después se archiva]** → no puede pasar: solo se cambia de opción en Borrador, y en Borrador no se paga porque Hoy solo muestra el mes en curso. Si el mes en curso sigue en Borrador (sin opción elegida), pagar ya lo hace contra la principal. Elegirla después es elegir la misma, y elegir otra con pagos sí sería posible. Para cubrirlo, `usar` también responde `MES_NO_BORRADOR` si la opción en uso **o la principal** tiene pagos o gastos en el mes y la elegida es otra. Lo comprueba un test de contrato.
- **[Cambio de firma en el dominio]** → afecta al adaptador de prueba y a sus tests. La app Expo usa el adaptador, no las funciones directas, así que no cambia.
- **[Dos duplicados a la vez]** → D3, con reintento una vez.

## Migration Plan

Sin migración. Despliegue local como siempre. Rollback: volver al build anterior funciona; las opciones extra quedan guardadas y la versión anterior las muestra, porque ya leía todas.

## Open Questions

Ninguna.
