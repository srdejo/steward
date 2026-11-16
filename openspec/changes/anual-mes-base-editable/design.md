# Design

## Context

- **Hoy** (`anual-opciones-y-meses`):
  - cada opción del año guarda sus celdas, eventos y `base` (el mes que se replicó);
  - la plantilla de los meses es el plan de ese mes (o el último antes del año), leído en el momento;
  - `replicarMes` llena las celdas desde un mes y descuenta los créditos que terminan;
  - la página del año tiene un paso 1 (elegir mes y replicar) que solo se ve en Borrador.
- **El pedido:** crear una opción desde un mes, ajustar ese mes y después agregar eventos. Es solo para la web.

## Goals / Non-Goals

**Goals:**
- Un mes base propio de cada opción, editable sin tocar el mes real.
- Que los meses que se crean o actualizan desde la opción salgan de ese mes base.
- Llegar al editor tanto desde una opción nueva como desde una que ya existe.

**Non-Goals:**
- Ingresos en el mes base: siguen siendo los fijos y los aportes proyectados.
- La pantalla en la app.
- Opciones distintas de un mismo mes real.

## Decisions

### D1. Modelo

```ts
interface MesBaseAnual { origen: MesRef | null; items: ItemPlan[] }   // sin items de diezmo
interface OpcionAnual { …; base: MesRef | null; mesBase: MesBaseAnual | null }
```

- **`base`:** se conserva como "el mes que se replicó" para los datos de antes. Cuando hay `mesBase`, `base = mesBase.origen`.
- **Plantilla de los meses** (`plantillaDe`): `mesBase.items` si existe; si no, como hoy.
- **Avance de las compras a cuotas:** cuenta desde `mesBase.origen` (o `base`); un mes base desde cero no tiene origen y no avanza.

### D2. Reglas del dominio

| Regla | Qué hace |
|---|---|
| `nuevaOpcionDesdeBase(estado, { anio, desde: BaseAnual, creadoPor, hoy })` | Crea la opción con la siguiente letra, `mesBase` copiado de la fuente con ids nuevos y sin diezmo, y sus celdas como `usarMesBase`. Si no hay anual, lo crea. |
| `copiarMesBase(estado, { anio, opcionId, desde })` | Reemplaza `mesBase` (las celdas no cambian). |
| `guardarItemBase` y `quitarItemBase` | Validan como `guardarItem`. La categoría Diezmo da `DATOS_INVALIDOS`. |
| `usarMesBase(estado, { anio, opcionId, hoy })` | Las celdas de la opción, como `replicarMes`, pero desde `mesBase.items`. No toca las proyecciones; los eventos siguen. |
| `vistaMesBase(estado, anio, opcionId, hoy)` | Arma lo que ve el editor (ver abajo). |

`vistaMesBase` devuelve:
- los grupos por categoría con sus filas (detalle como en el plan de un mes, `terminaEn` si el crédito termina en el año);
- `entra` (fijos más aportes proyectados de enero del año);
- `sale`, `diezmo` y `libreMes`;
- `libreAnio`, que descuenta mes a mes las cuotas que terminan;
- `origen`.

### D3. Backend

- **V15:** `anual_base_item` (`id, opcion_id → anual_opcion ON DELETE CASCADE, categoria_id, nombre, monto, dia_vence, tipo, cuota_actual, cuota_total, credito_id, tarjeta_id, orden`) y `anual_opcion.con_mes_base boolean NOT NULL DEFAULT false`. El origen va en `base_anio` y `base_mes`.
- **Endpoints:**
  - `POST /api/anuales/{anio}/opciones`: `{desdeId}` (duplicar, también copia el mes base) o `{desde}` (nueva desde un mes base). Responde 201 con la opción.
  - `PUT /api/anuales/{anio}/opciones/{id}/base` `{desde}`: copia otro mes.
  - `POST /api/anuales/{anio}/opciones/{id}/base/items`, `PUT .../items/{itemId}` y `DELETE .../items/{itemId}`.
  - `POST /api/anuales/{anio}/opciones/{id}/base/usar`.
- **Lectura:** el anual de `GET /api/finanzas` trae `mesBase: {origen, items} | null` en cada opción.
- **`crearOActualizarMeses`:** usa `mesBase.items` como plantilla cuando la opción lo tiene.

### D4. Web

- **Ruta:** `planear/anual/:anio/base` (`data.ancho: 'completo'`), `anual-base-page.ts`.
  - Las celdas usan `MontoInput` compacto, y "+ Agregar" usa `gasto-plan-hoja` en un modo "mes base" que llama a `guardarItemBase`.
  - Con `?opcion=C`. Sin opción, la en uso o la A.
- **La hoja de nueva opción:** `nueva-opcion-hoja.ts`, reutiliza las fuentes del paso 1 (`opcionesBase`).
- **"Cambiar mes base":** siempre visible.
  - Si la opción no tiene `mesBase`, primero `copiarMesBase` desde su `base` (o el mes en curso) y después abre el editor.
  - El paso 1 viejo (`?paso=base`) queda para el año sin plan: elegir la fuente crea la Opción A con su mes base y abre el editor.

## Risks / Trade-offs

- **[Riesgo] Dos fuentes de la plantilla** (el mes real o el mes base). → La regla es simple: si hay `mesBase`, manda. Y "Cambiar mes base" lo crea.
- **[Trade-off] El mes base copia los ítems y deja de seguir al mes real.** → Es lo que se pide: ajustarlo sin tocar el mes real.
