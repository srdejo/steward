## Context

Los gastos no tienen una identidad entre meses: cada `PlanMes` tiene sus opciones con sus `ItemPlan`, copiados al crear el mes (`copiarItems` en el dominio, `PlanUseCase` en el backend) o desde el mes base del plan anual (`anual_base_item`). Editar un ítem (`PUT /api/planes/{id}/escenarios/{e}/items/{itemId}`) cambia solo esa copia. La app 2.3.1 en App Store envía `ItemRequest` sin campos nuevos.

## Goals / Non-Goals

**Goals:**
- Guardar enlace y código en el ítem, que viaje con las copias, y una forma de llevarlo a los meses ya planeados en un solo paso.
- Que no cambie nada para quien no lo use.

**Non-Goals:**
- Un catálogo de "gastos fijos" con identidad propia entre meses.
- Guardar contraseñas, pagar desde Steward o leer el estado del pago en el portal.
- Datos de pago en ingresos, créditos o tarjetas.

## Decisions

**D1. Los datos van en el ítem, no en una tabla aparte por nombre.** Dos columnas (`enlace_pago text`, `codigo_pago text`) en `item_plan` y `anual_base_item`. Así las copias existentes (crear mes, mes base, meses desde el anual, duplicar opción) los llevan sin lógica nueva, y renombrar un gasto no rompe nada. Alternativa descartada: una tabla `dato_pago` por hogar y nombre; evita propagar, pero ata el dato al nombre, aparece en gastos que no se quieren, y suma una pantalla nueva.

**D2. "Aplicar a los meses ya planeados" es una opción del guardar.** `ItemRequest.aplicarAMeses: Boolean` (null = false). En el dominio, `guardarItem(..., { aplicarAMeses })`. Solo actúa si los datos de pago cambiaron. Coincide por categoría y nombre normalizado (`trim().toLowerCase()`), en las otras opciones del mismo mes y en los meses con `ref` posterior que no estén `CERRADO` (todas las opciones) y en los mes base de las opciones anuales con `anio >= ref.anio`. Se hace en la misma transacción. Alternativa: endpoint aparte; descartado porque obliga a dos llamadas y a manejar fallos parciales.

**D3. Ausente conserva, vacío quita.** En el PUT, `enlacePago`/`codigoPago` null (o ausentes) conservan lo guardado; `""` lo quita. Así la app 2.3.1 no borra datos al editar un monto. El POST trata null como sin datos. Mismo patrón que `primeraCuota` en `credito-primera-cuota`.

**D4. Validación del enlace.** Solo `http://` o `https://` (ignorando mayúsculas), sin espacios, hasta 500 caracteres; el código hasta 60. Evita `javascript:` y otros esquemas al abrirlo con `target="_blank" rel="noopener noreferrer"` en la PWA y `Linking.openURL` en la app. Se valida en el dominio y en el backend; error `DATOS_INVALIDOS`. Ítems `DIEZMO`: se ignoran (null).

**D5. UI mínima.**
- Hoja del gasto: un disclosure "Datos de pago (opcional)" al final, cerrado si no hay datos; dentro, los dos campos, la nota "No guardes contraseñas aquí." y la casilla, que solo aparece cuando los datos cambiaron.
- Hoy, fila de Por pagar: un enlace pequeño "Pagar ↗" a la derecha del nombre, que no abre Marcar pago (detiene el clic). Escritorio igual.
- Marcar pago: una línea "Código 123456 · Copiar" y "Abrir portal ↗". Copiar usa `navigator.clipboard` en la PWA y `expo-clipboard` en la app (verificar si ya está instalado; si no, agregarlo con `npx expo install`).

La regla de validación vive en `rules/datos-pago.ts` para que `plan.ts` y `anual.ts` la usen sin importarse entre sí.

**D6. Modo de prueba y demo.** El estado serializado sin los campos se lee como sin datos (`undefined` = null). La semilla demo no cambia.

## Risks / Trade-offs

- [Gastos con el mismo nombre en la misma categoría que no son el mismo] → la casilla se puede desmarcar; el caso es raro dentro de un hogar.
- [Renombrar el gasto en un mes y luego aplicar] → solo llega a los meses con el nombre nuevo; queda dicho en el texto de la casilla ("con el mismo nombre").
- [El código es dato personal del hogar] → se guarda como el resto del plan, aislado por hogar; no se registra en logs.
- [`expo-clipboard` es dependencia nativa] → requiere build nuevo de la app, que ya se hace (2.3.2).

## Migration Plan

1. Backend con V20 (columnas nullable). Backup antes, despliegue, verificación con el plan de noviembre.
2. PWA.
3. App 2.3.2 en TestFlight y App Store.
4. Rollback: las columnas nullable se pueden dejar; la versión anterior del backend las ignora.
