# Tasks

## 1. Dominio compartido

- [x] 1.1 Desde `develop`, crear la rama `feature/backend-cuentas-creditos`. En `packages/domain`:
  - `agregarCredito` (validaciones de la spec "Créditos del hogar") con la cuota en la Opción A del mes en curso si tiene plan y no está cerrado;
  - `cuotasDeCreditos` (D5), y `crearMes` que la aplica en los tres modos y no copia ítems de créditos en $0;
  - `CuentasPort.agregarCredito` y su implementación en el adaptador de prueba.
  
  Verificar: tests de `agregarCredito` (con y sin plan, mes cerrado, datos inválidos) y de `crearMes` (Desde cero con un crédito, crédito pagado, Copiar sin duplicar la cuota). Los tests existentes siguen en verde.

## 2. Datos y modelo (backend)

- [x] 2.1 `V5__cuentas_creditos.sql` (D1, D4, Migration Plan):
  - `credito`;
  - `cuenta.seq_cuadre`;
  - `movimiento.seq` (numerando los existentes), `cuenta_destino_id` y `credito_id`, con los tipos nuevos;
  - `item_plan.credito_id`;
  - las FK nuevas diferidas.
  
  Verificar: un test de migración con dos movimientos de `V4` que quedan con `seq` en orden de `creado_en`, y una cuenta con `seq_cuadre = 0`.
- [x] 2.2 Modelos y puertos:
  - `Credito`, con `ICreditoPersistencePort` y su adaptador R2DBC (`saldo` atómico, D4);
  - `Movimiento` gana `seq`, `cuentaDestinoId` y `creditoId`, y `Cuenta` gana `seqCuadre`;
  - `ItemPlan` gana `creditoId`;
  - `MovimientoR2dbcAdapter` con los tipos nuevos, la lectura de D2 y el saldo estimado en SQL (D3).
  
  Verificar: tests de integración de los adaptadores, incluido el saldo estimado con un movimiento de cada tipo y origen.

## 3. Cuentas (backend)

- [x] 3.1 Extraer la validación de origen y miembro de `FinanzasUseCase` a `Registro` (D6). Crear `CuentasUseCase` con `POST /api/cuentas/cuadre` (D3). Verificar: contrato de "Cuadrar cuentas" (sus tres escenarios), una cuenta ajena en la lista que no cuadra ninguna, y un saldo negativo.
- [x] 3.2 `POST /api/transferencias`, con `MISMA_CUENTA`. `POST /api/cuentas` fija `seq_cuadre` al máximo del momento. Verificar: contrato de "Mover dinero" y "Cuentas básicas", incluido "Un pago de hace cuatro meses" (con un movimiento insertado por SQL en un mes viejo, fuera de la ventana).

## 4. Créditos (backend)

- [x] 4.1 `POST /api/creditos`, con la cuota en el plan del mes en curso (D5). `PlanUseCase.crearPlan` aplica las cuotas de los créditos. Los ítems aceptan `creditoId` (`CREDITO_NO_ENCONTRADO`, y se conserva al editar). Verificar: contrato de "Créditos del hogar" y de los escenarios nuevos de "Crear el plan de un mes" e "Ítems de la opción".
- [x] 4.2 `PUT /api/creditos/{id}/saldo` y `POST /api/creditos/{id}/abonos`. `FinanzasUseCase.pagar` baja el saldo con la cuota (D4). Verificar:
  - contrato de "Abono y saldo de un crédito" y del escenario "Cuota de un crédito" ($13.978.000);
  - dos abonos a la vez que juntos superan el saldo: uno pasa y el otro responde `ABONO_MAYOR`.
- [x] 4.3 `GET /api/finanzas` con créditos, últimos pagos, `seq`, `seqCuadre`, `cuentaDestinoId` y `creditoId` (D2). Contrato de aislamiento de cuadre, transferencia, crédito y abono. Verificar:
  - contrato "Un crédito con su cuota pagada" y "Cuadrar o abonar algo ajeno";
  - que salir del hogar (los últimos miembros) no deja créditos;
  - `gradlew.bat check` en verde, en JVM y en `aotTest`.
- [x] 4.4 Actualizar `backend/README.md` (endpoints y códigos nuevos) y `backend/docs/ARCHITECTURE.md` (D1 y D2: el orden de registro y la lectura para el saldo estimado). Commit.

## 5. PWA

- [x] 5.1 `api.ts`: tipos y llamadas de cuadre, transferencias, créditos, saldo y abonos. `superposicion.ts` reemplaza los créditos, aplica `seq` y `seqCuadre` reales, y pone `creditoId` y `cuentaDestinoId` (D2, D7). Verificar: tests de la superposición:
  - el saldo estimado de una cuenta con un cuadre real, y con un movimiento de un mes fuera de la ventana;
  - los créditos de prueba no se ven.
- [x] 5.2 `PuertosConectados.cuentas` según D7. Se quita `ETAPA_5`, y `probarComoOpcion` sigue con `ETAPA_7`. Verificar: tests en `conectado.spec.ts` para cuadrar, mover, agregar crédito, actualizar saldo y abonar, cada uno releyendo las finanzas.
- [x] 5.3 Pantallas:
  - "+ Agregar" en Créditos con su hoja;
  - selector de origen en "Registrar abono";
  - fuera el aviso `pronto` de Cuadrar y Mover en modo conectado.
  
  Verificar: tests de la hoja (botón deshabilitado sin cuota) en modo demo y en modo conectado. Los tests de Cuentas existentes siguen en verde.
- [x] 5.4 Recorrido conectado con el backend simulado: agregar un crédito con el plan activo → la cuota en Hoy → pagarla → saldo $13.978.000 → abono desde una cuenta → cuadrar con diferencia → "Sin registrar" en el Cierre. Verificar: `npx ng test` en verde. Actualizar `frontend/README.md` (qué es real y qué de prueba). Commit.

## 6. Verificación y cierre

- [x] 6.1 Desplegar con `local-deploy.ps1 -Project steward` y recorrer en `steward.test`, con dos personas de prueba, por el acceso de desarrollo:
  1. un hogar nuevo con Davivienda ($4.000.000) y Efectivo ($200.000) crea el plan del mes "Desde cero";
  2. una persona agrega "Libre inversión" ($14.250.000, total $20.000.000, cuota $500.000, 1,6 % EM, día 15); la cuota aparece en Hoy para las dos;
  3. la otra paga la cuota desde Davivienda: el crédito queda en $13.978.000 y Davivienda en ≈ $3.500.000;
  4. se mueven $100.000 de Davivienda a Efectivo;
  5. se cuadra Davivienda en $3.350.000: "Gastos sin registrar $50.000", y el Cierre lo muestra en "Sin registrar";
  6. un abono de $1.000.000 desde "Su cuenta" deja el crédito en $12.978.000.
  
  Verificar: el criterio de cierre de la Etapa 5 del ROADMAP, las mismas cifras para las dos personas, sin errores en la consola. Borrar las personas y el hogar de prueba al terminar.
- [x] 6.2 `docs/ROADMAP.md`: marcar la Etapa 5. Anotar en la Etapa 7 que "Probarlo como opción" sigue con aviso. Verificar: `openspec validate backend-cuentas-creditos --strict` sin errores. Commit.
