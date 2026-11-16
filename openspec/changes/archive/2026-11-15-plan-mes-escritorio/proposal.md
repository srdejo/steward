# Proposal

## Why

En escritorio, el plan de un mes (`/planear/2026-12`) sigue siendo la columna móvil de 560 px. Con ese ancho se pierden tres cosas:
- no se ve de un vistazo qué cambia frente al mes anterior;
- no se ve qué día sale cada pago;
- no se ve si la plata alcanza en el punto más bajo del mes.

Cuando hay varias opciones, se ven de a una, y para compararlas hay que ir a otra pantalla (Comparar), que es de solo lectura.

Fuente: canvas *Presupuesto Hogar v3*, artboards:
- `MesWeb` ("Plan de un mes · diciembre (web)"): un mes con una sola opción;
- `Comparar` ("Plan del mes · opciones (web)"): un mes con varias opciones.

## What Changes

Desde 1024 px, `/planear/:mes` usa todo el ancho, con una de dos vistas según cuántas opciones tenga el mes.

**Un mes con una opción (`MesWeb`):** en Borrador, en Activo o, en solo lectura, en Cerrado.
- **Encabezado:**
  - "‹ Planear";
  - flechas para ir al mes anterior y al siguiente;
  - el estado ("Borrador · empieza en N días");
  - "Crear otra opción", que duplica y pasa a la vista de opciones;
  - en Borrador, "Usar este plan en {mes}".
- **Indicadores:**
  - **Entra**, con la nota de los ingresos extra ("Incluye la prima de $3.500.000");
  - **Sale**, con lo que más cambia;
  - **Quedaría libre**;
  - **Diezmo**, con su desglose por ingreso.
- **Tabla del mes:**
  - grupos (Ingresos, Gastos fijos, Variables, Tarjetas, Créditos, Diezmo) con su total y su diferencia frente al mes anterior;
  - cada fila con su detalle, día, monto, "vs {mes anterior}" y una etiqueta:
    - "Solo {mes}": no estaba el mes anterior;
    - "Proyectado": un aporte proyectado, en gris;
    - "Último": la última cuota de un crédito;
  - los montos se editan en la celda; el nombre abre su hoja; "+ Agregar a {grupo}".
- **Calendario de pagos:**
  - el mes en una cuadrícula de semanas, con lo que entra y sale cada día;
  - al tocar un día, o una fila de la tabla, se ve lo que pasa ese día.
- **Plata en cuentas, día a día:**
  - barras del saldo proyectado de cada día, desde el saldo del hogar estimado, con los ingresos y gastos con fecha;
  - el punto más bajo, con un aviso si queda justo;
  - los gastos sin fecha se nombran aparte.
- **"Se libera $X":** si un crédito termina este mes, cuánto queda libre desde el siguiente.

**Un mes con varias opciones (`Comparar`):** la tabla de opciones lado a lado.
- **Edición:** la opción "Editando" se edita en la celda, y las celdas distintas de la A se resaltan.
- **"Solo lo que cambia":** deja solo las filas que difieren entre opciones.
- **Al lado:**
  - la opción elegida, con sus cambios frente a la A y su nota;
  - "{Mes} ya trae";
  - los atajos.
- **"Usar {opción} para {mes}":** después, el mes pasa a la vista de una opción.

**Sin plan:** las formas de empezar y lo que el mes ya trae, una al lado de la otra.

**Atajos:** Ctrl + D duplica la opción; N agrega un gasto en la categoría de la fila.

**Comparar:** en escritorio, la ruta `/comparar` lleva al mes. En móvil sigue igual.

**No se incluye:**
- Editar la nota de una opción: no existe en el backend.
- Cambiar la vista móvil del mes.
- "Debes $X" en las tarjetas: no llevan deuda.

**Otras decisiones:**
- El canvas pone "Mastercard termina en diciembre": como las tarjetas no llevan deuda, "Se libera" sale de los créditos que terminan, no de las tarjetas.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-planear`:
  - nuevos requisitos "Plan de un mes en escritorio" y "Opciones del mes en escritorio";
  - "Comparar escenarios": en escritorio, Comparar es el mismo mes.

## Impact

- **Dominio** (`rules/plan.ts`), sin backend nuevo:
  - `tablaOpciones(estado, ref)`: filas por gasto emparejadas entre opciones;
  - `vistaMesEscritorio(estado, ref, hoy)`: grupos con la diferencia frente al mes anterior, etiquetas, indicadores, los movimientos por día del mes, el saldo proyectado día a día y lo que se libera.
  - Las dos se exponen en `PlanPort` (demo y conectado). Editar una celda usa `guardarItem`.
- **PWA:**
  - `features/planear/mes-page.ts` monta en escritorio `mes-una-opcion.ts` o `mes-opciones.ts`;
  - `data.ancho: 'completo'` en `/planear/:mes`, y Comparar redirige en escritorio;
  - pruebas en `planear.spec.ts`.
- Sin cambios en la app móvil ni en el backend.
