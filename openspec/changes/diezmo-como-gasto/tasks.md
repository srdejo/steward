# Tasks

## 1. Dominio compartido

- [x] 1.1 Crear la rama `feature/diezmo-como-gasto` desde `develop`. La Etapa 9 sigue abierta en `feature/produccion-steward`; si tiene cambios sin commit, preguntarle a Daniel antes de cambiar de rama. En `packages/domain`, el modelo (D1):
  - `TipoCategoria` y `TipoItem` con `DIEZMO`;
  - `ItemPlan` con `ingresoFijoId` y `aporteId`;
  - sin `diezmoEnHoy`, `ObligacionDiezmo` ni los métodos de diezmo de los puertos;
  - la categoría Diezmo en el seed y en "Probar desde cero";
  - renombrar Diezmo responde `RESERVADA`.

  Verificar: `npm test` en `packages/domain` compila, con los tests del diezmo viejo quitados o reescritos.
- [x] 1.2 Ítems de diezmo (D2): `crearMes` sin copiar los `DIEZMO` y con los de fijos y de aportes sin ítem; `registrarAporte` con su ítem en la opción principal; `crearMesesDesdeAnual` con los de eventos de ingreso; el anual rechaza celdas de Diezmo. Verificar: tests de los escenarios de "Ítems de diezmo" (salario, un diezmo por ingreso, sin regla, no se copia el editado, aporte, aporte a un mes sin plan, marcar pagado) y "Diezmo de la prima".
- [x] 1.3 Quitar lo automático (D3, D4): `diezmosPendientes`, `entregarDiezmo`, `definirDiezmoEnHoy`; `diezmoPlaneado` fuera de `vistaOpcion`, `compararOpciones`, `resumenMes` y el cierre (queda como `diezmoProyectado` para el anual); `DIEZMO_ENTREGADO` cuenta como gasto sin ítem. Verificar: tests de Hoy y del cierre con una entrega vieja; comparar opciones sin la fila `'diezmo'`.
- [x] 1.4 Líneas de ingreso (D8): `IngresoPlan` en `Escenario`; `crearMes`, `crearMesesDesdeAnual` y `duplicarEscenario` con sus líneas; `guardarIngresoPlan`/`quitarIngresoPlan` (`INGRESO_RECIBIDO`); `ingresosDelMes` por opción; `marcarRecibido` por línea con monto; puertos `PlanPort.guardarIngreso`/`quitarIngreso` e `IngresosPort.marcarRecibido`. Verificar: tests de "Ingresos de la opción", "Ingresos al crear el mes", "Recibido con otro monto", "Ingreso agregado a mano" y "Duplicar la Opción A".
- [x] 1.5 Seed (D6): el diezmo del salario como ítem pagado. Verificar: el test de "Datos de ejemplo" de Hoy sigue con "Te queda libre $3.436.000", "Plan $5.390.000", "Pagado $2.613.000" y "Vs. plan −$62.000"; si no se puede, pausar y decidir con Daniel. `npm test` del dominio en verde.

## 2. Backend

