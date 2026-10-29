# ROADMAP.md

Steward pasa de la app Expo de un solo usuario, con datos en el teléfono (v1, en App Store), a **Presupuesto Hogar**: un presupuesto compartido entre los miembros de un hogar, en la nube, con web y móvil. Las decisiones de producto, las reglas de negocio, las pantallas y el modelo de datos están en el `HANDOFF.md` del diseño y en el canvas "Presupuesto Hogar v3". Cómo se despliega cada capa, en [`DEPLOYMENT.md`](DEPLOYMENT.md).

Las etapas 2 a 9 siguen el "Orden sugerido de implementación" del handoff. Convención (la del resto de los repos): un `[x]` se marca **solo cuando la tarea fue verificada**, no cuando el código existe. Las secciones de "mejoras futuras" son backlog declarado y no cuentan para el porcentaje.

## Objetivo actual: Hogar en la nube con un plan del mes usable

**Criterio de cierre**: dos miembros del mismo hogar entran a `steward.test` con Google y comparten un plan del mes. Uno marca un pago o registra un aporte, y el otro lo ve al abrir la app.
**Alcance**: Etapa 2, Etapa 3, Etapa 4

**Cumplido el 2026-10-28** en `steward.test`, con el acceso de desarrollo porque Google no acepta `.test` como origen. Con Google real se verifica al encender el VPS (Etapa 9). El siguiente objetivo está por definir. Con las Etapas 5 a 8 hechas, en modo conectado ya nada es de prueba; falta la producción (Etapa 9).

## Objetivos cumplidos

- 2026-07-13 — Steward v1.0.2 en App Store: presupuesto mensual local con moneda por país, créditos y bola de nieve
- 2026-10-26 — Infra de Presupuesto Hogar lista: `steward.test` y `https://steward.srdejo.com.co` sirviendo la página Próximamente, con el backend reservado en el VPS
- 2026-10-26 — UI completa con datos de prueba: las 22 pantallas del diseño en la PWA (`steward.test`) y en la app Expo, con las mismas cifras en las dos (cambio OpenSpec `presupuesto-hogar-ui`)
- 2026-10-28 — Backend con acceso, hogar e invitaciones (Etapa 2): dos personas comparten un hogar en `steward.test`; el invitado se une por el enlace o, sin él, desde la invitación a su correo (cambio OpenSpec `backend-acceso-hogar`)
- 2026-10-28 — Ingresos fijos, regla y diezmo al recibir en el backend (Etapa 3): un hogar nuevo completa el onboarding en `steward.test`, y al marcar el salario como recibido los dos miembros ven "Disponible para diezmar $700.000" (cambio OpenSpec `backend-ingresos-diezmo`)
- 2026-10-28 — Plan del mes y Hoy en el backend (Etapa 4) y objetivo "Hogar en la nube con un plan del mes usable": dos personas crean el plan de octubre, una paga Internet desde su cuenta, la otra registra un aporte y un gasto, y las dos ven las mismas cifras de "Te queda libre" y "Vs. plan" (cambio OpenSpec `backend-plan-mes-hoy`)
- 2026-10-29 — Cuentas, cuadre y créditos en el backend (Etapa 5): dos personas agregan un crédito y su cuota aparece en Hoy; pagarla desde Davivienda deja el crédito en $13.978.000, mueven $100.000 al efectivo, cuadran Davivienda con $50.000 de "Gastos sin registrar" que el Cierre muestra, y un abono deja el crédito en $12.978.000, igual para las dos (cambio OpenSpec `backend-cuentas-creditos`)
- 2026-10-29 — Cierre de mes en el backend (Etapa 6): una persona cierra octubre repartiendo el sobrante ($300.000 a ahorro y $100.000 a noviembre); si la otra registró algo mientras tanto, el cierre se recalcula antes de guardarse; las dos ven octubre Cerrado y en solo lectura, y noviembre trae "Sobrante de octubre" (cambio OpenSpec `backend-cierre-mes`)
- 2026-10-29 — Varias opciones por mes en el backend (Etapa 7): en noviembre (Borrador) una persona duplica la Opción A y quita una copia, la otra prueba un abono de $2.000.000 desde el crédito, las dos comparan A, B y C con solo Créditos resaltada, y "Usar B" archiva las demás para las dos (cambio OpenSpec `backend-opciones-mes`)
- 2026-10-29 — Plan anual en el backend (Etapa 8): una persona crea el plan anual 2027 vacío y pone Gastos fijos en $800.000 cada mes, la otra agrega SOAT en marzo y su aporte proyectado de enero; las dos ven la misma cuadrícula y los mismos KPI, y "Crear meses desde este plan" crea los 12 meses en Borrador, con SOAT en marzo. En modo conectado ya no hay aviso de datos de prueba (cambio OpenSpec `backend-plan-anual`)

