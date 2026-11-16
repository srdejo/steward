# Tasks

## 1. Dominio

- [x] 1.1 `eliminarCredito` en `rules/credito.ts` (design D1), `CuentasPort.eliminarCredito` en demo y conectado, y `api.eliminarCredito` (`DELETE /api/creditos/{id}`). Verificar con pruebas:
  - eliminar la compra a cuotas la quita de octubre y de noviembre;
  - eliminar Libre inversión deja la cuota pagada de octubre sin enlace y conserva su pago;
  - los meses cerrados no cambian.

## 2. Backend

- [x] 2.1 `ICuentasServicePort.eliminarCredito`, `ICreditoPersistencePort.eliminar(id, desde)` y `DELETE /api/creditos/{id}` (design D1). Verificar con pruebas de contrato los escenarios de "Eliminar un crédito del hogar", y correr `gradlew check`. Documentarlo en `backend/README.md`.

## 3. PWA

- [x] 3.1 La vista de escritorio de `credito-page.ts` (design D3), con `data.ancho: 'escritorio'`. Verificar con una prueba a 1280 px del escenario "Libre inversión en escritorio".
- [x] 3.2 "Eliminar crédito" con su hoja (design D2) en móvil y escritorio. Verificar con pruebas de los escenarios de "Eliminar un crédito".
- [x] 3.3 Correr `npm test` y `ng build` y actualizar `frontend/README.md`.

## 4. App

- [x] 4.1 "Eliminar crédito" en `credito/[id].tsx`, con la alerta de confirmación (design D2). Verificar con una prueba y correr `npm test`.

## 5. Cierre

- [ ] 5.1 Revisión visual del detalle a 1024, 1280 y 1440 px y en la app.
