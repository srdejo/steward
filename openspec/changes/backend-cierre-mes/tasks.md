# Tasks

## 1. Datos y modelo

- [x] 1.1 Desde `develop`, crear la rama `feature/backend-cierre-mes`. Escribir `V6__cierre_mes.sql` (D2). Agregar el modelo `CierreMes` con sus filas, y `ICierrePersistencePort` con su adaptador R2DBC:
  - `guardar`, que inserta el cierre y sus filas y traduce el índice único a `MES_CERRADO`;
  - `desde`, para la lectura;
  - `estaCerrado`;
  - la suma de AJUSTE_CUADRE y el `max(seq)` de un mes, en el puerto de movimientos.
  
  Verificar: tests de integración del adaptador, incluido el cierre duplicado.

## 2. Cerrar el mes (backend)

- [x] 2.1 `CierreUseCase` con `POST /api/cierres` (D1): mes en curso o anterior, `REPARTO_INVALIDO`, "Sin registrar" y `ultimoSeq` (`CIERRE_DESACTUALIZADO`), y el plan a CERRADO en la misma transacción. Verificar:
  - contrato de "Cerrar el mes", sus cinco escenarios, con las cifras de "Cerrar octubre";
  - dos cierres a la vez: uno pasa y el otro responde `MES_CERRADO`.
- [x] 2.2 "Mes cerrado" según D3 en `PlanUseCase` y `FinanzasUseCase`, incluidos "Recibí" y "Entregado". Verificar:
  - contrato de "Registros en un mes cerrado" (sus tres escenarios);
  - "Mes cerrado sin plan" (crear el plan de un mes cerrado sin plan da `MES_CERRADO`).
- [x] 2.3 `GET /api/finanzas` con `cierres` (D4). Aislamiento: cerrar un mes de otro hogar no es posible (el hogar sale de la sesión), sin sesión responde 401, y los cierres de otro hogar no se leen. Al salir los últimos miembros no queda ningún cierre. Verificar:
  - contrato "Un mes cerrado";
  - `gradlew.bat check` en verde, en JVM y en `aotTest`.
- [x] 2.4 Actualizar `backend/README.md` (endpoint y códigos) y `backend/docs/ARCHITECTURE.md` (D1: la foto del cierre la calcula el cliente y el backend la valida). Commit.

## 3. PWA

- [ ] 3.1 `api.ts`: `CierreApi` en `FinanzasApi`, y `cerrarMes`. `superposicion.ts` pone los cierres reales (D5). Verificar: tests de la superposición:
  - un mes cerrado muestra su foto en `vistaCierre`;
  - el mes siguiente trae "Sobrante de {mes}" en sus ingresos;
  - los cierres de prueba no se ven.
- [ ] 3.2 `PuertosConectados.cierre.cerrar` según D5: el cuerpo con la vista del dominio y `ultimoSeq`; con `CIERRE_DESACTUALIZADO`, relee antes de propagar. Fuera `ETAPA_6`. Verificar: tests en `conectado.spec.ts` del cuerpo enviado, del error desactualizado y de un registro en un mes cerrado (`MES_CERRADO` desde el backend).
- [ ] 3.3 Pantalla de Cierre: sin "Cerrar {mes}" para un mes futuro en modo conectado, y el mensaje de `CIERRE_DESACTUALIZADO`. Verificar: tests de pantalla en modo conectado; los de Cierre en modo demo siguen en verde.
- [ ] 3.4 Recorrido conectado con el backend simulado: Cierre de octubre → repartir → "Cerrar octubre" → octubre Cerrado, Hoy sin "Marcar pago" para octubre, y noviembre con "Sobrante de octubre". Verificar: `npx ng test` en verde. Actualizar `frontend/README.md`. Commit.

## 4. Verificación y cierre

- [ ] 4.1 Desplegar con `local-deploy.ps1 -Project steward` (con `powershell.exe -File`) y recorrer en `steward.test`, con dos personas de prueba, por el acceso de desarrollo:
  1. un hogar con el plan de octubre, un aporte y un pago;
  2. una persona abre el Cierre y la otra registra un gasto: al cerrar sale "Alguien registró algo en octubre" y la tabla ya lo incluye;
  3. cierra octubre repartiendo el sobrante;
  4. las dos ven octubre Cerrado con el mismo reparto; Hoy no deja pagar en octubre;
  5. al crear noviembre, sus ingresos traen "Sobrante de octubre".
  
  Verificar: el criterio de cierre de la Etapa 6, sin errores en la consola. Borrar las personas y el hogar de prueba al terminar.
- [ ] 4.2 `docs/ROADMAP.md`: marcar la Etapa 6. Verificar: `openspec validate backend-cierre-mes --strict` sin errores. Commit.