## Etapa 1 — Infra de despliegue ✅

- [x] Repo en tres capas: `backend/`, `frontend/` y `mobile/` (la app Expo, sin cambios en EAS).
- [x] Entorno local: `local-deploy.ps1 -Project steward` publica `http://steward.test` (página Próximamente, base `steward`, puerto 8099).
- [x] VPS: `https://steward.srdejo.com.co` con certificado, cabeceras de seguridad y `index.html` sin caché. Base y rol `steward` creados; la unit está instalada y deshabilitada (`BackendEnabled = $false`).

## Etapa 1.5 — UI con datos de prueba ✅

**Criterio de cierre**: el producto se puede usar de punta a punta sin backend (acceso, onboarding, Hoy, planear, cuentas, cierre) y las reglas del handoff quedan como tests que el backend debe reproducir.

- [x] Dominio compartido `packages/domain`: modelo, reglas (libre, diezmo al recibir, aporte implícito, cuadre, cierre, escenarios, plan anual, simulador de crédito), puertos y adaptador de prueba; 41 tests con las cifras de los specs.
- [x] PWA Angular 22 con las 22 pantallas, móvil y web; publicada en `steward.test` y recorrida completa a 390 y 1280 px sin errores.
- [x] App Expo reescrita en SDK 57 con las mismas pantallas, en la rama `feature/presupuesto-hogar` (sin publicar); la v1 sigue en `main`.
- [x] Paridad: la misma secuencia da las mismas cifras en la PWA y en la app.
- [x] App 1.1.0 en TestFlight (perfil `testflight`) con los testers internos instalándola; sin revisión de App Store.

Las etapas 2 a 9 conectan estas pantallas al backend: cada pantalla ya existe y pasa a usar el adaptador HTTP en lugar del de prueba.

## Etapa 2 — Esqueleto backend, acceso, hogar e invitaciones ✅

**Criterio de cierre**: un usuario entra con Google, crea su hogar e invita a otro por correo. El invitado acepta con un token de un solo uso que vence en 7 días y queda como miembro con los mismos permisos.

Cambio OpenSpec `backend-acceso-hogar`.

- [x] Decidir el acceso a datos: **WebFlux + R2DBC** (el arquetipo del workspace), Java 25 e imagen nativa (GraalVM) **solo para desplegar**. Sin `srdejo-platform` todavía: el código común queda propio, detrás de puertos, listo para cambiarlo por los starters.
- [x] Backend con los módulos `auth` y `hogar` (con invitaciones) y la migración Flyway `V1__acceso_hogar`. Los demás módulos del handoff llegan con sus etapas. 70 tests en JVM y 48 de contrato en modo AOT.
- [x] Login con Google (el OAuth client de beauty) y sesión con JWT HS256 de 7 días; sin refresh por ahora.
- [x] Hogar, miembros e invitaciones por correo, enviadas por `contact`: token de un solo uso de 7 días, guardado solo como hash.
- [x] Shell de la PWA Angular con los tokens del diseño y la pantalla de Acceso (Etapa 1.5).
- [x] PWA en modo conectado: acceso, onboarding (pasos 1 y 5), invitación recibida y miembros en Ajustes contra el backend; el resto sigue con datos de prueba.
- [x] `local-deploy.ps1 -Project steward` despliega backend y web juntos en `steward.test`.
- [x] Recorrido del criterio de cierre en `steward.test` con dos personas, por el acceso de desarrollo porque Google no acepta `.test` como origen. Con Google real queda para el primer encendido en el VPS.

