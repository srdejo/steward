# Tasks

## 1. Dominio

- [x] 1.1 Modelo con opciones (design D1): `OpcionAnual`, `PlanAnual.opciones` y `opcionEnUso`, `opcionDe`, `duplicarOpcionAnual`, `quitarOpcionAnual`, y `opcionId` en celdas, eventos y replicar. Semilla en `VERSION_ESQUEMA` 6. Verificar con pruebas de los escenarios de "Opciones del plan anual" y las de anual que ya existen.
- [x] 1.2 `resumenAnual` por opción, con `opciones` y `libreA`, y las categorías sin fila con el total de la plantilla (design D1 y D3). Verificar con pruebas: la B con carro nuevo deja $2.800.000 menos que la A en 2027.
- [x] 1.3 `mesesDesdeAnual` y `crearOActualizarMeses` con créditos, tarjetas, compras a cuotas y categorías sin fila (design D3); `replicarMes` sin bloqueo y con Créditos por mes (design D4). Verificar con pruebas de los escenarios de "Crear o actualizar los meses desde el plan anual" y "Replicar el mes base", incluido el caso real (marzo a diciembre con solo el salario).
- [x] 1.4 `PlanPort` (demo y conectado) y `api` con los endpoints nuevos (design D2).

## 2. Backend

- [x] 2.1 V14 (design D2) con una prueba de migración: un año `CREADO` con celdas, eventos y base queda con su Opción A en uso.
- [x] 2.2 Opciones, `opcionId` en celdas, eventos y replicar, y `POST /api/anuales/{anio}/meses` (design D2 y D3) en `AnualUseCase`, el adaptador y el controlador. Verificar con pruebas de contrato de los escenarios de `steward-plan-anual`. Correr `gradlew check` y actualizar `backend/README.md`.

## 3. PWA

- [x] 3.1 `anual-page.ts` con opciones, celdas distintas de la A, "mes a mes" y "Lo que cambia en la Opción X" (design D5). Verificar con una prueba a 1280 px del escenario "Opción B con carro nuevo".
- [x] 3.2 La hoja "Meses con la Opción X". Verificar con pruebas del escenario "Actualizar los meses de 2027" y de que, al confirmar, los meses quedan con sus gastos.
- [x] 3.3 Correr `npm test` y `ng build` y actualizar `frontend/README.md`.

## 4. App

- [x] 4.1 La pantalla del año con chips de opción, "vs A" y la hoja de meses (design D5). Verificar con pruebas con las mismas cifras que la PWA, y correr `npm test`.

## 5. Producción

- [x] 5.1 Con confirmación de Daniel: respaldo, despliegue del backend (V14) y la PWA. Verificar: `health UP`; el 2027 real queda con su Opción A en uso; Daniel actualiza marzo a diciembre y los ve con sus gastos.
- [ ] 5.2 Revisión visual de las opciones del año en web (1024, 1280 y 1440 px) y en la app.
