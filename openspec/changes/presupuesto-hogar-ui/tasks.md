# Tasks

## 1. Rama y dominio compartido

- [x] 1.1 En la raíz del repo steward, crear la rama `feature/presupuesto-hogar` desde `main`. Verificar con `git branch --show-current`.
- [x] 1.2 Crear `packages/domain/`: `package.json` (solo TypeScript y Vitest de desarrollo), `tsconfig.json` estricto y `src/index.ts`. Verificar que `npx tsc --noEmit` y `npx vitest run` corren (sin tests todavía).
- [x] 1.3 `src/model/`: tipos del modelo del handoff (hogar, usuario, miembro, invitación, regla de diezmo, ingreso fijo, cuenta, crédito, categoría, plan del mes, escenario, ítem del plan, evento anual, proyección de aporte, movimiento, cuadre y cierre). Montos en enteros de pesos. Verificar que compila.
- [x] 1.4 `src/format/`: formato COP (`$1.500.000`, `−$12.000`), entrada de montos (solo dígitos, formateo mientras se escribe), fechas cortas en español (`26 oct`, `LUN 26`) y nombres de mes. Verificar con tests de los ejemplos del spec `steward-ui-shell` (`2538000` → `$2.538.000`).
- [x] 1.5 `src/rules/`: funciones puras para libre, plan, pagado y vs. plan del mes; obligación de diezmo al recibir (Separado o Agrupado); aporte implícito por pago desde una cuenta externa; detección de pago duplicado; gasto variable acumulado; cuadre con ajuste; cierre con reparto válido; simulador de abono a crédito; duplicar escenario y "usar opción" (archiva las demás); crear mes (copiar anterior, solo fijos, desde cero); plan anual y sus KPI. Verificar con tests de Vitest que reproducen cada cifra de los escenarios de `steward-hoy`, `steward-planear`, `steward-cuentas` y `steward-ajustes` (por ejemplo, libre $3.436.000, diezmo $700.000, "Gastos sin registrar" $220.000, octubre cerrado con $1.166.000 pasado a noviembre).
- [x] 1.6 `src/ports/`: interfaces asíncronas `HogarPort`, `IngresosPort`, `PlanPort`, `MovimientosPort`, `CuentasPort` y `CierrePort`, más `subscribe(listener)` para avisar de cambios y `SessionPort` (sesión demo). Verificar que compila sin depender de `demo/`.
- [x] 1.7 `src/demo/`: semilla anclada al mes del reloj, con los meses M−1 Cerrado, M Activo, M+1 Borrador (A y B) y M+2 sin plan, y las cifras de los artboards. Agregar el adaptador en memoria que implementa todos los puertos usando `rules/`, la persistencia por `StorageLike` bajo `steward-demo/v1` (con versión de esquema y try/catch), la sesión en `steward-demo/session` y `reset()`. Verificar con tests de reloj fijo en 2026-10-26: la semilla da los totales de Hoy, un registro sobrevive a guardar y recargar desde el storage, y `reset()` vuelve a $3.436.000.
- [x] 1.8 Escribir `packages/domain/README.md` con qué contiene, la regla de que las pantallas solo usan `ports/` y cómo el backend debe reproducir los tests de `rules/`. Commit en la rama.

## 2. PWA: base y shell