- [x] 2.1 `V8__diezmo_como_gasto.sql` (D5): categoría y tipo de ítem, enlaces con su `CHECK`, ítems para los planes abiertos sin los ya entregados, sin `diezmo_en_hoy`; tabla `ingreso_plan`, `movimiento.ingreso_plan_id` y las líneas de todos los planes no cerrados. Verificar: un test de migración sobre una base con un plan abierto, un ingreso recibido y entregado, otro sin entregar y un aporte con diezmo; quedan los ítems y las líneas esperados, ni más ni menos.
- [x] 2.2 Modelo, persistencia y `PlanUseCase` (D1, D2, D8): la categoría Diezmo en `delSistema`, sin renombrarse; ítems con sus enlaces; `crearPlan` con los ítems de diezmo y las líneas de ingreso; duplicar con sus líneas; las líneas de ingreso con sus endpoints y recibir una línea con monto. Edición y pago del diezmo como cualquier ítem. Verificar: contrato de "Ítems de diezmo" (salario, uno por ingreso, sin regla, no se copia el editado, marcar pagado), "Categorías del hogar" (cinco categorías, `RESERVADA` al crear y al renombrar) e "Ítems de la opción" ("Editar el diezmo"), "Ingresos de la opción", "Crear el plan de un mes" ("Ingresos al crear el mes"), "Duplicar una opción" y "Recibir un ingreso fijo" ("Recibido con otro monto", "Ingreso agregado a mano").
- [x] 2.3 `FinanzasUseCase` (D2, D3): recibir sin obligación; el aporte con diezmo agrega su ítem en la misma transacción (o lo deja para cuando se cree el mes); se quitan los tres endpoints y `diezmoEnHoy` de las finanzas; las entregas viejas siguen en la lectura y en el saldo. Verificar: contrato de "Registrar un aporte" (con y sin plan), "Recibir un ingreso fijo" y "Aislamiento de las finanzas" ("Entregar diezmo ajeno" → `ITEM_NO_ENCONTRADO`); `DiezmoContratoTest` reescrito o quitado.
- [x] 2.4 `AnualUseCase` (D2): crear meses con los ítems de diezmo y sin copiar los del plan base; celda en Diezmo → 400. Verificar: contrato "Diezmo de la prima" y "Celda de diezmo". `gradlew.bat check` en verde, en JVM y en `aotTest`.
- [x] 2.5 `backend/README.md` y `docs/ARCHITECTURE.md` sin los endpoints quitados. Commit.

## 3. PWA

- [x] 3.1 `api.ts`, `superposicion.ts` y `PuertosConectados`: ítems con sus enlaces, opciones con sus líneas de ingreso, guardar/quitar línea y recibir una línea, sin `diezmoEnHoy`, sin pendientes ni entregas. Verificar: `conectado.spec.ts` ajustado; un aporte con diezmo crea su ítem en el plan leído.
- [x] 3.2 Pantallas:
  - Hoy sin la tarjeta, con los ítems de diezmo en Por pagar y Ya pagado, las líneas de ingreso de la opción en uso y "Recibí" con el monto editable;
  - la hoja de aporte con "Aplicar diezmo" inicial según la regla;
  - Planear sin la fila calculada, con Diezmo como categoría, y los ingresos de cada opción editables con "+ Ingreso";
  - comparar opciones y cierre sin la fila especial;
  - Ajustes sin "Diezmo en Hoy", Diezmo sin "Editar" y la nota de la regla;
  - el anual sin celdas editables en Diezmo.

  Verificar: tests de pantalla de los escenarios de `steward-hoy`, `steward-planear` y `steward-ajustes` de este cambio; `npx ng test` en verde. Actualizar `frontend/README.md`. Commit.

## 4. App Expo

- [x] 4.1 `mobile/` (D7): sin la tarjeta "Disponible para diezmar" ni lo que use `entregarDiezmo` o `diezmoEnHoy`; "Aplicar diezmo" inicial según la regla; "Recibí" con la firma nueva de `marcarRecibido`. Verificar: `npm test` y `npx tsc --noEmit` en `mobile/` en verde. Commit.

## 5. Verificación y producción

- [x] 5.1 Probar `V8` con una copia de la base de `steward.test` que tenga entregas y planes abiertos (D5). Verificar: los planes abiertos ganan sus ítems sin duplicar lo ya entregado, y las cuentas mantienen su saldo estimado.
- [ ] 5.2 Recorrido en Chrome en `steward.test` con dos usuarios de prueba:
  - crear el mes con los dos diezmos y sus líneas de ingreso;
  - editar el salario en la Opción B y agregar un ingreso a mano;
  - "Recibí" con otro monto;
  - editar uno;
  - marcar recibido sin que aparezca tarjeta;
  - pagar el diezmo desde una cuenta y ver el cuadre;
  - aporte con diezmo;
  - crear meses desde el anual con una prima;
  - comparar opciones;
  - cierre.

  Luego restaurar la sesión de Daniel y borrar los usuarios de prueba. Verificar: todo coincide con las specs. Actualizar `docs/ROADMAP.md` (Etapa 10 hecha). Commit.
- [ ] 5.3 Con confirmación de Daniel: `deploy.ps1 -Projects steward -Action Backup` y `deploy.ps1 -Projects steward` (binario nativo con `V8`). Verificar: health UP, `GET /api/diezmo/pendientes` responde 404, y los planes abiertos de producción tienen sus ítems de diezmo.
