# Tasks

## 1. Dominio compartido

- [x] 1.1 Desde `develop`, crear la rama `feature/backend-plan-anual`. En `packages/domain` (D1):
  - `crearAnual` y `editarProyeccion`;
  - `resumenAnual` con una fila por categoría y una de aportes por miembro;
  - `editarMontoAnual` con categoría sin fila;
  - `crearMesesDesdeAnual` sin meses cerrados;
  - `PlanPort.crearAnual` y `editarProyeccion` en el adaptador de prueba.
  
  Verificar: tests de cada regla (año pasado, `YA_EXISTE`, proyección en 0 que se quita, categoría nueva editable, mes cerrado que no gana plan). Los tests existentes siguen en verde (ajustados donde cuentan filas).

## 2. Backend

- [x] 2.1 `V7__plan_anual.sql` (D2), y modelo, puerto y adaptador del anual: crear, leer desde un año, upsert de celda, evento y proyección (0 la borra). Verificar: tests de integración del adaptador, incluido `YA_EXISTE` por índice y la celda que se reemplaza.
- [x] 2.2 `AnualUseCase` y `AnualController` (D3): crear, celdas, eventos y proyecciones con sus validaciones. Verificar: contrato de "Crear el plan anual" y "Celdas, eventos y aportes proyectados" (sus escenarios), `ANUAL_NO_ENCONTRADO`, `CATEGORIA_NO_ENCONTRADA` y `MIEMBRO_NO_ENCONTRADO`.
- [x] 2.3 "Crear meses desde este plan" (D4). Verificar: contrato de "Crear los meses de 2027", con la plantilla del último plan, el ajuste, "Eventos del año" creada una vez, un mes con plan que no cambia, un mes cerrado que no gana plan y el anual en CREADO.
- [x] 2.4 `GET /api/finanzas` con `anuales` y `proyecciones` (D5). Aislamiento y 401. Al salir los últimos miembros no queda ningún anual. Verificar: contrato "El plan anual"; `gradlew.bat check` en verde, en JVM y en `aotTest`.
- [x] 2.5 Actualizar `backend/README.md`. Commit.

## 3. PWA

- [ ] 3.1 `api.ts` y `superposicion.ts` con anuales y proyecciones reales (D5). Verificar: tests de la superposición: el anual real en `resumenAnual`; una proyección tenue en `ingresosDelMes`; ningún anual de prueba.
- [ ] 3.2 `PuertosConectados` según D6, sin `ETAPA_8` y con `demo` en `null`. Verificar:
  - tests en `conectado.spec.ts` de cada escritura del anual;
  - en modo conectado no hay aviso "Datos de prueba" ni sección de datos de prueba en Ajustes;
  - los tests que usaban `p.demo` en modo conectado se ajustan.
- [ ] 3.3 Pantalla del anual: "Crear plan anual {año}" sin anual, y filas de aportes editables. Verificar: tests de pantalla en los dos modos.
- [ ] 3.4 Recorrido conectado con el backend simulado: 2027 sin anual → crear → celda → evento → aporte proyectado → KPI → "Crear meses desde este plan" → los meses en Planear. Verificar: `npx ng test` en verde. Actualizar `frontend/README.md`. Commit.

## 4. Verificación y cierre

- [ ] 4.1 Desplegar con `local-deploy.ps1 -Project steward` (con `powershell.exe -File`) y recorrer en `steward.test`, con dos personas de prueba, por el acceso de desarrollo:
  1. una crea el plan anual de 2027 y pone Gastos fijos en $800.000 de enero a diciembre;
  2. la otra agrega "SOAT" en marzo por $1.200.000 y su aporte proyectado de enero en $2.000.000;
  3. las dos ven la misma cuadrícula y los mismos KPI;
  4. "Crear meses desde este plan" crea los meses de 2027 en Borrador, y marzo trae SOAT;
  5. no hay aviso "Datos de prueba".
  
  Verificar: el criterio de cierre de la Etapa 8, sin errores en la consola. Borrar las personas y el hogar de prueba al terminar.
- [ ] 4.2 `docs/ROADMAP.md`: marcar la Etapa 8. Verificar: `openspec validate backend-plan-anual --strict` sin errores. Commit.