- [x] 2.1 Crear `frontend/` con Angular 22: proyecto `frontend` en `angular.json`, standalone, zoneless, Vitest y salida en `dist/frontend/browser`. Agregar `paths` `@steward/domain` → `../packages/domain/src` y su `include`. Verificar que `npx ng build frontend --configuration production` compila un componente que importa `formatCop` del dominio. Si no compila, aplicar el plan alternativo de D1 y anotarlo.
- [x] 2.2 Tailwind 4 con los tokens del handoff en `@theme` (colores, categorías, radios, Inter y JetBrains Mono por Google Fonts, sin sombras). Agregar `ngsw-config.json` que solo cachea los archivos de la app, más el `manifest` con nombre, colores e íconos. Verificar que el build incluye `ngsw-worker.js` y que `/api` no está en `ngsw.json`.
- [x] 2.3 Proveedores de los puertos (`InjectionToken` y `provideDemoAdapter()` con `localStorage` y el reloj real) y servicios con signals que recargan al recibir `subscribe`. Verificar con un test de TestBed: al registrar un gasto, el signal de Hoy cambia sin recargar.
- [x] 2.4 Shell responsive: barra inferior por debajo de 1024 px y menú lateral desde 1024 px, con Hoy, Planear y Cuentas; aviso "Datos de prueba"; rutas de D5; guards de sesión y de hogar configurado. Verificar con tests de los escenarios "Móvil", "Web" y "Ajustes desde los avatares".
- [x] 2.5 Componentes de `shared/`: `money` (con Ocultar montos), `money-input`, `avatar`, `segmented`, `sheet` (bottom sheet en móvil y diálogo en web, con foco atrapado y Escape), `list-row`, `kpi`, `month-header` e íconos SVG inline. Zona tocable de al menos 44 px. Verificar con tests unitarios de `money-input` y de `sheet` (Escape cierra y el foco vuelve).
- [x] 2.6 `frontend/README.md` (comandos, estructura, cómo cambiar el adaptador). Commit.

## 3. PWA: acceso, onboarding e invitación

- [x] 3.1 Acceso (`Acceso.dc.html`) con las tres opciones que inician la sesión demo y el ruteo según el hogar esté configurado o no, y Activar Face ID (`FaceId.dc.html`) con omitir. Verificar con los escenarios "Primera vez", "Hogar ya configurado" y "Omitir".
- [x] 3.2 Onboarding 1 a 5 (`Onb1`–`Onb5`) con avance, atrás, pasos que se pueden saltar, vista previa del diezmo e invitaciones con Pendiente y Reenviar. Al terminar, el hogar queda configurado y se abre Hoy. Verificar con los escenarios "Vista previa del diezmo", "Saltar cuentas" e "Invitación pendiente", y con un test del flujo completo.
- [x] 3.3 Invitación recibida (`Invitado.dc.html`) en `/invitacion/:token` (en demo, un token de ejemplo), con nombre, diezmo opcional y "Unirme". Verificar con el escenario "Unirse".
- [x] 3.4 Comparar cada pantalla del grupo a 390 y 1280 px con su artboard y corregir las diferencias. Commit.

## 4. PWA: Hoy y registros

- [x] 4.1 Hoy (`Main.dc.html`): resumen del mes, tarjeta de diezmo (Separado o Agrupado) con Entregado, Ingresos (fijos y aportes agrupados), Por pagar con vencimiento, Ya pagado con plan vs. real y avatar, y gasto variable acumulado. Verificar con los escenarios "Datos de ejemplo", "Plan vs. real en un pago", "Salario recibido" y "Entregado".
- [x] 4.2 + Aporte (`Aporte.dc.html`): quién, cuánto, mes, cuenta opcional, Aplicar diezmo, la línea "{Mes} pasa a tener $X más" y Guardar aporte. Verificar con el escenario "Aporte para el mes siguiente".
- [x] 4.3 Marcar pago (`Pagar.dc.html`): valor prellenado, pagado por, desde (con el aviso de "Su cuenta" como aporte) y "Ya lo pagó X el dd mmm". Verificar con los escenarios "Pago directo" y "Pago duplicado".
- [x] 4.4 Registrar gasto (`Gasto.dc.html`): monto, ítem del plan o "No estaba planeado", nota, pagó y desde. Verificar con el escenario "Gasto variable" y con un gasto no planeado que resta de libre.
- [x] 4.5 Comparar con los artboards a 390 y 1280 px (las hojas como diálogo en web) y corregir. Commit.

## 5. PWA: Planear

