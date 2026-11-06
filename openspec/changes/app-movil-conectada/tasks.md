## 1. Capa conectada compartida

- [x] 1.1 Mover `Api`, `PuertosConectados` y `superposicion` a `@steward/domain/conectado`, con `Transporte`; la PWA con su transporte sobre `HttpClient` (D1). Verificar: `conectado.spec.ts` y las demás pruebas en verde sin cambiar lo que comprueban; `ng build` sin avisos. Commit.
- [ ] 1.2 Con confirmación de Daniel: desplegar la PWA. Verificar: entrar y registrar algo en producción.

## 2. Backend

- [x] 2.1 Varios client ids de Google (D3). Verificar: contrato con un token de cada client y uno ajeno rechazado.
- [x] 2.2 `V10` y `POST /api/auth/apple`, con el enlace por correo (D4). Verificar: test de migración y contrato de los escenarios de acceso con Apple, usando una llave de prueba como en Google.
- [x] 2.3 `POST /api/cuenta/eliminar`, con anonimizar y revocar (D5). Verificar: contrato de último miembro, hogar compartido y saldos del otro miembro sin cambios. `gradlew.bat check` en verde, en JVM y en `aotTest`. `backend/README.md` y `docs/DEPLOYMENT.md`. Commit.
- [x] 2.4 PWA: "Eliminar mi cuenta" en Ajustes. Verificar: tests de pantalla y `conectado.spec.ts`. Commit.

## 3. Lo que prepara Daniel

- [ ] 3.1 Client iOS de Google en el proyecto de beauty; capability Sign in with Apple y llave `.p8`; variables en el VPS sin imprimir secretos; URL de la política de privacidad. Verificar: Daniel lo confirma; se revisan solo nombres y longitudes de las variables.

## 4. App

- [ ] 4.1 Leer la documentación de Expo SDK 57 de lo que se usa. Dependencias nativas y config plugins; transporte `fetch`; `SecureStore` (D2); `puertosDeLaApp` conectado. Verificar: `tsc` y `npm test`; un build de desarrollo arranca.
- [ ] 4.2 Acceso con Google y Apple (D3, D4), invitaciones sin correo coincidente (D7) y aviso de la v1 (D8). Verificar: en un dispositivo, entrar con los dos y confirmar la audiencia real del token de Google; prueba de que `@steward/budget_v3` no cambia.
- [x] 4.3 Hoy como Ejecución: nombres, selector de mes, hoja y lista de registros, diezmo sin vencimiento (D6). Verificar: pruebas de los escenarios de `steward-hoy`.
- [x] 4.4 Plan: hojas con "Guardar", chips de categoría, mes en curso editable, borrar plan y saldo negativo (D6). Verificar: pruebas de los escenarios de `steward-planear`.
- [x] 4.5 Lo que le faltaba a la app frente a la PWA: agregar crédito e ingreso fijo, crear y editar el plan anual, quitar opción, "Mostrar solo lo que cambia" y compartir el enlace de invitación. Cuentas y Ajustes: detalle de cuenta, "Empezar de nuevo", "Eliminar mi cuenta" y sin Face ID ni "Ocultar montos" (D5, D6). Verificar: pruebas de `steward-cuentas` y `steward-ajustes`; `tsc` y `npm test` en verde. `AGENTS.md` y `docs/DEPLOYMENT.md`. Commit.

## 5. Producción

- [ ] 5.1 Con confirmación de Daniel: backup, deploy del backend con `V10`, contrato contra el binario. Verificar: health UP, Flyway en versión 10 y acceso con Google igual que antes.
- [ ] 5.2 `app.json` en 2.0.0 y build a TestFlight (D9). Daniel y su esposa la usan con sus datos reales. Eliminar la cuenta se prueba con una cuenta aparte, nunca con la de ellos. Verificar: Daniel lo confirma, con las mismas cifras en la app y en la PWA.
- [ ] 5.3 Revisar 4.8 y 5.1.1(v) en la página original, la ficha 2.0.0, la privacidad y una cuenta de revisión. Con confirmación de Daniel: enviar a revisión. `docs/ROADMAP.md`. Commit.
