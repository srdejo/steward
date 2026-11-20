## 1. Dominio

- [x] 1.1 `ItemPlan.enlacePago?: string | null` y `codigoPago?: string | null`; validación (D4) en `guardarItem` y en los gastos del mes base; ausente conserva, vacío quita (D3). Verificar con pruebas en `rules/datos-pago.test.ts`.
- [x] 1.2 `aplicarAMeses` en `guardarItem` (D2): meses posteriores no cerrados, todas las opciones, mismo nombre normalizado y categoría, y mes base anual del año en adelante. Pruebas: los escenarios de "Datos de pago de un gasto".
- [x] 1.3 Las copias (crear mes COPIAR/FIJOS, duplicar opción, replicar mes base, meses desde el anual) traen los datos. Pruebas de "El mes nuevo los trae" y "Datos de pago en el mes base".
- [x] 1.4 Modo conectado: `conectado/api.ts` (`ItemRequest`/`ItemApi` con `enlacePago`, `codigoPago`, `aplicarAMeses`), `superposicion.ts` y `puertos-conectados.ts`. Verificar con `npm test` del dominio.

## 2. Backend

- [x] 2.1 `V20__gastos_datos_pago.sql`: `enlace_pago` y `codigo_pago` en `item_plan` y `anual_base_item`; `MigracionV20Test`.
- [x] 2.2 `PlanMes.ItemPlan`, `ItemRequest`/`ItemResponse`, `PlanR2dbcAdapter`, `AnualR2dbcAdapter`: leer y escribir; validación D4 con 400 `DATOS_INVALIDOS`; PUT sin campos conserva. Pruebas de contrato en `PlanContratoTest`.
- [x] 2.3 `PlanUseCase`: `aplicarAMeses` en la misma transacción; copias al crear mes. `AnualUseCase`: mes base y meses creados. Pruebas de los escenarios; `gradlew check` (incluye AOT) en verde.

## 3. PWA

- [x] 3.1 `gasto-plan-hoja.ts`: sección plegada "Datos de pago (opcional)", nota y casilla (D5); el mes base (cuadrícula sin hoja por gasto) los conserva al cambiar el monto. Spec en `planear/datos-pago.spec.ts`.
- [x] 3.2 Hoy (móvil y escritorio): "Pagar ↗" solo con enlace; `pagar-hoja.ts` con código, Copiar y "Código copiado" (`shared/components/datos-pago.ts`). Spec en `planear/datos-pago.spec.ts` y `conectado.spec.ts`; `ng test` en verde.

## 4. App

- [x] 4.1 `components/hojas-plan.tsx`: misma sección y casilla. Prueba en `mobile/test/app.test.tsx`.
- [x] 4.2 Hoy y Marcar pago: "Pagar ↗" con `Linking.openURL` y Copiar con `expo-clipboard` (instalar con `npx expo install` si falta). Prueba en `mobile/test/app.test.tsx`; `mobile/app.json` en 2.3.2.

## 5. Entrega

- [x] 5.1 PR, merge, backup, despliegue de backend y PWA (con confirmación de Daniel); verificar en producción que Internet de noviembre guarda sus datos y los lleva a diciembre.
- [ ] 5.2 Build 2.3.2 a TestFlight y App Store con Daniel.
- [x] 5.3 Daniel carga los datos de internet, agua, luz y gas con "Aplicar también a los meses ya planeados".
