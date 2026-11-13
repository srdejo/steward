# Design

## Context

- El plan anual vive en el dominio compartido (`packages/domain/src/rules/anual.ts`):
  - `crearAnual` lo crea vacío.
  - `editarMontoAnual` pone una celda.
  - `agregarEvento` agrega un ingreso o gasto de un solo mes, sin categoría.
  - `editarProyeccion` pone un aporte proyectado.
  - `crearMesesDesdeAnual` crea los meses usando como plantilla el último plan anterior al año.
  - `resumenAnual` arma la vista.
- El backend replica esas reglas en Java:
  - `AnualUseCase` y `AnualController` (`/api/anuales`);
  - `NacimientoMes`, que también usa los eventos de ingreso del anual al crear cualquier mes;
  - la migración `V7__plan_anual.sql`.
- En el dominio, `ingresosNuevos` de `rules/plan.ts` hace lo mismo con los eventos.
- En modo conectado, la PWA y la app calculan `resumenAnual` en el dispositivo, sobre las finanzas descargadas. Las escrituras van a los endpoints.
- No se pueden corregir ni quitar eventos.
- Pantallas que cambian:
  - `frontend/src/app/features/planear/anual-page.ts`: tabla con scroll horizontal y "Crear plan anual".
  - `planear-inicio-page.ts`: columna de 560 px.
  - En la app, `mobile/src/app/(app)/anual/[anio].tsx` y `(tabs)/planear.tsx`.
- Fuente de diseño: canvas "Presupuesto Hogar v3". Los artboards usan $1.500.000 de aportes de Esposa; la semilla registra $2.500.000 en octubre, así que las cifras de las pruebas salen de la semilla y no del canvas.

## Goals / Non-Goals

**Goals:**
- Que "planear el año" sea replicar un mes y agregar lo distinto, con las mismas reglas en el dominio y en el backend.
- Los años que ya tienen plan anual (con celdas y eventos sin categoría) siguen funcionando sin migrar datos.
- Una sola fuente para las cifras: `resumenAnual` da las celdas, cuáles cambian, la lista "lo que cambia" y los meses agrupados. Las pantallas solo pintan.

**Non-Goals:**
- Elegir en qué meses replicar (los chips "Replicar en" del canvas no se implementan). Al crear los meses, los que ya tienen plan no cambian.
- Copiar ingresos extra del mes base ni sus ítems de diezmo.
- Editar en la tabla web varias celdas a la vez, o arrastrar valores.
- Cambiar el menú lateral del shell.

## Decisions

### D1. Replicar es una operación sobre un plan anual, no otra forma de crearlo

`replicarMes(estado, { anio, base, hoy })`, con `base` igual a `{ tipo: 'MES', ref }`, `{ tipo: 'FIJOS' }` o `{ tipo: 'CERO' }`:
- crea el anual si no existe (mismas reglas que `crearAnual`);
- reemplaza todas las filas;
- reemplaza las proyecciones del año;
- guarda `base: MesRef | null` (para FIJOS, el ref del plan usado);
- conserva los eventos.

Así, "volver a replicar" es la misma operación. En el backend es `POST /api/anuales/{anio}/replicar`. `crearAnual` y su endpoint se mantienen para compatibilidad.

Alternativa descartada: llenar desde la pantalla con 60 llamadas a `editarMontoAnual`. Es lento en modo conectado y deja el anual a medias si una falla.

### D2. Qué se copia de la base

- Las filas: por categoría (salvo Diezmo), la suma de los ítems de la opción en uso (o de la Opción A) del mes base.
- Con FIJOS:
  - la base es el último plan anterior al año;
  - los ítems `VARIABLE` no cuentan (como "Solo fijos e ingresos" al crear un mes).
- Con CERO, todo en 0.
- Las proyecciones, por miembro y en los 12 meses: la suma de sus movimientos `APORTE` del mes base, o su proyección de ese mes si no registró aportes. Un miembro sin ninguna de las dos no gana proyección.

### D3. Los eventos ganan categoría y "en adelante"

En `EventoAnual` se agregan:
- `categoriaId: Id | null`: solo en gastos y nunca Diezmo; null significa "Eventos del año".
- `enAdelante: boolean`: aplica del mes del evento a diciembre.

