# Tasks

## 1. Dominio: categorías, tarjetas y créditos

- [x] 1.1 Modelo y semilla (design D1, D3 y D5):
  - `Tarjeta`, `ItemPlan.tarjetaId` y los campos nuevos de `Credito` (`metodo`, `numeroCuotas`, `cuotasPagadas`, `valorFinanciado`);
  - cuatro categorías del sistema;
  - la semilla del canvas: Nu · Mercado completa $320.000 (corte 13, pago 28) en lugar de Mercado en Variables; Mastercard con pago fijo $1.500.000 (corte 15, pago 30); Visa · Gasolina completa $800.000 (corte 21, pago 6); la compra a cuotas como crédito PLAN de 12 × $375.000 con 3 pagadas;
  - `VERSION_ESQUEMA` en 4.

  Verificar con `npm run typecheck` y `npm test` en `packages/domain`, ajustando las cifras de las pruebas existentes a las del canvas.
- [x] 1.2 `rules/tarjetas.ts`: agregar, editar y quitar con validaciones; `pagoDeCorte`, `proximoPago`, `proximoCorte`, `fechasTarjetas`, `porPagarCiclo` y la ayuda (design D2). Verificar con pruebas de las fechas de Nu y Visa del spec (incluido el día 31 en noviembre) y de "Por pagar este ciclo" $2.620.000.
- [x] 1.3 La tarjeta en el plan (design D1):
  - ítem al agregar, también enlazando uno existente;
  - `nuevoMes` con el monto de la tarjeta;
  - `estimado` al pagar;
  - detalle en Hoy ("Corte 13 · valor del extracto").

  Verificar con pruebas de los escenarios "Pago fijo en el plan", "Completa sigue al último extracto" y "Enlazar un ítem que ya existe".
- [x] 1.4 Créditos (design D3 y D4): `emDeEa`, `cuotaFija`, `tabla`, el pago por método en `marcarPago` y `devolverCapital`, cambiar de método, "actualizar con extracto" y `proyeccionCreditos`. Verificar con pruebas de:
  - 12 % EA = 0,95 % EM;
  - plan de $5.000.000 a 24 cuotas al 24 % EA, con capital total $5.000.000;
  - pagar la cuota 4 de la compra a cuotas → $3.000.000 y cuota 5 de 12;
  - borrar ese pago vuelve a $3.375.000 y cuota 4;
  - a mano no cambia el saldo;
  - proyección: $17.625.000, $875.000, $3.000.000 a fin de octubre y $13.978.000 a fin de noviembre;
  - un crédito que termina vale $0 después.
- [x] 1.5 Puertos `TarjetasPort` y `CuentasPort` (vistas con proyección y método) en los adaptadores demo y conectado (`api.ts` con `tarjetas` y los campos nuevos). Verificar con `npm test` en `packages/domain`, incluidas las pruebas del adaptador conectado.

## 2. Backend

- [x] 2.1 Migración `V12__tarjetas_creditos.sql` (design D5). Verificar con `MigracionV12Test` (Testcontainers):
  - un hogar con "Tarjetas y cuotas", celdas anuales y una serie de cuotas queda con Créditos sumado y el mismo total por mes;
  - el crédito PLAN tiene las cuotas pagadas correctas;
  - no queda ninguna categoría TARJETA.
- [x] 2.2 Tarjetas: modelo, puerto R2DBC, `TarjetasUseCase`, `TarjetaController` y la línea en `NacimientoMes` y `Registro` (design D6). Verificar con `TarjetasContratoTest`: CRUD, validaciones (400), aislamiento por hogar (404), enlazar un ítem y el estimado al pagar.
- [x] 2.3 Créditos por método: `agregarCredito` con método, `PUT /api/creditos/{id}/metodo`, el pago de la cuota PLAN y MANUAL en `Registro`, y los campos nuevos en finanzas. Verificar con `CuentasContratoTest` y `gradlew check` (también en AOT). Documentar los endpoints en `backend/README.md`.

## 3. PWA

- [x] 3.1 Pestaña Tarjetas, en escritorio y móvil, con su hoja para agregar o editar y "Pago en N días" en la pestaña (spec `steward-tarjetas`). Verificar con pruebas: los datos de prueba dan $2.620.000 y Nu "28 oct · en 2 días" en rojo; agregar y quitar una tarjeta.
- [x] 3.2 Pestaña Créditos: indicadores, tabla, panel lateral y proyección en escritorio, y tarjetas en móvil; hoja "¿Cómo baja el saldo?" para agregar y cambiar (spec "Proyección de créditos" y "Cómo baja el saldo de un crédito"). Verificar con pruebas: $17.625.000 y $875.000; agregar un plan de pagos con 0 % y ver $375.000 y "Cuota 4 de 12"; la EA se convierte.
- [x] 3.3 Detalle de crédito según el artboard `Credito`: próxima cuota, próximas cuotas, intereses del año siguiente, "Corregir con extracto" y el simulador. Verificar con pruebas: $272.000 a capital y $228.000 de intereses, y corregir a $13.900.000.
- [x] 3.4 Ajustar las pruebas de la PWA a la semilla nueva (`hoy`, `hoy-escritorio`, `paridad`, `planear`, `conectado`) y a las cuatro categorías. Verificar con `npm test` y `ng build` en `frontend`.

## 4. App

- [x] 4.1 `(tabs)/cuentas.tsx` con pestañas, pantallas de Tarjetas y Créditos, la hoja de método y `credito/[id].tsx` reescrito, siguiendo las docs de Expo v57. Verificar con `test/app.test.tsx`: el escenario "Mismas tarjetas y créditos" da las mismas cifras que la PWA, y se actualiza la paridad de Hoy.
- [x] 4.2 Versión 2.2.0 en `mobile/app.json` y `AGENTS.md`. Verificar con `npm test` y `npx tsc --noEmit` en `mobile`.

## 5. Cierre del cambio

- [x] 5.1 Actualizar `frontend/README.md` y verificar `openspec validate tarjetas-y-creditos --strict`.
- [ ] 5.2 Revisión visual de Tarjetas y Créditos a 390, 1024 y 1280 px en la PWA y en la app (TestFlight).
