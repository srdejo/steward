# Tasks

## 1. Dominio

- [x] 1.1 `mesBase` en `OpcionAnual` y la plantilla desde el mes base (design D1); `nuevaOpcionDesdeBase`, `copiarMesBase`, `guardarItemBase`, `quitarItemBase`, `usarMesBase` y `vistaMesBase` (design D2); duplicar copia el mes base. Verificar con pruebas de los escenarios de "Mes base editable de una opción".
- [x] 1.2 `PlanPort` (demo y conectado), `api` y superposición con `mesBase`.

## 2. Backend

- [x] 2.1 V15 y una prueba de migración.
- [x] 2.2 Endpoints del mes base y `{desde}` al crear una opción (design D3); los meses salen del mes base. Verificar con pruebas de contrato de los escenarios, y correr `gradlew check`. Actualizar `backend/README.md`.

## 3. Web

- [x] 3.1 `nueva-opcion-hoja.ts` y "Cambiar mes base" siempre visible (design D4). Verificar con una prueba del escenario "Crear la Opción C desde el mes en curso" y "Cambiar mes base con los meses creados".
- [x] 3.2 `anual-base-page.ts`: el editor con celdas, agregar y quitar, el resumen y "Usar este mes en los 12 meses" (design D4). Verificar con una prueba del escenario "Ajustar y usar".
- [x] 3.3 Correr `npm test` y `ng build`, y la app (`npm test` en `mobile`), que tiene que seguir leyendo el anual. Actualizar `frontend/README.md`.

## 4. Producción

- [ ] 4.1 Con confirmación de Daniel: PR, respaldo y despliegue del backend (V15) y la PWA. Verificar: `health UP` y crear una opción desde el mes en curso en producción.
- [ ] 4.2 Revisión visual del mes base a 1024, 1280 y 1440 px.
