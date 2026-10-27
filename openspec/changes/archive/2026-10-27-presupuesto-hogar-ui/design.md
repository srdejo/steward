# Design

## Context

- **Fuente del diseño**: `%USERPROFILE%\Documents\presupuesto-hogar\design\*.dc.html` (22 artboards, HTML con estilos inline) y `HANDOFF.md` (reglas, modelo de datos, tokens). Los artboards móviles miden 390 px; Comparar y Anual son web (1280 y 1440 px). Los enlaces entre artboards dan el mapa de navegación (por ejemplo, Main → Ajustes, Aporte, Pagar, Gasto, PlanInicio y Cuentas; Credito → Comparar).
- **Repo steward** (cambio `incorporar-steward`): `mobile/` es la app Expo v1 (SDK 54, expo-router, AsyncStorage con la clave `@steward/budget_v3`, versión 1.0.2 en App Store). `frontend/` y `backend/` no existen. Ramas: `main` (v1) y `feature/version1`.
- **Convenciones del workspace** (denti-caja):
  - Frontend: Angular 22 standalone con signals, Tailwind 4, Vitest, `@angular/service-worker`; carpetas `core/`, `features/` y `shared/`; montos con `cop.pipe` y la directiva `money-input`.
  - App: Expo SDK 57, expo-router, `@tanstack/react-query`, Jest con `@testing-library/react-native`.
- **Restricciones de la infra**: `local-deploy.ps1` construye el frontend con `npm ci` (si falta `node_modules`) y `npx ng build frontend --configuration production` dentro de `frontend/`, y publica `dist/frontend/browser`. `deploy.ps1` hace lo mismo con `ng build`. Con `BackendEnabled = $false`, el VPS sigue publicando "Próximamente" aunque exista el frontend.

## Goals / Non-Goals

**Goals:**
- Las 22 pantallas usables de punta a punta en `steward.test` y en un build interno de la app, con las mismas cifras en las dos.
- Una sola implementación de las reglas del handoff (diezmo, aporte implícito, cuadre, cierre, escenarios) que después se pueda llevar al backend y comparar con sus tests.
- Conectar el backend más adelante cambiando solo el adaptador.

**Non-Goals:**
- Llamadas HTTP, autenticación real, WebAuthn o biometría del sistema, notificaciones.
- Migrar los datos de la v1 o publicar en las tiendas (TestFlight sí, ver D8).
- Pixel-perfect automatizado: la fidelidad se revisa contra los artboards en dos anchos (390 y 1280 px).

## Decisions

### D1. Dominio compartido como código TypeScript por ruta, sin workspaces npm
`packages/domain/` es TypeScript puro, sin dependencias de runtime:
- `model/`: tipos del modelo del handoff;
- `rules/`: funciones puras para libre, vs. plan, diezmo, aporte implícito, cuadre, cierre, simulador de crédito y duplicación de escenarios;
- `ports/`: interfaces asíncronas por módulo (`HogarPort`, `IngresosPort`, `PlanPort`, `MovimientosPort`, `CuentasPort`, `CierrePort`);
- `demo/`: el adaptador en memoria, que implementa todos los puertos y se crea con un `StorageLike` y un reloj;
- `format/`: COP, fechas cortas en español y entrada de montos.

Tiene su propio `package.json`, que solo trae Vitest y TypeScript para sus tests. Cada app lo importa como `@steward/domain`:
- **Angular**: con `paths` en `tsconfig.json`, más el directorio en `include`. El builder de esbuild compila el TS de fuera de la carpeta del proyecto.
- **Expo**: con `paths` en `tsconfig.json`, que Expo resuelve, y `watchFolders` en `metro.config.js`.

- *Alternativa*: workspaces npm en la raíz del repo. Se descarta porque Angular y React Native comparten raíz de `node_modules`, se sube el dependency hell y los scripts de deploy hacen `npm ci` dentro de cada app (con workspaces no habría `frontend/node_modules` ni lockfile propio).
- *Alternativa*: un paquete publicado. Es demasiado ceremonial para dos consumidores en el mismo repo.

### D2. Puertos asíncronos y estado observable
Los puertos devuelven `Promise` (así serán con HTTP) y el adaptador demo resuelve de inmediato. Para que "las pantallas reflejen al instante", el adaptador emite un evento de cambio (`subscribe(listener)`) después de cada escritura. Cada app lo envuelve con su modelo de reactividad, y las pantallas MUST NOT importar `demo/` directamente:
- **Angular**: un servicio por puerto (`InjectionToken` + `provide*Port`) expone `resource`/signals y recarga al recibir el evento.
- **Expo**: hooks con `@tanstack/react-query`, que invalidan las consultas al recibir el evento. Así lo usa denti-caja y luego sirve igual contra HTTP.

