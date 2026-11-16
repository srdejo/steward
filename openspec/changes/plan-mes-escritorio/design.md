# Design

## Context

- **`mes-page.ts`** muestra cada estado del mes en una columna de 560 px:
  - sin plan: las formas de empezar y "ya trae";
  - Borrador: pestañas de opciones, "dejaría libre" y los grupos por categoría;
  - Activo y Cerrado: la opción en uso.
- **Hojas:** los gastos se editan en `gasto-plan-hoja.ts` y las líneas en `ingreso-hoja.ts`, siempre con "Guardar".
- **Comparar:** `compararOpciones` (`rules/plan.ts`) compara por categoría y alimenta `comparar-page.ts`, que es de solo lectura.
- **Datos que ya existen:**
  - `vistasOpciones` da por opción los grupos con sus ítems, los ingresos (`LineaIngreso`, con los aportes proyectados y el sobrante), `totalGastos` y `libre`.
  - `PlanPort.guardarItem` crea o edita un ítem y `guardarIngreso` hace lo mismo con una línea, en demo y en conectado.
  - El detalle de un gasto en Hoy sale de `detalleVencimiento` (`rules/ejecucion.ts`).
  - El saldo del hogar estimado sale de `cuentasDelHogar` (`rules/cuentas.ts`).
  - La tabla de un crédito sale de `cuotasProyectadas` (`rules/credito.ts`).
- **Fuente:** artboards `MesWeb` (una opción) y `Comparar` (varias opciones) del canvas *Presupuesto Hogar v3*.

## Goals / Non-Goals

**Goals:**
- Que el plan de un mes en escritorio diga qué cambia frente al mes anterior, cuándo sale cada pago y si la plata alcanza.
- Comparar y editar las opciones en una sola tabla cuando hay varias.
- Que todas las cifras salgan del dominio.

**Non-Goals:**
- La vista móvil del mes.
- Editar la nota de una opción.
- Deshacer.
- Llevar deuda de las tarjetas.

## Decisions

### D1. Dos vistas según el número de opciones

`mes-page.ts`, en escritorio (`anchoEscritorio()`):
- sin plan: dos columnas;
- una opción, o Activo o Cerrado: `mes-una-opcion.ts`;
- dos o más opciones en Borrador: `mes-opciones.ts`.

"Crear otra opción" (duplicar) pasa a la vista de opciones solo, porque ahora hay dos. "Usar" archiva las otras, así que el mes vuelve a la vista de una opción.

### D2. `vistaMesEscritorio(estado, ref, hoy)` para una opción

```ts
interface FilaMes {
  clave: string; nombre: string; categoriaId: Id | null; detalle: string;
  dia: number | null; monto: Pesos | null;
  diferencia: Pesos | null;      // frente a la misma fila del mes anterior; null = no estaba
  etiqueta: 'SOLO_MES' | 'PROYECTADO' | 'ULTIMO' | null;
  item: ItemPlan | null; linea: LineaIngreso | null; ingreso: boolean;
}
interface GrupoMes { titulo: string; color: string; total: Pesos; diferencia: Pesos; filas: FilaMes[]; ingresos: boolean }
interface VistaMesEscritorio {
  grupos: GrupoMes[];
  entra: Pesos; sale: Pesos; libre: Pesos;
  notaEntra: string;                 // "Incluye Prima ($3.500.000)"
  notaSale: string;                  // las dos filas que más cambian
  diezmo: { total: Pesos; detalle: string };
  porDia: Record<number, { nombre: string; monto: Pesos; ingreso: boolean; color: string }[]>;
  saldoDiario: (Pesos | null)[];     // uno por día del mes; null en los días que ya pasaron
  inicio: Pesos;                     // saldo del hogar estimado con el que empieza
  minimo: { dia: number; saldo: Pesos } | null;
  sinFecha: Pesos;                   // gastos sin día
  ingresosSinFecha: Pesos;           // extras y aportes proyectados, sin día
  seLibera: { nombre: string; monto: Pesos; desde: MesRef }[];
  anterior: MesRef;
}
```

