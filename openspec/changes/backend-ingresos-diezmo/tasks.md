# Tasks

## 1. Datos y modelo

- [x] 1.1 Desde `develop`, crear la rama `feature/backend-ingresos-diezmo`. Escribir `V2__ingresos_diezmo.sql` con las tablas e índices de D2:
  - `regla_diezmo`, `ingreso_fijo`, `cuenta`, `movimiento` y `diezmo_cubierto`;
  - el índice único parcial de INGRESO_FIJO por mes;
  - la migración de `miembro.diezmo_aportes` a `regla_diezmo` y el `DROP COLUMN`.
  
  Verificar: `gradlew.bat test` aplica `V1` + `V2` sobre `steward_test`. Un test de migración con un miembro con `diezmo_aportes = true` en `V1` termina con su regla 10 %/BRUTO/aportes.
- [x] 1.2 Modelos de dominio (`ReglaDiezmo`, `IngresoFijo`, `Cuenta`, `Movimiento` con `Tipo`, `ObligacionDiezmo`, `Finanzas`) y puertos SPI de persistencia (regla, ingreso fijo, cuenta, movimiento), con sus adaptadores R2DBC.
  - Las violaciones del índice único de recibido y de la PK de `diezmo_cubierto` se traducen a `YA_RECIBIDO` y `SIN_DIEZMO` (409).
  
  Verificar: tests de integración de los adaptadores, incluidas las dos violaciones.

## 2. Reglas de diezmo e ingresos (backend)

- [x] 2.1 `CalculoDiezmo`, puro, en `domain`:
  - el monto con HALF_UP sobre bruto o neto;
  - el detalle `{porcentaje}% de {nombre} · recibido {d mmm}`, con `formatPorcentaje` y fecha corta en español como en `packages/domain/src/format`.
  
  Verificar: unitarios con las cifras del dominio ($700.000 del bruto, $628.800 del neto, `12,5%`, `25 oct`).
- [x] 2.2 `ReglaDiezmoUseCase` e `IngresoFijoUseCase`:
  - guardar la regla propia, con validación de 0 < porcentaje <= 100;
  - crear, editar y quitar (desactivar) los ingresos propios, con las validaciones de la spec y `INGRESO_NO_ENCONTRADO` para los ajenos o de otro hogar;
  - la cuenta opcional debe ser del hogar.
  
  Endpoints `PUT /api/regla-diezmo`, `POST /api/ingresos-fijos`, `PUT /api/ingresos-fijos/{id}` y `DELETE /api/ingresos-fijos/{id}`. Verificar: contrato de "Regla de diezmo propia" e "Ingresos fijos propios" (todos sus escenarios).
- [x] 2.3 `DiezmoUseCase`:
  - "Recibí", sobre el mes en curso de `IClockPort` (D4), con `aplica_diezmo` según la regla activa;
  - obligaciones pendientes con la regla actual (D3);
  - entregar una o varias, ignorando ids ajenos, y `SIN_DIEZMO` si no queda ninguna.
  
  Endpoints `POST /api/ingresos-fijos/{id}/recibido`, `GET /api/diezmo/pendientes` y `POST /api/diezmo/entregas`. Verificar: contrato de "Recibir un ingreso fijo", "Obligaciones de diezmo" y "Entregar el diezmo", con la fecha de hoy del backend (un reloj fijo rompería los vencimientos de invitaciones del contrato).
- [x] 2.4 `CuentaUseCase` (`POST /api/cuentas`, titular `YO` o `CONJUNTA`), `PUT /api/hogar/diezmo-en-hoy` y `GET /api/finanzas` (`FinanzasUseCase`), con todo lo de la spec "Finanzas del hogar en una lectura". Verificar: contrato de "Cuentas básicas", "Diezmo en Hoy" y "Lo que ve Esposa".
- [x] 2.5 Aislamiento: tests de contrato de "Aislamiento de las finanzas" con dos hogares (ingreso ajeno, entrega ajena, cuenta e ingreso de otro hogar como `cuentaId`) y sin sesión → 401 en cada endpoint nuevo. Verificar: `gradlew.bat check` en verde, en JVM y en `aotTest`.

## 3. Cambios en el hogar (backend)

