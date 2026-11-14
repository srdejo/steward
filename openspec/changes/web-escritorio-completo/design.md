# Design

## Context

- `core/layout/shell.ts` arma el menú lateral (desde 1024 px) y la barra inferior con `DESTINOS` (Ejecución, Plan, Cuentas). El ancho del contenido sale de `data.ancho` de la ruta:
  - `'escritorio'`: 560 px en móvil y hasta 1360 px desde 1024 px. Lo usan Hoy y Planear.
  - `'completo'`: todo el ancho. Lo usan Comparar y Anual.
  - Sin dato: 560 px.
- Hoy y Planear ya tienen su vista de escritorio:
  - `hoy-escritorio.ts`, un componente aparte que `hoy-page.ts` muestra con `matchMedia(ESCRITORIO)`.
  - `planear-inicio-page.ts`, con una señal `escritorio` y un `@if` en la plantilla.
- Páginas que cambian:
  - `cuentas-page.ts`: lista con hojas para agregar, mover y crédito.
  - `cuadrar-page.ts`: página aparte, en `/cuentas/cuadrar`.
  - `cierre-page.ts`, `ajustes-page.ts` y `acceso-page.ts`: columnas de 560 px.
- Datos disponibles:
  - `CuentasPort` da `cuentas(filtro)`, `creditos()`, `movimientos(cuentaId)` (por cuenta, con `descripcion`, `efecto` y `corregible`), `cuadrar` y `mover`.
  - `CierrePort.vista(ref)` da filas plan/real, `sinRegistrar`, `sobrante` y `librePlaneado`.
  - No hay una lista de movimientos de todo el hogar.
- Fuente: canvas "Presupuesto Hogar v3", artboards `CuentasWeb`, `CierreWeb`, `AjustesWeb`, `AccesoWeb` y `HoyWeb`.

## Goals / Non-Goals

**Goals:**
- Que las cuatro pantallas que faltan usen el ancho del escritorio como en el canvas, con las mismas reglas que en móvil.
- Ajustes en el menú lateral.
- Sin cambios de dominio, backend ni app.

**Non-Goals:**
- Tarjetas (corte, pago, uso), métodos de crédito y proyección de deudas: van en el cambio de tarjetas y créditos.
- Llaves de acceso en Ajustes.
- Movimientos con origen "Su cuenta" (EXTERNA) en "Movimientos recientes": no pertenecen a ninguna cuenta.

## Decisions

### D1. Mismo patrón que Planear: `escritorio` en la página, no componentes aparte

Cuentas, Cierre, Ajustes y Acceso leen `matchMedia(ESCRITORIO)` en una señal, como `planear-inicio-page.ts`, y la plantilla elige entre la vista móvil y la de escritorio. Las hojas y los diálogos (`app-hoja`) son los mismos en las dos vistas.

La lógica de matchMedia está copiada en `planear-inicio-page.ts` y en `hoy-page.ts`. Se saca a una función `anchoEscritorio()` en `shared/` (devuelve una `Signal<boolean>` y limpia el listener con `DestroyRef`) y las páginas la usan.

*Alternativa descartada:* un componente de escritorio por página, como `hoy-escritorio.ts`. Duplica las hojas y su estado. Hoy lo justificaba porque su vista era muy distinta, pero aquí cambia sobre todo el layout.

### D2. Ancho de las rutas

- `/cuentas`, `/ajustes` y `/planear/:mes/cierre` pasan a `data.ancho: 'escritorio'`.
- `/acceso` está fuera del Shell, así que su ancho lo maneja la propia página.
- `/cuentas/cuadrar` se queda igual en móvil. En escritorio, el cuadre vive en Cuentas, pero la ruta sigue funcionando (enlaces guardados, pruebas).

### D3. Cuadre dentro de Cuentas en escritorio

La lógica de `cuadrar-page.ts` (saldos escritos por cuenta, `diferencia`, `sinRegistrar` y `guardar`) se saca a una clase `EstadoCuadre`, que se instancia en el componente con señales, y la usan las dos páginas. En escritorio, la tabla se pinta dentro de Cuentas y "Guardar saldos" se queda en `/cuentas`: limpia lo escrito y las consultas se recargan solas.

La diferencia se muestra como en el canvas: banco − estimado, con signo ("−$170.000" cuando el banco dice menos), y "Cuadra" si es cero. Así se lee igual que en el cuadre móvil, que ya pinta `-d`.

### D4. Movimientos recientes del hogar, armados en la PWA

Con las cuentas cargadas, la página pide `movimientos(id)` de cada una en paralelo y los une:
- Ordena por `movimiento.seq`, de mayor a menor, y muestra los 20 primeros.
- Elimina duplicados por `movimiento.id`, porque una transferencia sale en las dos cuentas. Se muestra con la cuenta de origen.

El filtro por cuenta usa la lista de esa cuenta. "Quién" sale de `movimiento.usuarioId` y `MiembrosHogar`.

Tocar una fila corregible abre `/cuentas/cuenta/:id/registro/:registroId`, la hoja que ya existe. Las demás abren su cuenta.

*Alternativa descartada:* un puerto `movimientosHogar()`, que tocaría el dominio, los dos adaptadores y el backend. Con pocas cuentas, N llamadas al adaptador conectado salen de las finanzas ya descargadas y no van a la red. Se puede revisar si crece.

### D5. "Para tener en cuenta", en la página

Sale de `VistaCierre` con una función pura en `cierre-page.ts`. No es regla de negocio, solo cómo se presenta. Da hasta tres avisos:
1. "$X sin registrar", si `sinRegistrar > 0`.
2. Cada fila de gasto con `real > plan` ("{Categoría} +$X sobre el plan").
3. La diferencia de ingresos (la primera fila), si no es cero.

Los textos largos del canvas ("Esposa aportó más de lo proyectado", "pasó el plan dos meses seguidos") necesitan historia y se dejan para después.

### D6. Ajustes en escritorio

- La cuadrícula es `grid-cols-[repeat(auto-fit,minmax(420px,1fr))]`.
- "Invitar por correo" en la tarjeta usa el mismo `puertos.hogar.invitar`, con su propio campo y mensaje.
- El nombre del hogar se muestra como texto, no como campo editable: renombrar el hogar no existe hoy.
- Los toggles de seguridad son los mismos `app-interruptor`.

### D7. Hoy: "Cerrar {mes}"

En `hoy-escritorio.ts`, un enlace a `/planear/{clave}/cierre` junto a "+ Aporte" y "+ Gasto", visible solo si el mes mostrado es el mes en curso y no está CERRADO.

## Risks / Trade-offs

- **[Riesgo]** La tabla del cuadre con seis columnas no cabe a 1024 px con el menú lateral. → Mitigación: la tabla va en un contenedor con `overflow-x: auto` y `min-width`, como en el canvas, sin scroll horizontal de la página.
- **[Trade-off]** N llamadas a `movimientos()` en modo conectado. → Salen de las finanzas ya cargadas en memoria y no van a la red (verificar en el adaptador conectado; si alguna fuera a la red, se limita a las primeras 8 cuentas).
- **[Riesgo]** Dos lugares para cuadrar en escritorio (Cuentas y `/cuentas/cuadrar`). → La lógica es una sola (`EstadoCuadre`). La ruta queda para móvil.