- **Archivo:** `rules/plan-escritorio.ts`, aparte de `plan.ts`, que ya es largo. Las dos vistas traen `estadoTexto` ("Borrador · empieza en N días").
- **Orden:** los grupos de gasto siguen el orden de las categorías, con el Diezmo al final, como en el artboard.
- **Mes anterior:** el plan de `ref − 1`, opción principal. Si no tiene plan, las diferencias son null y no hay etiquetas "Solo".
- **Clave de fila:** `categoriaId + nombre`, sin mayúsculas ni espacios de más. Para los ingresos, el nombre de la línea.
- **"Último":** el ítem enlazado a un crédito cuya `cuotasProyectadas` termina (saldo 0) en `ref`. `seLibera` toma la cuota de esos créditos, desde `ref + 1`.
- **Saldo diario:**
  - empieza en el total de `cuentasDelHogar(estado, hoy)`;
  - en el mes en curso, solo cuentan los días ≥ hoy y lo no pagado;
  - en un mes futuro, cuentan todos los días;
  - cada día suma las líneas por recibir con fecha (las de un ingreso fijo, en su día de pago) y resta los gastos con día. Los ingresos sin día (extras, aportes proyectados) y el sobrante, que ya está en las cuentas, no entran;
  - un mes pasado o cerrado no tiene saldo diario;
  - el mínimo es el primer día con el saldo más bajo.

Así el aviso muestra el día y el saldo sin explicar la causa. El "la Visa y la pensión salen antes de que llegue la prima" del canvas no se genera: decir el día y el saldo basta y no exige armar una frase.

### D3. `tablaOpciones(estado, ref)` para varias opciones

Igual que en la versión anterior de esta propuesta:
- filas emparejadas por categoría y nombre;
- celdas por opción con `cambia` frente a la A;
- secciones con subtotal, totales y libres;
- cambios frente a la A;
- `igualesEnTodas`.

`compararOpciones` queda para Comparar en móvil.

### D4. Editar en la celda

- **Componente:** `MontoInput` compacto, que guarda en `(confirmado)`, es decir, con Enter o al salir del campo.
- **Escritura:** `guardarItem` con el monto nuevo, solo si cambió.
- **Celda vacía:** crea el ítem con los datos de la fila de otra opción.
- **Monto 0:** se guarda en 0; quitar sigue en la hoja.
- **Diezmo:** se abre en su hoja.
- **Mes Cerrado:** sin inputs.

### D5. Calendario y día elegido

- **Día elegido:** `diaElegido = linkedSignal(() => primer día con movimientos ≥ hoy (o 1))`.
- **Cuadrícula:** la del mes, que empieza en lunes, con el día de la semana de `fechaEnMes(ref, 1)`.
- **Filas:** tocar una fila con día elige ese día. Las celdas del calendario son `<button>` con `aria-label` "{día} de {mes}: entra $X, sale $Y".

### D6. Rutas, anchos y atajos

- **Ancho:** `/planear/:mes` pasa a `data.ancho: 'completo'`. La vista móvil se limita a 560 px en su host.
- **Comparar:** en escritorio redirige al mes con `replaceUrl`.
- **Atajos:** en un `(keydown)` del host de `mes-opciones`, no global:
  - Ctrl/Cmd + D duplica;
  - N abre "+ Agregar" en la categoría de la fila (`data-categoria`) si el foco está en una celda sin editar.

## Risks / Trade-offs

- **[Riesgo] El saldo diario es una proyección gruesa** (todas las cuentas juntas, los aportes en su día). → Va rotulado "≈", y dice que no incluye los gastos sin fecha.
- **[Riesgo] Emparejar por nombre junta dos gastos distintos que se llaman igual.** → Los repetidos dentro de una opción llevan el sufijo `#2`.
- **[Trade-off] Dos vistas de escritorio para el mismo mes.** → Comparten los componentes de celda y de hoja, y el dominio da los datos de cada una.