- [x] 3.1 Aceptar con "diezmar de mis aportes" (D8): `unir` sin `diezmoAportes` y la regla creada o actualizada en la misma transacción, por token y por "mis invitaciones". Verificar: contrato "Diezmar de mis aportes", y que aceptar sin diezmo y sin regla no crea regla.
- [x] 3.2 Salir del hogar (D7): desactivar los ingresos de quien sale, quitar sus cuentas propias y conservar las conjuntas y su regla. Si era el último, todo se borra en cascada. Verificar: contrato "Sus ingresos y cuentas" y un test de que el último que sale no deja filas en `ingreso_fijo`, `cuenta` ni `movimiento`.
- [x] 3.3 Actualizar `backend/README.md` (endpoints nuevos) y `backend/docs/ARCHITECTURE.md` (módulo de finanzas y movimientos). Verificar: `gradlew.bat check` en verde. Commit.

## 4. PWA: superposición y puertos conectados

- [x] 4.1 `packages/domain`: opción `superponer` en `crearAdaptadorDemo`, aplicada en cada lectura y sin persistir (D5). Verificar:
  - un test de que una superposición que cambia `ingresosFijos` se ve en `resumenMes`, y no queda guardada en el storage;
  - los 42 tests siguen en verde.
- [x] 4.2 `api.ts`: tipos y llamadas de finanzas, regla, ingresos, recibido, pendientes, entregas, diezmo en Hoy y cuentas, con `aReglaError` para los códigos nuevos. `PuertosConectados`:
  - lee y guarda las finanzas al iniciar la sesión y después de cada escritura;
  - arma la superposición con la traducción de ids (el usuario de la sesión pasa a `DANIEL`) y la secuencia de los movimientos reales;
  - conecta `ingresos` y `cuentas` y `hogar.definirDiezmoEnHoy` según la tabla de D5.
  
  Verificar: tests en `conectado.spec.ts` para recibir, entregar, guardar regla e ingreso, agregar cuenta, `ETAPA_5` en cuadrar y mover, y aportes que siguen locales.
- [x] 4.3 Pantallas:
  - en Cuentas, en modo conectado, "Cuadrar cuentas" y "Mover dinero" muestran que llegan en una próxima versión sin cambiar nada;
  - en Ajustes, "+ Agregar ingreso fijo", con la misma hoja de edición que un ingreso existente, y "Restablecer datos de prueba" no toca los datos reales.
  
  Verificar: tests de Cuentas (aviso), Ajustes (agregar ingreso, en demo y en conectado) y ui-shell ("Restablecer en modo conectado").
- [x] 4.4 Recorridos conectados en los tests de la PWA, con el backend simulado:
  - onboarding 1 a 5, con "Pasos 2 a 4 en el backend" y "Volver al paso 3";
  - Hoy con "Salario recibido", "Entregado" y `YA_RECIBIDO`;
  - Ajustes con "Editar el salario en modo conectado".
  
  Verificar: `npx ng test` en verde. Actualizar `frontend/README.md` (qué es real y qué de prueba en modo conectado). Commit.

## 5. Verificación y cierre

- [ ] 5.1 Desplegar con `local-deploy.ps1 -Project steward` y recorrer en `steward.test`, con dos personas, por el acceso de desarrollo:
  1. un hogar nuevo completa los 5 pasos (diezmo 10 % del bruto, "Salario Daniel" de $7.000.000/$6.288.000, una cuenta) e invita a la segunda persona, que se une;
  2. en Hoy, Daniel marca "Recibí" y aparece "Disponible para diezmar $700.000 · 10% de Salario Daniel";
  3. la segunda persona abre Hoy y ve el salario recibido y la misma tarjeta;
  4. "Entregado" quita la tarjeta para los dos.
  
  Verificar: el criterio de cierre de la Etapa 3 del ROADMAP, sin errores en la consola.
- [ ] 5.2 En el hogar real "Jimenez Navarro" de `steward.test`, configurar el salario y la regla desde Ajustes ("+ Agregar ingreso fijo"), según el plan de migración del diseño. Verificar: Hoy muestra el ingreso como "Por recibir".
- [ ] 5.3 `docs/ROADMAP.md`: marcar la Etapa 3 y anotar en la Etapa 4 que aportes, pagos y gastos pasan al backend sobre la tabla `movimiento`; `AGENTS.md` si cambia algo de la estructura. Verificar: `openspec validate backend-ingresos-diezmo --strict` sin errores. Commit.
