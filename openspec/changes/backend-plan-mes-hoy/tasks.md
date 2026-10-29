# Tasks

## 1. Datos y modelo

- [x] 1.1 Desde `develop`, crear la rama `feature/backend-plan-mes-hoy`. Escribir `V3__plan_mes.sql` (D2):
  - `categoria` con las cuatro del sistema para cada hogar que ya existe;
  - `plan_mes`, `escenario` e `item_plan`, con sus índices únicos;
  - `movimiento` con los tipos nuevos, `item_id`, `nota` y `origen` (con backfill), y el índice único de PAGO por ítem y mes.
  
  Verificar: un test de migración (como `MigracionV2Test`) con un hogar y un ingreso recibido en `V2` termina con las cuatro categorías y el movimiento con `origen` correcto.
- [x] 1.2 Modelos (`Categoria`, `PlanMes` con `Escenario` e `ItemPlan`, `Origen` en `Movimiento`) y puertos SPI con sus adaptadores R2DBC (categoría, plan). `MovimientoR2dbcAdapter` gana PAGO, GASTO y APORTE, y traduce la violación del índice de pagos a `YA_PAGADO`. Verificar: tests de integración de los adaptadores, incluidas `DUPLICADA`, `YA_EXISTE` y `YA_PAGADO` por violación de índice.

## 2. Plan del mes (backend)

- [x] 2.1 Categorías:
  - `HogarUseCase.crear` inserta las cuatro del sistema en la misma transacción;
  - `POST /api/categorias` y `PATCH /api/categorias/{id}`, con `RESERVADA`, `DUPLICADA` y nombre de 1 a 40.
  
  Verificar: contrato de "Categorías del hogar" (sus tres escenarios) y que un hogar nuevo trae las cuatro en orden.
- [x] 2.2 `PlanUseCase` con `POST /api/planes` (`{anio, mes, modo}`):
  - COPIAR, FIJOS y CERO desde la opción principal del mes anterior, con avance de cuotas y sin las terminadas, como `crearMes`;
  - `YA_EXISTE`.
  
  Verificar: contrato de "Crear el plan de un mes", con las cifras de "Copiar mes anterior" y "Solo fijos".
- [x] 2.3 Ítems: `POST /api/planes/{id}/escenarios/{escenarioId}/items`, y `PUT` y `DELETE` sobre `.../items/{itemId}`. Validaciones de la spec, `CATEGORIA_NO_ENCONTRADA` e `ITEM_CON_PAGOS` (D7). `POST /api/planes/{id}/usar` (`{escenarioId}`). Estado efectivo al leer y `MES_CERRADO` en un mes cerrado (preparado por SQL en el contrato). Verificar: contrato de "Ítems de la opción" y "Usar la opción y estados del mes".
- [x] 2.4 Aislamiento: contrato de "Aislamiento del plan" con dos hogares (plan, opción, ítem y categoría ajenos → 404) y sin sesión → 401 en cada endpoint nuevo. Verificar: `gradlew.bat check` en verde, en JVM y en `aotTest`.

## 3. Registros de Hoy (backend)

- [x] 3.1 `POST /api/pagos` (`{itemId, monto, usuarioId, origen: {tipo, cuentaId?}}`) en `FinanzasUseCase`:
  - el ítem tiene que estar en la opción principal del mes en curso;
  - un variable se registra como GASTO;
  - `YA_PAGADO` con "Ya lo pagó {nombre} el {dd mmm}", tomando el formato común de D3;
  - cuenta y miembro del hogar, y `MES_CERRADO`.
  
  Verificar: contrato de "Marcar un pago" (sus tres escenarios) y un test de dos pagos simultáneos al mismo fijo, que deja uno solo.
- [x] 3.2 `POST /api/gastos` (`{itemId?, monto, nota, usuarioId, origen}`) y `POST /api/aportes` (`{usuarioId, monto, mes: {anio, mes}, cuentaId?, aplicaDiezmo}`), con el mes en curso o el siguiente para los aportes (D6). Verificar: contrato de "Registrar un gasto" y "Registrar un aporte".
- [x] 3.3 Obligaciones de los aportes con diezmo: `10% del aporte · 26 oct` y monto sobre el aporte, con la regla actual. "Entregado" las cubre como a las demás. Verificar: contrato "Aporte con diezmo", y que un agrupado de salario más aporte entrega la suma.
- [x] 3.4 `GET /api/finanzas` con categorías, planes (opciones, ítems y estado efectivo) y movimientos de todos los tipos desde dos meses antes (D4). Verificar: contrato "El plan y lo pagado", y que un movimiento de hace tres meses no aparece.
- [x] 3.5 Actualizar `backend/README.md` (endpoints y códigos nuevos) y `backend/docs/ARCHITECTURE.md` (D3: las vistas en el cliente). Verificar: `gradlew.bat check` en verde. Commit.

