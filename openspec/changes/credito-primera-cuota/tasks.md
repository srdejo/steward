## 1. Dominio (`packages/domain`)

- [x] 1.1 `Credito.primeraCuota: MesRef | null` en el modelo; `DatosCredito` y `DatosMetodo` con `primeraCuota?`; el modo de prueba lee estados guardados viejos con null (y el adaptador conectado mapea `"YYYY-MM"` ↔ `MesRef`)
- [x] 1.2 `cuotasProyectadas`: la primera es el máximo entre `primeraCuota` y la regla de hoy (D2); `pagaEnMes`: un `ref` anterior a `primeraCuota` no paga
- [x] 1.3 `agregarCredito`: la cuota entra al mes en curso solo si la primera cuota no es posterior (D3); `cambiarMetodoCredito` guarda la primera cuota (el mes en curso o anterior → null) y valida el rango (D4)
- [x] 1.4 `crearMes`: un crédito cuya primera cuota es posterior a `ref` no gana su cuota y su ítem copiado no se copia
- [x] 1.5 Pruebas: Johana (detalle, próximas, termina nov 2034, proyección), plan anual enero sin / febrero con, crear noviembre sin la cuota, alta sin ítem en noviembre, crédito sin el campo igual que antes

## 2. Backend

- [x] 2.1 Migración `V19__credito_primera_cuota.sql` (`primera_cuota date` null) y `MigracionV19Test`
- [x] 2.2 `Credito` con `YearMonth primeraCuota`; `CreditoR2dbcAdapter` lee y escribe; `FinanzasDtos` (`CrearCreditoRequest`, `MetodoCreditoRequest`, `CreditoResponse`) con `primeraCuota` `"YYYY-MM"`
- [x] 2.3 `CuentasUseCase`: crear valida el rango (400 `DATOS_INVALIDOS`), guarda null para el mes en curso y no agrega la cuota al mes en curso si la primera es posterior; cambiar método conserva el valor si no viene (D5)
- [x] 2.4 `Amortizacion.pagaEnMes` con la primera cuota (D2) y `PlanUseCase.conCuotas` que no agrega ni copia la cuota de un crédito que empieza después de `ref` (D3)
- [x] 2.5 Pruebas unitarias y de contrato (crear con y sin primera cuota, fuera de rango, cambiar método sin el campo, crear mes, plan anual); `gradlew check` con el contrato AOT

## 3. PWA (`frontend`)

- [x] 3.1 `metodo-hoja.ts`: selector "Primera cuota" (mes en curso y 12 siguientes; el actual por defecto o el guardado) en "+ Crédito" y en "Cambiar", con la nota "Los meses ya planeados no cambian; ajústalos en Planear" al cambiarla
- [x] 3.2 Pruebas de la hoja y del detalle (próxima cuota en diciembre); `npm test` y build

## 4. App (`mobile`)

- [x] 4.1 `components/metodo-credito.tsx`: el mismo selector y la nota
- [x] 4.2 Pruebas de la app; versión 2.3.1 (o mayor) en `app.json`

## 5. Entrega

- [ ] 5.1 PR, merge, backup y despliegue del backend (V19) y de la PWA
- [ ] 5.2 Build de la app para TestFlight y App Store (con Daniel)
- [ ] 5.3 Corregir Johana: "Cambiar" → "Primera cuota: diciembre 2026", y revisar que el detalle diga "Próxima cuota · diciembre" (Daniel)