- [x] 5.1 Planear inicio (`PlanInicio.dc.html`): año, próximos meses con su estado y meses cerrados. Verificar con el escenario "Abrir un mes sin plan".
- [x] 5.2 Mes sin plan (`MesVacio.dc.html`) con sus tres opciones y lo que el mes ya trae. Verificar con el escenario "Copiar mes anterior".
- [x] 5.3 Mes en borrador (`Planear.dc.html`): opciones con su autor, "dejaría libre", ingresos y gastos por categoría, diezmo bloqueado, + Duplicar y Usar opción. Verificar con los escenarios "Duplicar", "Diezmo bloqueado" y "Usar una opción".
- [x] 5.4 Comparar (`Comparar.dc.html`, web) con filas resaltadas, Queda libre por opción y Usar X, con desplazamiento horizontal por debajo de 1024 px. Verificar con el escenario "Filas distintas" y una captura a 390 px sin columnas comprimidas.
- [x] 5.5 Plan anual (`Anual.dc.html`, web): cuadrícula, eventos, aportes proyectados tenues, KPI y "Crear meses desde este plan". Verificar con el escenario "Evento del año" y comprobar que editar un mes creado no cambia el anual.
- [x] 5.6 Cierre de mes (`Cierre.dc.html`): plan vs. real, Sin registrar, reparto y Cerrar (con solo lectura después). Verificar con los escenarios "Cerrar octubre" y "Reparto inválido".
- [x] 5.7 Comparar con los artboards (Comparar a 1280 px y Anual a 1440 px) y corregir. Commit.

## 6. PWA: Cuentas

- [x] 6.1 Cuentas (`Cuentas.dc.html`): saldo del hogar estimado, cuentas con titular y cuadre, filtro, aviso de más de 30 días, + Agregar, Mover dinero y créditos. Verificar con los escenarios "Filtro por titular" y "Cuenta sin cuadrar".
- [x] 6.2 Cuadrar (`Cuadrar.dc.html`): un campo por cuenta, la diferencia en vivo, Omitir, el total de "Gastos sin registrar" y Guardar saldos. Verificar con el escenario "Diferencia".
- [x] 6.3 Detalle de crédito (`Credito.dc.html`): datos, últimos pagos, Actualizar saldo, Registrar abono, simulador y "Probarlo como opción". Verificar con los escenarios "Simular abono" y "Probarlo como opción".
- [x] 6.4 Comparar con los artboards y corregir. Commit.

## 7. PWA: Ajustes

- [x] 7.1 Ajustes (`Ajustes.dc.html`):
  - hogar y miembros, con invitar y salir confirmando;
  - mis ingresos y diezmo, más Diezmo en Hoy;
  - categorías;
  - seguridad y privacidad: Face ID al abrir, Ocultar montos y Cerrar sesión;
  - "Restablecer datos de prueba".

  Verificar con los escenarios "Miembros de ejemplo", "Agrupado", "Nueva categoría", "Ocultar montos", "Cerrar sesión", "Restablecer" y "Persistencia".
- [x] 7.2 Comparar con el artboard y corregir. Commit.

## 8. PWA en el entorno local

- [x] 8.1 Correr `..\infra\local-deploy.ps1 -Project steward` desde PowerShell nativo, sin `2>&1`. Verificar que `http://steward.test/` sirve la PWA (ya no "Próximamente"), que una ruta profunda como `/planear/2026-11` carga, y que el service worker se registra.
- [x] 8.2 Recorrido completo en el navegador a 390 y 1280 px: primer acceso → onboarding → Hoy → aporte → pago "Su cuenta" → gasto → cuadrar → cerrar mes → planear el siguiente. Verificar que no hay errores en consola y que las cifras coinciden con los tests del dominio.

## 9. App Expo: base