## Etapa 3 — Onboarding, ingresos fijos y diezmo ✅

**Criterio de cierre**: un hogar nuevo completa los 5 pasos del onboarding. Al marcar el salario como recibido aparece la obligación de diezmo calculada según su regla (porcentaje y base, bruto o neto).

Cambio OpenSpec `backend-ingresos-diezmo`.

- [x] Onboarding 1 a 5 (nombre y hogar, diezmo, ingreso fijo, cuentas, invitar) e Invitación recibida, contra el backend. Las cuentas son básicas: nombre, titular y saldo aproximado; cuadrar y mover llegan en la Etapa 5.
- [x] Ingresos fijos y regla de diezmo por persona; el diezmo se genera al recibir ("Recibí") y se cierra con "Entregado". El backend reproduce las cifras del dominio compartido (109 tests en JVM y 77 de contrato en modo AOT).
- [x] PWA: las finanzas reales se superponen a los datos de prueba, así que Hoy, Ajustes y Cuentas muestran lo real junto al plan de prueba.
- [x] Recorrido del criterio de cierre en `steward.test` con dos personas, por el acceso de desarrollo.

## Etapa 4 — Plan del mes y Hoy ✅

**Criterio de cierre**: con un plan activo de un escenario, se marca un pago, se registra un aporte y un gasto, y "Te queda libre" y "Vs. plan" cuadran con lo registrado.

Cambio OpenSpec `backend-plan-mes-hoy`.

- [x] Plan del mes con un escenario (la Opción A) y los estados Borrador, Activo y Cerrado. Categorías del hogar en el backend.
- [x] Hoy, Marcar pago, + Aporte y Registrar gasto, en la tabla `movimiento`. Un pago desde una cuenta externa cuenta como aporte implícito; los aportes con diezmo generan su obligación.
- [x] Las cifras de Hoy ("Te queda libre", "Vs. plan") las sigue calculando el dominio compartido en el cliente; el backend guarda y valida (137 tests en JVM y 101 de contrato en modo AOT).
- [x] Recorrido del criterio de cierre en `steward.test` con dos personas, por el acceso de desarrollo.

## Etapa 5 — Cuentas, cuadre y créditos ✅

**Criterio de cierre**: dos personas cuadran las cuentas y la diferencia queda como "Gastos sin registrar"; mueven dinero entre dos cuentas y los saldos estimados lo reflejan; agregan un crédito, su cuota aparece en el plan del mes, y pagarla en Hoy o registrar un abono baja el saldo del crédito, igual para los dos.

Cambio OpenSpec `backend-cuentas-creditos`.

- [x] Cuentas con titular y saldo estimado por orden de registro (último cuadre más lo registrado después, aunque sea de un mes viejo); Cuadrar todas guarda la diferencia como ajuste; Mover dinero entre dos cuentas.
- [x] Créditos: "+ Agregar" en Cuentas con su cuota enlazada en el plan del mes en curso y en los meses que se crean después; pagar la cuota baja el saldo en la parte de capital; Actualizar saldo y Registrar abono (con su origen). El simulador de abono extra sigue en el dominio compartido (168 tests en JVM y 125 de contrato en modo AOT).
- [x] Recorrido del criterio de cierre en `steward.test` con dos personas, por el acceso de desarrollo.

Sin editar ni borrar créditos o cuentas, ni enlazar a mano un ítem con un crédito desde Planear (la API ya admite `creditoId`).

## Etapa 6 — Cierre de mes ✅

**Criterio de cierre**: una persona cierra el mes repartiendo el sobrante entre ahorro y el mes siguiente; las dos ven el mes Cerrado, en solo lectura, con el reparto, y el mes siguiente muestra el ingreso "Sobrante de {mes}".

Cambio OpenSpec `backend-cierre-mes`.

