# Tasks

## 1. Diseño

- [x] 1.1 Actualizar en el canvas Presupuesto Hogar v3 la hoja de cambio web (AnualCambios) y móvil (AnualCambioMovil) con "Desde · Hasta", el texto de ayuda y "Lo que cambia" con un rango (design D5), y publicar el artefacto.

## 2. Dominio

- [x] 2.1 `EventoAnual.hasta` en lugar de `enAdelante`, `DatosEvento` con `hasta?` y `enAdelante?`, y la validación en `normalizarEvento`; `aplicaEn` en `eventosDelMes`, resumen, celdas distintas, diezmo e ítems del mes (design D1). Verificar con pruebas de "Gasto de marzo a junio", "Hasta antes del mes" y "El curso en sus meses".
- [x] 2.2 Superposición y API conectada (`hasta`, con `enAdelante` de respaldo), semilla y lectura del estado viejo del demo. Verificar con una prueba que carga un evento con solo `enAdelante`.

## 3. Backend

- [x] 3.1 V16 (`hasta` desde `en_adelante`, `CHECK`, quitar `en_adelante`) y su prueba de migración.
- [x] 3.2 `PlanAnual.Evento.hasta` y `aplica`, `EventoRequest` y `EventoResponse` (con `enAdelante` calculado), la regla de edición sin `hasta` (design D2 y Riesgos), y el adaptador. Verificar con pruebas de contrato de "Gasto de marzo a junio", "Hasta antes del mes" y "La app que envía en adelante", y con `gradlew check`. Actualizar `backend/README.md`.

## 4. Web

- [x] 4.1 `cambio-hoja.ts` con "Desde {mes} hasta [mes]", el texto de ayuda y el ajuste del "hasta" al cambiar el mes; "Lo que cambia" con el rango en `anual-page.ts` (design D3). Verificar con pruebas de "Un gasto de marzo a junio", "El hasta por defecto" y "Corregir el rango".
- [x] 4.2 Correr `npm test` y `ng build`. Actualizar `frontend/README.md`.

## 5. App

- [x] 5.1 La hoja de cambio con "Hasta" y la lista con el rango en `src/app/(app)/anual/[anio].tsx` (design D4). Verificar con una prueba en `mobile/test` y correr `npm test` en `mobile`.

## 6. Entrega

- [ ] 6.1 Con confirmación de Daniel: PR, respaldo y despliegue del backend (V16) y la PWA. Verificar: `health UP` y un evento de marzo a junio en producción.
- [ ] 6.2 Con confirmación de Daniel: versión 2.2.4 de la app a TestFlight.
- [ ] 6.3 Revisión visual de la hoja a 390 px y 1280 px, y en la app.
