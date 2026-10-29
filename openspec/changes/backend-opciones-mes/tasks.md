# Tasks

## 1. Dominio compartido

- [x] 1.1 Desde `develop`, crear la rama `feature/backend-opciones-mes`. En `packages/domain` (D1):
  - `duplicarEscenario`, `usarEscenario` y `probarAbonoComoOpcion` reciben `hoy` y responden `MES_NO_BORRADOR` según el estado efectivo y la tabla de D1;
  - `usarEscenario` tampoco cambia a otra opción si la principal tiene pagos o gastos en el mes (Risks);
  - `quitarEscenario` con las reglas de D5, y `PlanPort.quitarOpcion` en el adaptador de prueba;
  - el adaptador de prueba pasa `hoy()`.
  
  Verificar: tests de cada fila de la tabla de D1, incluidos "usar la misma en un mes Activo" y "otra con pagos", y de cada regla de D5 (la letra libre vuelve a usarse). Los tests existentes siguen en verde.

## 2. Backend

- [x] 2.1 `IPlanPersistencePort.crearEscenario` con su adaptador. `PlanUseCase.duplicar` y `POST /api/planes/{id}/escenarios` (D2, D3), con `MES_NO_BORRADOR`, `MES_CERRADO`, `MUCHAS_OPCIONES`, el reintento por letra y `PLAN_NO_ENCONTRADO`. Verificar:
  - contrato de "Duplicar una opción" (sus dos escenarios), con cuotas sin avanzar y el crédito conservado;
  - dos duplicados a la vez dejan B y C.
- [x] 2.2 `IPlanPersistencePort.quitarEscenario`, `PlanUseCase.quitarOpcion` y `DELETE /api/planes/{id}/escenarios/{escenarioId}` (D5). Verificar: contrato de "Quitar una opción" (sus tres escenarios), `OPCION_CON_PAGOS` y `MES_NO_BORRADOR`.
- [x] 2.3 `PlanUseCase.probarAbono` y `POST /api/creditos/{id}/probar` (D3). Verificar: contrato de "Probar un abono como opción" (sus dos escenarios), `CREDITO_NO_ENCONTRADO` y abono inválido.
- [x] 2.4 `usar` con la regla de D1 y la de los pagos. Verificar:
  - contrato de "Usar otra opción archiva las demás" y "Cambiar de opción en un mes Activo";
  - aislamiento de los endpoints nuevos (404 ajeno, 401 sin sesión);
  - `gradlew.bat check` en verde, en JVM y en `aotTest`.
- [x] 2.5 Actualizar `backend/README.md` (endpoints, `MES_NO_BORRADOR`). Commit.

## 3. PWA

- [ ] 3.1 `api.ts`: `duplicarOpcion`, `quitarOpcion` y `probarAbono`. `PuertosConectados` según D4, sin `ETAPA_7`. Verificar: tests en `conectado.spec.ts` de duplicar (cuerpo y id devuelto), quitar, probar un abono y `MES_NO_BORRADOR` propagado.
- [ ] 3.2 Pantallas: fuera los avisos de "+ Duplicar", Comparar y "Probarlo como opción" en modo conectado, y el mensaje de `MES_NO_BORRADOR`. "Quitar opción" con su hoja de confirmación (D5), en los dos modos. Verificar: tests de pantalla en modo conectado; en modo demo, "+ Duplicar" en el mes en curso muestra el mensaje, y quitar la Opción C de noviembre la quita; sin "Quitar opción" con una sola opción ni en la que está en uso.
- [ ] 3.3 Recorrido conectado con el backend simulado: noviembre en Borrador → "+ Duplicar" dos veces → quitar la C → probar un abono desde el crédito → Comparar con solo Créditos resaltada → "Usar B" → las demás archivadas. Verificar: `npx ng test` en verde. Actualizar `frontend/README.md`. Commit.

## 4. Verificación y cierre

- [ ] 4.1 Desplegar con `local-deploy.ps1 -Project steward` (con `powershell.exe -File`) y recorrer en `steward.test`, con dos personas de prueba, por el acceso de desarrollo:
  1. un hogar con un crédito y el plan de noviembre en Borrador;
  2. una persona duplica la Opción A dos veces y quita una de las copias; la otra prueba un abono de $2.000.000 desde el crédito;
  3. las dos ven las tres opciones con su autor, y Comparar resalta solo lo que cambia;
  4. "Usar" una deja las demás archivadas para las dos;
  5. en octubre (Activo), "+ Duplicar" muestra que el mes ya está en curso.
  
  Verificar: el criterio de cierre de la Etapa 7, sin errores en la consola. Borrar las personas y el hogar de prueba al terminar.
- [ ] 4.2 `docs/ROADMAP.md`: marcar la Etapa 7. Verificar: `openspec validate backend-opciones-mes --strict` sin errores. Commit.
