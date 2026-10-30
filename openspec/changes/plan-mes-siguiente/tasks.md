## 1. Backend

- [x] 1.1 `mes` opcional en pagos, gastos y "Recibí" de un ingreso fijo; "Recibí" de una línea toma el mes de su plan; validar el mes en curso o el siguiente (D1, D4). Verificar: contrato de los escenarios nuevos de `steward-finanzas`, y que sin `mes` todo sigue igual. Ajustar el contrato `unaLineaDeOtroMesNoSeRecibe` a dos meses adelante. `gradlew.bat check` en verde, en JVM y en `aotTest`.
- [x] 1.2 `backend/README.md` con el campo `mes`. Commit.

## 2. PWA

- [ ] 2.1 `api.ts` y `PuertosConectados`: mandar `mes`, y `mesDelBackend` con los dos meses (D5). Verificar: `conectado.spec.ts` con un pago y un "Recibí" en noviembre.
- [ ] 2.2 `MesDeHoy`, selector en Hoy y hojas con el mes elegido, incluido el aviso "Se registra en {mes}" (D2, D3). Verificar: tests de pantalla de los escenarios de `steward-hoy`.
- [ ] 2.3 Nombres visibles Ejecución y Plan (D8), con las rutas sin cambiar. Verificar: `shell.spec.ts` y los tests de pantalla que leen esos textos.
- [ ] 2.4 Hoja del gasto con chips de categoría y tipo deducido (D6); "Con la Opción A faltarían" (D7); "Ver en Ejecución" en el mes siguiente. Verificar: tests de pantalla de los escenarios de `steward-planear`; `npx ng test` y `ng build` sin avisos. Actualizar `frontend/README.md`. Commit.

## 3. App Expo

- [ ] 3.1 `mobile/`: lo mínimo para compilar con el dominio nuevo, si hace falta. Verificar: `npx tsc --noEmit` y `npm test` en verde. Commit si hubo cambios.

## 4. Verificación y producción

- [ ] 4.1 Recorrido en Chrome en `steward.test` con dos usuarios de prueba:
  - recibir el salario en noviembre el mismo día, con octubre abierto;
  - pagar y registrar un gasto en noviembre, y ver que octubre no cambia y que el saldo de la cuenta sí;
  - que el otro miembro los vea en noviembre;
  - cerrar octubre con registros en noviembre;
  - la hoja del gasto en cada tipo de categoría;
  - una opción con saldo negativo.

  Luego restaurar la sesión de Daniel y borrar los usuarios de prueba. Actualizar `docs/ROADMAP.md`. Commit.
- [ ] 4.2 Con confirmación de Daniel:
  - `deploy.ps1 -Projects steward -Action Backup`;
  - binario nativo y contrato contra el binario;
  - `deploy.ps1 -Projects steward`.

  Verificar: health UP y la PWA nueva publicada.
