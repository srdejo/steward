# Tasks

## 1. Dominio compartido

- [x] 1.1 Archivar `diezmo-como-gasto` (con permiso de Daniel) y crear la rama `feature/usabilidad-plan` desde la de la Etapa 10. En `packages/domain`, el modelo (D1):
  - `ItemPlan.ingresoPlanId` y `ajustadoAMano`;
  - `IngresoPlan.bruto`;
  - `Movimiento.capital`;
  - el seed con los enlaces.

  Verificar: `npm test` compila y las cifras de "Datos de ejemplo" de Hoy no cambian.
- [x] 1.2 Diezmo que sigue a su línea (D1, D2):
  - `diezmoSugerido`;
  - `guardarIngresoPlan` recalcula el diezmo enlazado;
  - `guardarItem` marca "ajustado a mano";
  - `recalcularDiezmo`;
  - quitar una línea quita su diezmo;
  - "Aplicar diezmo" en una línea nueva;
  - los enlaces al nacer y al duplicar;
  - `guardarIngresoFijo` propaga a los meses abiertos.

  Verificar: tests de los escenarios "Cambiar el salario en el plan", "Diezmo ajustado a mano", "Diezmo ya pagado", "Ingreso agregado con diezmo", "Aumento de salario" y "Una línea cambiada a mano".
- [x] 1.3 Corregir y borrar registros (D3): `corregirRegistro` y `borrarRegistro`, con el crédito (`capital`), el cuadre, el aporte y su diezmo, y el mes cerrado. Verificar: tests de "Borrar un gasto equivocado", "Corregir el monto de un pago", "Borrar el pago de una cuota", "Registro ya cuadrado" y "Borrar un registro de un mes cerrado".
- [x] 1.4 Borrar el plan y empezar de nuevo (D4): `borrarPlan`, con sus conteos, y `empezarDeNuevo`, con el saldo de las cuentas; `movimientosDeCuenta` (D7). Verificar: tests de "Borrar un mes con pagos", "Borrar un mes cerrado", "Empezar de nuevo" y "De dónde sale el saldo". `npm test` en verde.
- [x] 1.5 Puertos y adaptador demo:
  - `PlanPort.borrarPlan`, `conteoBorrado` y `recalcularDiezmo`;
  - `MovimientosPort.corregirRegistro` y `borrarRegistro`;
  - `HogarPort.empezarDeNuevo`.

  Verificar: `demo.test.ts`.

## 2. Backend

- [x] 2.1 `V9__usabilidad_plan.sql` (D8), con un test de migración: líneas con su bruto, diezmos enlazados a su línea (FIJO y EXTRA), "ajustado a mano" cuando no coincide, `capital` y la FK del aporte.
- [x] 2.2 Plan (D1, D2, D4):
  - las líneas guardan el bruto y su diezmo se recalcula;
  - `POST .../items/{id}/recalcular`;
  - "Aplicar diezmo" en `POST .../ingresos`;
  - el enlace al nacer, al duplicar y en el anual;
  - `editarIngreso` propaga a los meses abiertos;
  - `DELETE /api/meses/{anio}-{mes}` y `GET /api/meses/{anio}-{mes}/borrado`;
  - `POST /api/hogar/empezar-de-nuevo`.

  Verificar: contrato de los escenarios de `steward-plan-mes` de este cambio, "Un ingreso fijo editado actualiza los meses abiertos" y "Empezar de nuevo".
- [x] 2.3 Registros (D3): `capital` en `pagar` y `abonar`, `PATCH` y `DELETE /api/registros/{id}`, 404 `REGISTRO_NO_ENCONTRADO` y el aislamiento. Verificar: contrato de "Corregir o borrar un registro" y "Registros en un mes cerrado". `gradlew.bat check` en verde, en JVM y en `aotTest`.
- [x] 2.4 `backend/README.md` y `docs/ARCHITECTURE.md` con los endpoints nuevos. Commit.

## 3. PWA

- [x] 3.1 `api.ts`, `superposicion.ts` y `PuertosConectados` con los campos y los endpoints nuevos. Verificar: `conectado.spec.ts` con borrar un registro, borrar un plan y "Volver a calcular".
- [x] 3.2 Planear (D5):
  - hojas de ingreso y de gasto con "Guardar", "Quitar" con confirmación y el aviso "Guardado";
  - "+ Gasto" y "+ Ingreso" con su monto;
  - categorías con indicador;
  - el mes en curso editable;
  - "Borrar plan de {mes}" con sus conteos.

  Verificar: tests de pantalla de los escenarios de `steward-planear`.
- [x] 3.3 Hoy (D6): la hoja del registro (corregir y borrar) y la lista de registros; el diezmo sin "Venció". Cuentas: el detalle con sus movimientos. Ajustes (D7): "Empezar de nuevo"; sin Face ID ni "Ocultar montos". Verificar: tests de pantalla de los escenarios de `steward-hoy`, `steward-cuentas` y `steward-ajustes`; `npx ng test` y `ng build` sin avisos. Actualizar `frontend/README.md`. Commit.

## 4. App Expo

- [x] 4.1 `mobile/`: lo mínimo para compilar con el dominio nuevo. Verificar: `npx tsc --noEmit` y `npm test` en verde. Commit.

## 5. Verificación y producción

- [ ] 5.1 Probar `V9` con una copia de `steward.test` con datos de la Etapa 10 (líneas, diezmos y pagos). Verificar: cada diezmo queda enlazado a su línea, y los saldos de cuentas y créditos no cambian.
- [ ] 5.2 Recorrido en Chrome en `steward.test` con dos usuarios de prueba:
  - editar el mes en curso con las hojas;
  - cambiar un salario y ver su diezmo;
  - ajustar un diezmo a mano y volverlo a calcular;
  - borrar un gasto equivocado y corregir un pago;
  - deshacer un "Recibí";
  - borrar el plan de un mes con pagos;
  - el detalle de una cuenta;
  - empezar de nuevo.

  Luego restaurar la sesión de Daniel y borrar los usuarios de prueba. Actualizar `docs/ROADMAP.md`: Etapa 11 hecha, la app móvil pasa a la 12 y passkeys a la 13. Commit.
- [ ] 5.3 Con confirmación de Daniel:
  - `deploy.ps1 -Projects steward -Action Backup`;
  - binario nativo y contrato contra el binario;
  - `deploy.ps1 -Projects steward`.

  Verificar: health UP, versión 9 de Flyway, y los diezmos de producción enlazados a sus líneas.
