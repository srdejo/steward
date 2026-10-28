# ROADMAP.md

Steward pasa de la app Expo de un solo usuario, con datos en el teléfono (v1, en App Store), a **Presupuesto Hogar**: un presupuesto compartido entre los miembros de un hogar, en la nube, con web y móvil. Las decisiones de producto, las reglas de negocio, las pantallas y el modelo de datos están en el `HANDOFF.md` del diseño y en el canvas "Presupuesto Hogar v3". Cómo se despliega cada capa, en [`DEPLOYMENT.md`](DEPLOYMENT.md).

Las etapas 2 a 9 siguen el "Orden sugerido de implementación" del handoff. Convención (la del resto de los repos): un `[x]` se marca **solo cuando la tarea fue verificada**, no cuando el código existe. Las secciones de "mejoras futuras" son backlog declarado y no cuentan para el porcentaje.

## Objetivo actual: Hogar en la nube con un plan del mes usable

**Criterio de cierre**: dos miembros del mismo hogar entran a `steward.test` con Google y comparten un plan del mes. Uno marca un pago o registra un aporte, y el otro lo ve al abrir la app.
**Alcance**: Etapa 2, Etapa 3, Etapa 4

## Objetivos cumplidos

- 2026-07-13 — Steward v1.0.2 en App Store: presupuesto mensual local con moneda por país, créditos y bola de nieve
- 2026-10-26 — Infra de Presupuesto Hogar lista: `steward.test` y `https://steward.srdejo.com.co` sirviendo la página Próximamente, con el backend reservado en el VPS
- 2026-10-26 — UI completa con datos de prueba: las 22 pantallas del diseño en la PWA (`steward.test`) y en la app Expo, con las mismas cifras en las dos (cambio OpenSpec `presupuesto-hogar-ui`)

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

## Etapa 2 — Esqueleto backend, acceso, hogar e invitaciones

**Criterio de cierre**: un usuario entra con Google, crea su hogar e invita a otro por correo. El invitado acepta con un token de un solo uso que vence en 7 días y queda como miembro con los mismos permisos.

Cambio OpenSpec `backend-acceso-hogar`.

- [x] Decidir el acceso a datos: **WebFlux + R2DBC** (el arquetipo del workspace), Java 25 e imagen nativa (GraalVM) **solo para desplegar**. Sin `srdejo-platform` todavía: el código común queda propio, detrás de puertos, listo para cambiarlo por los starters.
- [x] Backend con los módulos `auth` y `hogar` (con invitaciones) y la migración Flyway `V1__acceso_hogar`. Los demás módulos del handoff llegan con sus etapas. 60 tests en JVM y 40 de contrato en modo AOT.
- [x] Login con Google (el OAuth client de beauty) y sesión con JWT HS256 de 7 días; sin refresh por ahora.
- [x] Hogar, miembros e invitaciones por correo, enviadas por `contact`: token de un solo uso de 7 días, guardado solo como hash.
- [x] Shell de la PWA Angular con los tokens del diseño y la pantalla de Acceso (Etapa 1.5).
- [x] PWA en modo conectado: acceso, onboarding (pasos 1 y 5), invitación recibida y miembros en Ajustes contra el backend; el resto sigue con datos de prueba.
- [x] `local-deploy.ps1 -Project steward` despliega backend y web juntos en `steward.test`.
- [ ] Recorrido del criterio de cierre en `steward.test` con dos cuentas de Google.

## Etapa 3 — Onboarding, ingresos fijos y diezmo

**Criterio de cierre**: un hogar nuevo completa los 5 pasos del onboarding. Al marcar el salario como recibido aparece la obligación de diezmo calculada según su regla (porcentaje y base, bruto o neto).

- [ ] Onboarding 1 a 5 (nombre y hogar, diezmo, ingreso fijo, cuentas, invitar) e Invitación recibida.
- [ ] Ingresos fijos y regla de diezmo por persona; el diezmo se genera al recibir.

## Etapa 4 — Plan del mes y Hoy

**Criterio de cierre**: con un plan activo de un escenario, se marca un pago, se registra un aporte y un gasto, y "Te queda libre" y "Vs. plan" cuadran con lo registrado.

- [ ] Plan del mes con un escenario y los estados Borrador, Activo y Cerrado.
- [ ] Hoy, Marcar pago, + Aporte y Registrar gasto. Un pago desde una cuenta externa cuenta como aporte implícito.

## Etapa 5 — Cuentas, cuadre y créditos

- [ ] Cuentas con titular y saldo estimado; Cuadrar todas guarda la diferencia como ajuste.
- [ ] Créditos con su cuota en el plan y el simulador de abono extra.

## Etapa 6 — Cierre de mes

- [ ] Plan vs. real por categoría, "Sin registrar", y reparto del sobrante entre ahorro y el mes siguiente; el mes queda en solo lectura.

## Etapa 7 — Escenarios y comparar

- [ ] Varias opciones por mes futuro, Comparar lado a lado y "Usar esta" (las demás se archivan).

## Etapa 8 — Plan anual

- [ ] Cuadrícula de 12 meses por categoría, con eventos del año, aportes proyectados y KPIs.

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