### D3. Datos de prueba anclados al mes en curso
La semilla de `demo/seed.ts` toma de referencia el mes del reloj:
- mes actual (M): Activo, con los ingresos, el plan y los pagos de `Main.dc.html`;
- M+1: Borrador, con las opciones A y B de `Planear.dc.html`;
- M+2: sin plan, para Mes sin plan;
- M−1: Cerrado.

Las cifras son las del handoff y los artboards, con dos ajustes porque los datos ilustrativos no cuadran entre sí:
- **Pagado de Hoy**: es $2.613.000 y no $2.890.000. Con el plan de $5.390.000 y lo que sigue en Por pagar, $2.890.000 no se alcanza. Libre $3.436.000 y Vs. plan −$62.000 sí se conservan.
- **Sobrante de octubre**: aparece en noviembre solo al cerrar octubre. Antes del cierre, las opciones de noviembre dejan $1.166.000 menos que en `Planear.dc.html` y `Comparar.dc.html`; después, coinciden.

Reglas de cálculo:
- **Libre** = fijos del mes (recibidos o por recibir) + aportes reales (incluidos los implícitos) + sobrante pasado − Σ máx(plan, real) por ítem − gastos no planeados − ajustes de cuadre.
- **Vs. plan** = diferencias de los ítems fijos pagados + sobregiro de variables + no planeados. Los nombres de mes salen del reloj, así que "Cierre de octubre" se llama según el mes real. Los tests del dominio usan un reloj fijo en el 26 de octubre de 2026, el día de los artboards, para que las cifras de los specs se puedan reproducir exactas.
- *Alternativa*: un reloj demo fijo en octubre de 2026. Se descarta porque Hoy "siempre abre en el mes actual" y una fecha congelada confunde al probar.

### D4. Persistencia del modo demo
El estado completo se serializa en JSON bajo `steward-demo/v1`: en `localStorage` en la PWA y en AsyncStorage en la app. Es una clave distinta de `@steward/budget_v3` (v1), que la app MUST NOT leer ni borrar. La lectura y la escritura van en try/catch; si fallan, se queda en memoria. Lleva un número de versión del esquema: si no coincide, se resiembra. "Restablecer datos de prueba" borra la clave y resiembra. La sesión demo (usuario actual = Daniel, o el invitado tras "Unirme") va aparte, en `steward-demo/session`, para que "Cerrar sesión" no borre los datos.

### D5. PWA: un solo layout responsive
- Angular 22: standalone, signals, `ChangeDetectionStrategy.OnPush` y zoneless, como denti-caja. El proyecto se llama `frontend` en `angular.json` porque `local-deploy.ps1` llama `ng build frontend`.
- Tailwind 4 con los tokens del handoff como `@theme` (colores, radios 10–16 px, Inter y JetBrains Mono), sin sombras. Las fuentes se sirven desde Google Fonts, como prevé el CSP del vhost.
- **Shell**:
  - menos de 1024 px: barra inferior;
  - desde 1024 px: menú lateral, contenido centrado a un máximo de 560 px en las pantallas móviles, y ancho completo en Comparar y Anual.
- Las hojas Aporte, Pagar y Gasto son rutas hijas de Hoy que se muestran como bottom sheet en móvil y como diálogo centrado en web, con foco atrapado y Escape para cerrar.
- **Rutas**:
  - acceso e invitación: `/acceso`, `/acceso/face-id`, `/onboarding/:paso`, `/invitacion/:token`;
  - Hoy: `/hoy` con las hijas `aporte`, `pagar/:itemId` y `gasto`;
  - planear: `/planear`, `/planear/:yyyy-mm`, `/planear/:yyyy-mm/comparar`, `/planear/:yyyy-mm/cierre`, `/planear/anual/:yyyy`;
  - cuentas y ajustes: `/cuentas`, `/cuentas/cuadrar`, `/cuentas/credito/:id`, `/ajustes`.

  Hay guards de sesión y de hogar configurado.
- Service worker (`ngsw-config.json`) que solo cachea los archivos de la app, igual que denti-caja, con `/api` excluido desde ya.
- Componentes compartidos en `shared/`: `money` (con "Ocultar montos"), `money-input`, `avatar`, `segmented` (Daniel/Esposa, Octubre/Noviembre), `sheet`, `list-row`, `kpi`, `month-header`, `demo-banner`, e íconos SVG inline de trazo, como los artboards.