- [x] 9.1 En `mobile/`, subir a Expo SDK 57 con `npx expo install expo@~57 --fix`, sin cambiar `app.json` (versión 1.0.2, identificadores y `projectId`). Quitar las dependencias de la v1 que ya no se usen y agregar `@tanstack/react-query` y `@expo-google-fonts/inter` / `jetbrains-mono`. Verificar con `npx expo-doctor`.
- [x] 9.2 `paths` `@steward/domain` en `tsconfig.json` y `watchFolders` en `metro.config.js`. Verificar que `npx expo export --platform web` compila una pantalla que importa `formatCop`; si falla, aplicar el plan alternativo de D1.
- [x] 9.3 Reemplazar `src/` por la estructura de D6: tokens en `ui/`, `data/` (adaptador demo con AsyncStorage bajo `steward-demo/v1` y hooks de react-query invalidados por `subscribe`), tabs Hoy, Planear y Cuentas, grupo `(acceso)` y modales. Verificar con un test de Jest: al registrar un gasto, el hook de Hoy se actualiza. Agregar otro test que guarda datos y confirma que `@steward/budget_v3` sigue intacta.
- [x] 9.4 Actualizar `mobile/README.md` y el README raíz de steward con la estructura nueva, y anotar que esta rama no se publica. Commit.

## 10. App Expo: pantallas

- [x] 10.1 Acceso, Activar Face ID, Onboarding 1 a 5 e Invitación recibida. Verificar con un test de Jest del flujo primer acceso → onboarding → Hoy.
- [x] 10.2 Hoy con Aporte, Marcar pago y Registrar gasto como `formSheet`. Verificar con un test de Jest de "Pago directo", con las mismas cifras que el test de la PWA.
- [x] 10.3 Planear inicio, Mes sin plan, mes en borrador, Comparar y Anual (estos dos con desplazamiento horizontal) y Cierre. Verificar con un test de Jest de "Cerrar octubre".
- [x] 10.4 Cuentas, Cuadrar y Detalle de crédito. Verificar con un test de Jest de "Diferencia" ($220.000).
- [x] 10.5 Ajustes, incluidos Ocultar montos, Cerrar sesión y Restablecer datos de prueba. Verificar con un test de Jest de "Ocultar montos".
- [x] 10.6 Comparar cada pantalla en un simulador o dispositivo con su artboard de 390 px y corregir. Commit.

## 11. App: TestFlight y paridad

- [x] 11.1 En `mobile/`, poner `version` en 1.1.0 en `app.json` y agregar a `eas.json` el perfil de build `testflight` (`distribution: store`, `autoIncrement: true`) y el de submit `testflight` (mismo `ascAppId`). Verificar que `npx expo config --type public` da 1.1.0 y que `production` no cambió.
- [x] 11.2 Desde `mobile/`, `npx eas-cli build --profile testflight --platform ios --auto-submit-with-profile testflight` (lo corre Daniel si EAS pide credenciales de Apple). Verificar que el build termina, que llega a TestFlight como 1.1.0 y que ninguna versión está en revisión en App Store Connect.
- [ ] 11.3 Agregar los testers internos en App Store Connect (TestFlight → grupo interno). Verificar que pueden instalar.
- [x] 11.4 Verificar que `main` sigue generando la v1: `git show main:mobile/app.json` en 1.0.2 y `git show main:mobile/eas.json` con `production` sin cambios.
- [x] 11.5 Paridad: desde datos iniciales, hacer en la app y en la PWA la misma secuencia (pagar Mastercard desde Davivienda, registrar un aporte para el mes siguiente). Verificar que las dos muestran el mismo libre, el mismo pagado y el mismo vs. plan.
- [x] 11.6 En `mobile/README.md` y el README raíz, cambiar "esta rama no se publica" por cómo se distribuye por TestFlight (perfil y comando).

## 12. Cierre

- [x] 12.1 Actualizar `docs/ROADMAP.md` (nueva etapa "UI con datos de prueba" cerrada; el objetivo actual pasa al backend), `docs/DEPLOYMENT.md` (`steward.test` sirve la PWA; el VPS sigue con "Próximamente") y el portafolio. Verificar con `..\infra\portfolio\sync-portfolio.ps1 -DryRun`.
- [x] 12.2 Verificación integral: los tests de `packages/domain`, `frontend` y `mobile` en verde; `..\infra\local-deploy.ps1 -Project steward` termina en `[OK]`; y `openspec validate presupuesto-hogar-ui --strict` pasa. Push de la rama `feature/presupuesto-hogar` solo si Daniel lo pide.