- [x] Plan vs. real por categoría, "Sin registrar", y reparto del sobrante entre ahorro y el mes siguiente; el mes queda en solo lectura. La foto la calcula la PWA con el dominio compartido; el backend comprueba el reparto, "Sin registrar" y que nadie haya registrado algo en el mes después de calcularla, y la guarda (183 tests en JVM y 137 de contrato en modo AOT).
- [x] Se cierra el mes en curso o uno anterior, una sola vez; "Recibí" y "Entregado" también respetan el mes cerrado.
- [x] Recorrido del criterio de cierre en `steward.test` con dos personas, por el acceso de desarrollo.

Sin "Reabrir" un mes cerrado, y el "A ahorro" no mueve dinero a una cuenta (queda anotado en el cierre).

## Etapa 7 — Escenarios y comparar ✅

**Criterio de cierre**: dos personas proponen opciones distintas para noviembre (una duplicando y otra probando un abono a un crédito), las comparan lado a lado con las mismas cifras, y "Usar {X}" deja esa como el plan de noviembre y archiva las demás.

Cambio OpenSpec `backend-opciones-mes`.

- [x] Varias opciones por mes solo en Borrador (un mes futuro, o el mes en curso antes de elegir opción): "+ Duplicar", "Quitar opción", "Probarlo como opción" de un crédito, Comparar lado a lado y "Usar esta" (las demás se archivan). Un mes Activo no gana opciones ni cambia de opción, y tampoco se cambia de opción si la principal ya tiene pagos (195 tests en JVM y 149 de contrato en modo AOT).
- [x] Recorrido del criterio de cierre en `steward.test` con dos personas, por el acceso de desarrollo.

Sin crear una opción en blanco ni desarchivar opciones.

## Etapa 8 — Plan anual ✅

**Criterio de cierre**: dos personas crean el plan anual del año siguiente, le ponen montos por categoría, un evento del año y los aportes que cada una espera hacer; las dos ven la misma cuadrícula y los mismos KPI, y "Crear meses desde este plan" crea los meses en Borrador con su columna como Opción A.

Cambio OpenSpec `backend-plan-anual`.

- [x] Cuadrícula de 12 meses por categoría (creada vacía, celdas editables), con eventos del año, aportes proyectados editables por persona y KPIs; "Crear meses desde este plan" contra el backend (203 tests en JVM y 155 de contrato en modo AOT).
- [x] En modo conectado ya nada es de prueba: sin aviso "Datos de prueba" ni "Restablecer".
- [x] Recorrido del criterio de cierre en `steward.test` con dos personas, por el acceso de desarrollo.

Sin editar ni borrar eventos, ni borrar un plan anual; el cierre de un mes no actualiza el anual.

## Etapa 9 — Passkeys, ocultar montos y producción

**Criterio de cierre**: `https://steward.srdejo.com.co/actuator/health` responde `{"status":"UP"}` con el backend dentro del presupuesto de memoria del VPS, y los dos miembros del hogar lo usan en sus teléfonos.

- [ ] Passkeys (WebAuthn, RP ID `steward.srdejo.com.co`), biometría al abrir y "Ocultar montos".
- [ ] Backend dentro del presupuesto de memoria de `optimizar-recursos-plataforma-comun` como **binario nativo**: la lista "Antes de encender el VPS" de `DEPLOYMENT.md` (compilar, contrato contra el binario, medir < 120 MB y < 2 s). La unit nativa y el modo `Native` de `deploy.ps1` ya están listos (Etapa 2).
- [ ] Encender el backend en el VPS (`BackendEnabled = $true`, `systemctl enable steward`; pasos en `DEPLOYMENT.md`) y publicar la PWA.
- [ ] Pasar `develop` a `main` por PR cuando esté lista. Antes, tag `v1.0.2` en `main` para poder sacar correcciones de la v1, y actualizar el spec `steward-mobile-app`, que hoy pide que `main` siga generando la v1.

## Mejoras futuras

Decisiones abiertas del handoff, sin priorizar:

- [ ] Diezmo de ingresos del negocio: sobre ventas o sobre ganancia (propuesta para v1: ganancia neta).
- [ ] PWA o app nativa para móvil (Face ID nativo); qué pasa con la app Expo v1 de `mobile/` y con sus datos locales.
- [ ] Notificaciones push cuando el otro miembro registra algo.
- [ ] Un usuario en varios hogares.