## 4. PWA

- [x] 4.1 `api.ts`: tipos y llamadas de categorías, planes, ítems, usar, pagos, gastos y aportes. `superposicion.ts` reemplaza `categorias`, `planes` y todos los `movimientos`, y deja `cierres` vacío (D5). Verificar:
  - tests de la superposición: el plan real se ve en `resumenMes`, un pago `EXTERNA` cuenta como aporte implícito, y nada real llega al storage;
  - los demás tests siguen en verde.
- [x] 4.2 `PuertosConectados` según la tabla de D5: `movimientos`, `plan` y las categorías de `hogar` al backend, `registrarAporte` al backend, `entregarDiezmo` sin reparto, y los rechazos `ETAPA_6`, `ETAPA_7` y `ETAPA_8`. `YA_PAGADO` relee las finanzas antes de propagarse. Verificar: tests en `conectado.spec.ts` para cada escritura y cada rechazo.
- [x] 4.3 Pantallas: el aviso de "llega en una próxima versión" donde se llama a lo bloqueado (Mes en borrador "+ Duplicar", Comparar, Plan anual "Crear meses", Cierre "Cerrar {mes}", Detalle de crédito "Probarlo como opción"), (Comparar no rechaza: calcula sobre lo real y muestra el aviso). `ITEM_CON_PAGOS` no tiene pantalla: ninguna permite quitar ítems todavía, y el puerto propaga el error si alguna lo hace. Verificar: tests de cada aviso en modo conectado, y que en modo demo todo sigue igual (los tests existentes de Planear, Cuentas y Cierre en verde).
- [x] 4.4 Recorridos conectados con el backend simulado:
  - Hoy sin plan → Mes sin plan → "Desde cero" → agregar ítems → "Usar opción A";
  - el criterio de cierre de la spec `steward-hoy` (pago bajo el plan, aporte y gasto no planeado, con las cifras de "Vs. plan" y "Te queda libre");
  - "Lo pagó el otro miembro hace un momento";
  - una categoría nueva disponible en un ítem.
  
  Verificar: `npx ng test` en verde. Actualizar `frontend/README.md` (qué es real y qué de prueba). Commit.

## 5. Verificación y cierre

- [ ] 5.1 Desplegar con `local-deploy.ps1 -Project steward` y recorrer en `steward.test`, con dos personas de prueba, por el acceso de desarrollo:
  1. un hogar nuevo crea el plan de octubre "Desde cero", con Internet ($120.000, fijo) y Mercado ($320.000, variable), y usa la Opción A;
  2. una persona marca Internet por $100.000 desde "Su cuenta"; la otra ve el pago y "Aportes {nombre}" con el pago directo;
  3. se registran un aporte de $500.000 y un gasto no planeado de $85.000;
  4. "Vs. plan" y "Te queda libre" cuadran con lo registrado, igual para los dos;
  5. pagar otra vez Internet da "Ya lo pagó…".
  
  Verificar: el criterio de cierre de la Etapa 4 del ROADMAP, sin errores en la consola. Borrar las personas y el hogar de prueba al terminar.
- [ ] 5.2 Guía para el hogar real "Jimenez Navarro": en `docs/DEPLOYMENT.md` (o el README de la PWA), que al pasar a la Etapa 4 el plan de prueba desaparece y el mes se crea desde Planear. Verificar: con la sesión de Daniel, Hoy muestra "Este mes no tiene plan" y lleva a Planear.
- [ ] 5.3 `docs/ROADMAP.md`: marcar la Etapa 4 y el objetivo actual ("Hogar en la nube con un plan del mes usable") como cumplido. Anotar en las Etapas 5, 6, 7 y 8 lo que quedó con aviso ("llega en una próxima versión"). Verificar: `openspec validate backend-plan-mes-hoy --strict` sin errores. Commit.