### D6. App Expo: reescritura en la misma carpeta, en una rama
- Rama `feature/presupuesto-hogar` en el repo steward. `main` queda con la v1 publicable. La PWA va en la misma rama, porque el dominio es común.
- Se sube a Expo SDK 57 (el del workspace en denti-caja) con `npx expo install --fix`, conservando en `app.json` el `bundleIdentifier`, el `package` y el `projectId`. La versión sigue en 1.0.2 hasta el envío a TestFlight (D8).
- Se reemplaza `src/` por la estructura nueva:
  - `app/` con expo-router: grupos `(acceso)` y `(app)/(tabs)` con hoy, planear y cuentas;
  - modales `aporte`, `pagar` y `gasto` como `presentation: 'formSheet'`;
  - `ui/` con los tokens;
  - `data/` con los hooks de D2.

  El código de la v1 queda en la historia de Git.
- Fuentes Inter y JetBrains Mono con `@expo-google-fonts`. Se retiran las fuentes de la v1 que ya no se usen.
- Comparar y Anual van en un `ScrollView` horizontal con las columnas a su ancho de diseño.
- *Alternativa*: crear una app nueva en otra carpeta y dejar `mobile/` intacta. Se descarta: duplica el proyecto EAS o exige otro, y el usuario pidió reescribir la app.

### D7. Pruebas y verificación de fidelidad
- **Dominio**: Vitest con un test por regla, usando las cifras exactas de los escenarios de los specs (libre $3.436.000, diezmo $700.000, ajuste $220.000, reparto del cierre, etc.).
- **PWA**: Vitest + TestBed con un test por flujo principal (primer acceso → onboarding → Hoy, marcar pago con "Su cuenta", cerrar mes), sobre el adaptador demo.
- **App**: Jest + Testing Library con los mismos tres flujos.
- **Fidelidad**: capturas de cada pantalla a 390 px (y de Comparar y Anual a 1280/1440) junto al artboard. Las diferencias se anotan y se corrigen en la misma tarea.

### D8. Distribución por TestFlight
- La rama sube `app.json` a la versión 1.1.0: la 1.0.2 ya está publicada y App Store Connect no acepta builds nuevos para una versión que ya salió.
- `eas.json` suma un perfil de build `testflight` (`distribution: store`, `autoIncrement: true`) y un perfil de submit `testflight` con el mismo `ascAppId`. El número de build es remoto (`appVersionSource: remote`) y se comparte con `main`: siempre sube, así que no choca.
- Solo testers internos: usuarios de App Store Connect, sin Beta App Review. Los testers externos piden revisión y quedan fuera de este cambio.
- *Alternativa*: build ad hoc con el perfil `preview`. Se descarta porque exige registrar cada iPhone en la cuenta de Apple.

## Risks / Trade-offs

- [El TS compartido por `paths` puede fallar en algún builder (esbuild o Metro)] → La primera tarea de cada app es una prueba mínima que importe `@steward/domain` y compile en `ng build` y en `expo export`. Si falla, el plan alternativo es un paso `tsc` del dominio a `dist/` antes del build.
- [Subir de SDK 54 a 57 rompe dependencias de la v1] → Se reemplaza la UI completa en la misma tarea, y las dependencias de la v1 que no se usen se quitan en vez de migrarlas.
- [Reglas implementadas en el cliente que el backend deberá repetir] → Viven solo en `packages/domain/rules` con tests de las cifras del handoff. Esos tests se vuelven la especificación ejecutable del backend.
- [El modo demo se confunda con datos reales] → Aviso persistente de "Datos de prueba". El VPS no publica la PWA mientras el backend esté reservado.
- [Dos UIs (Angular y React Native) se desalinean] → Las dos parten de los mismos artboards y del mismo dominio. La paridad se verifica con las mismas cifras en los tests de flujo de ambas.
- [Una corrección de la v1 desde `main` necesitará la 1.0.3 o más] → Funciona: App Store Connect compara contra la última versión publicada, no contra las de TestFlight. La versión con backend deberá ser mayor que 1.1.0.
- [App Store Connect ya tiene una ficha de versión 2.0.0 "en preparación", reservada para la versión pública con backend] → Nunca se envía a revisión en este cambio, y los builds 1.1.0 de TestFlight no se le pueden asociar. App Store Connect permite una sola versión editable: antes de sacar una 1.0.3 desde `main`, hay que renombrar o borrar esa ficha.

## Migration Plan

1. Crear la rama `feature/presupuesto-hogar` en steward.
2. Dominio y tests.
3. PWA y `local-deploy.ps1 -Project steward`: `steward.test` muestra la PWA.
4. App y build `testflight` enviado a TestFlight.

**Rollback**: no hay nada en producción que revertir. En local, borrar `frontend/` devuelve "Próximamente". La v1 sigue en `main`.

## Open Questions

- Textos legales (Términos y Privacidad) de Acceso: en modo demo enlazan a una página de "Próximamente".
- Nombre del paquete de dominio si más adelante lo usa el backend (por ejemplo, para generar tipos desde OpenAPI): se decide en el cambio del backend.