Un helper `eventosDelMes(anual, mes)` devuelve los que aplican. Lo usan:
- `resumenAnual`;
- `crearMesesDesdeAnual`;
- `ingresosNuevos`;
- en el backend, `NacimientoMes`, para que un aumento "en adelante" también entre al crear un mes a mano.

Para corregir y quitar se agregan `editarEvento` y `quitarEvento` (`PUT` y `DELETE /api/anuales/{anio}/eventos/{id}`).

La migración `V11__anual_desde_un_mes.sql` agrega columnas que admiten nulos o tienen valor por defecto, así los eventos existentes no cambian:
- `plan_anual.base_anio`, `plan_anual.base_mes`;
- `anual_evento.categoria_id` (FK diferida, como en V7);
- `anual_evento.en_adelante boolean NOT NULL DEFAULT false`.

### D4. Lo que devuelve `resumenAnual`

- Los gastos con categoría se suman a la fila de su categoría. Los gastos sin categoría van en la fila "Eventos del año". Los ingresos siguen agrupados por nombre.
- Cada fila gana `cambia: boolean[]`, que es `true` cuando el mes:
  - tiene un evento que lo toca, o
  - tiene una celda distinta de la base. La base es el valor que más se repite en esa fila, y no se guarda un valor original.

  Así, una celda editada a mano también se ve resaltada, sin guardar nada más.
- `cambios: VistaCambio[]`: cada evento con su mes, tipo, categoría, monto, diezmo y "en adelante", ordenado por mes.
- `meses: { mes, libre, cambios: string[] }[]`: para la lista móvil. Un helper `agruparMeses` junta los meses seguidos sin cambios ("Septiembre a noviembre").
- `kpis.porCambios`: el libre del año menos el libre que habría sin eventos ni celdas distintas de la base.

### D5. Pantallas

- **PWA, `/planear/anual/:anio`:** si no tiene plan anual, o se pide `?paso=base`, muestra el paso 1. Si no, muestra el paso 2.
  - El paso 1 lee los planes del hogar con `plan.inicio()` y la vista previa con `vistaBase(estado, base)`, una función nueva del dominio con las filas y el libre que daría.
  - El paso 2 depende del ancho:
    - desde 1024 px (con el mismo `matchMedia` que Hoy), la tabla con `<table>`, en un contenedor con scroll horizontal propio;
    - con menos, la lista de meses.
  - "Algo distinto en un mes" es una hoja (`cambio-hoja.ts`) que abre la misma página, como las hojas de gasto e ingreso de Planear, en escritorio y en móvil. Se descartaron las rutas hijas: la hoja necesita el resumen y las categorías que la página ya tiene.
  - "{Mes} queda en" sale de `previsualizarEvento` del dominio (el resumen con el cambio aplicado), así incluye el diezmo de un ingreso.
- **PWA, `/planear`:** desde `lg`, se ve con la tarjeta del año y las cuadrículas de tarjetas, en una ruta con `data: { ancho: 'escritorio' }`, como Hoy.
- **App:** `anual/[anio].tsx` muestra los pasos y la lista de meses. El cambio se edita en una hoja (`formSheet`), igual que las demás.

### D6. Contrato y paridad

- El contrato del backend (pruebas de `AnualController`) agrega replicar, editar y quitar evento, y los nuevos campos de evento.
- `paridad.spec.ts` y `mobile/test/app.test.tsx` agregan la secuencia del escenario "Mismo año en la app y la PWA".

## Risks / Trade-offs

- **Replicar reemplaza celdas que se editaron a mano.** Por eso pide confirmación cuando ya hay celdas. Los eventos se conservan porque son lo que más cuesta volver a escribir.
- **"Cambia" se calcula con el valor más repetido.** Si en una fila la mitad de los meses son distintos, el resaltado puede marcar los meses "normales". Se acepta: es una ayuda visual, y la lista "Lo que cambia" sí es exacta.
- **`NacimientoMes` y `ingresosNuevos` empiezan a usar eventos "en adelante".** Un mes creado a mano en julio, con un aumento desde julio, gana la línea del aumento. Es el comportamiento esperado, pero cambia meses que antes no tenían esa línea. Solo afecta a eventos nuevos.
- **Dos años con plan anual en la semilla.** Las pruebas existentes del anual 2027 siguen pasando porque `base` es null y los eventos no tienen categoría.
