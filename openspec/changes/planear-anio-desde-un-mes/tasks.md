# Tasks

## 1. Dominio: replicar y eventos nuevos

- [x] 1.1 En el modelo, agregar `base: MesRef | null` a `PlanAnual` y `categoriaId` / `enAdelante` a `EventoAnual`. En la semilla, poner `null` / `false` en los existentes. Agregar el helper `eventosDelMes` (design D3) y usarlo en `resumenAnual`, `crearMesesDesdeAnual` e `ingresosNuevos`. Verificar con `npm run typecheck` y `npm test` en `packages/domain`: las pruebas actuales del anual siguen pasando.
- [x] 1.2 Agregar `replicarMes` y `vistaBase` (design D1 y D2). Verificar con pruebas en `rules.test.ts` de:
  - replicar octubre en 2027: filas con los totales de octubre y proyección de Esposa con lo registrado ($2.500.000);
  - FIJOS deja Variables en 0;
  - volver a replicar conserva los eventos;
  - un mes base sin plan da error.
- [x] 1.3 Agregar `editarEvento` y `quitarEvento`, y las validaciones de `agregarEvento`: categoría solo en gastos y nunca Diezmo; `enAdelante`. Verificar con pruebas: gasto en Variables suma a su fila; un ingreso "en adelante" de julio suma de julio a diciembre con su diezmo; quitar un evento lo saca del resumen.
- [x] 1.4 Hacer que `resumenAnual` dé `cambia`, `cambios`, `meses`, el agrupado de meses y `kpis.porCambios` (design D4). `crearMesesDesdeAnual` usa `base` como plantilla y pone cada evento en su categoría. Verificar con pruebas de:
  - celdas resaltadas;
  - "Septiembre a noviembre" agrupado;
  - Navidad que nace en Variables de diciembre;
  - los ítems de octubre en los meses creados.
- [x] 1.5 Agregar al puerto `PlanPort` `replicarMes`, `editarEvento`, `quitarEvento` y `vistaBase`, en el adaptador demo y en el conectado (`conectado/`). Verificar con `npm test` en `packages/domain` (demo.test.ts: replicar desde el puerto demo).

## 2. Backend

- [x] 2.1 Migración `V11__anual_desde_un_mes.sql` (design D3), y en `PlanAnual`, `AnualR2dbcAdapter` y los DTO, base y los campos nuevos de evento. Verificar con `AnualR2dbcAdapterTest`: guarda y lee base, categoría y en adelante, y los eventos viejos leen `false`/`null`.
- [x] 2.2 En `AnualUseCase` y `AnualController`, agregar `POST /api/anuales/{anio}/replicar` y `PUT` / `DELETE /api/anuales/{anio}/eventos/{id}`, con los errores de la spec (`PLAN_NO_ENCONTRADO`, `EVENTO_NO_ENCONTRADO`, `DATOS_INVALIDOS`). Verificar con escenarios nuevos en `AnualContratoTest`: replicar octubre, replicar otra vez, mes base sin plan, quitar SOAT y gasto en Variables.
- [x] 2.3 Hacer que `NacimientoMes` y "crear meses" usen la base como plantilla, los eventos en su categoría y los "en adelante". Verificar con escenarios de contrato: ítems del mes base, Navidad en Variables y aumento de julio en adelante. Correr `gradlew check` (incluye el contrato en modo AOT).
- [x] 2.4 Actualizar la tabla de endpoints de `backend/README.md` (donde viven; `backend/docs/` no los lista). Verificar que el documento lista replicar, editar y quitar evento con sus errores.

## 3. PWA: Planear a todo el ancho

- [ ] 3.1 En `planear-inicio-page.ts`:
  - la tarjeta del año: "Año {año} · Sin plan" con los pasos y "Planear {año}", o su estado y libre proyectado;
  - desde `lg`, las cuadrículas de tarjetas;
  - la ruta `planear` con `data: { ancho: 'escritorio' }`.

  Verificar con pruebas en `planear.spec.ts`: el año sin plan lleva al paso base; a 1280 px (con `matchMedia` simulado) se ven las tarjetas. Revisar a mano a 1280 px que no hay scroll horizontal.

## 4. PWA: planear el año

- [x] 4.1 Hacer el paso 1 en `anual-page.ts`: la lista de bases, la vista previa con `vistaBase`, "Replicar en los 12 meses" y la confirmación si ya hay celdas. Verificar con pruebas: replicar octubre lleva al paso 2 con las cifras de `resumenAnual`, y la confirmación aparece en 2027 de la semilla.
- [x] 4.2 Hacer el paso 2 en escritorio: los KPI con "por lo que cambia", la tabla `<table>` con celdas resaltadas (tocar una abre la edición de esa celda), la lista "Lo que cambia" y "Crear los 12 meses". Verificar con pruebas: la celda de SOAT resaltada y "Crear los 12 meses" crea los meses en Borrador.
- [x] 4.3 Hacer la hoja "Algo distinto en un mes" (`cambio-hoja.ts`, abierta desde la página, como las hojas de Planear): tipo, nombre, monto, mes, categoría o persona, solo / en adelante, "queda en", Guardar y Quitar con confirmación. Verificar con pruebas: Navidad en Variables, aumento en adelante y quitar SOAT.
- [x] 4.4 Hacer el paso 2 con menos de 1024 px: la lista de meses agrupados; tocar un mes abre la hoja con ese mes. Verificar con una prueba a 390 px: sin tabla, y "Enero" con su cambio y su libre en rojo.
- [x] 4.5 Pasar las escrituras por el adaptador HTTP (`conectado.spec.ts`): replicar, agregar, editar y quitar evento llaman a sus endpoints y el resumen se relee. Verificar con `npm test` y `ng build` en `frontend`. Documentar la vista en `frontend/README.md`.

## 5. App móvil

- [x] 5.1 En `(tabs)/planear.tsx`, la tarjeta del año. En `anual/[anio].tsx`, el paso 1, la lista de meses y la hoja de cambio (`formSheet`), con el mismo dominio. Verificar con `npm run typecheck` en `mobile` y con pruebas en `mobile/test/app.test.tsx`: replicar octubre, agregar un cambio y ver el mes en la lista.

## 6. Borrar el plan del año

- [x] 6.1 Dominio: `borrarAnual` (quita el anual y las proyecciones del año; los meses no cambian) y `borrarAnual` en `PlanPort`, el adaptador demo y el conectado (`DELETE /api/anuales/{anio}`). Verificar con pruebas en `rules.test.ts` y `conectado.spec.ts`.
- [x] 6.2 Backend: `DELETE /api/anuales/{anio}` → 204, en una transacción con las proyecciones del año; 404 `ANUAL_NO_ENCONTRADO`. Verificar con el escenario "Borrar 2027" en `AnualContratoTest`, `gradlew check` y la tabla de `backend/README.md`.
- [x] 6.3 PWA y app: "Borrar plan de {año}" en el paso 2, con la confirmación que dice qué se borra, y vuelta a Planear. Verificar con pruebas en `planear.spec.ts` y `app.test.tsx`.

## 7. Integración

- [x] 7.1 Agregar a `paridad.spec.ts` y a `app.test.tsx` el escenario "Mismo año en la app y la PWA" (replicar octubre y agregar "Revisión carro" en mayo). Verificar que las dos dan el mismo libre del año y de mayo.
- [x] 7.2 Pasar `openspec validate planear-anio-desde-un-mes --strict` sin errores.
