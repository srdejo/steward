## 1. Tokens y tipografía

- [x] 1.1 PWA: en `frontend/src/styles.css`, valores nuevos de los tokens existentes (fondo, superficie, texto, secundario, acento, estados) y los seis `--color-cat-*`, sin bordes en las tarjetas (design D1). Revisar el contraste de #63675F sobre #F6F5F1.
- [x] 1.2 PWA: Space Grotesk como `--font-display` y montos en Inter `tabular-nums`. El componente `monto` y la utilidad `monto` dejan JetBrains Mono, y se quita su carga (design D2).
- [x] 1.3 App: lo mismo en `mobile/src/ui/tokens.ts` y en la carga de fuentes, con `@expo-google-fonts/space-grotesk` en lugar de JetBrains Mono, leyendo antes la documentación de Expo SDK 57.

## 2. Navegación y Agregar

- [x] 2.1 Dominio: `grupoPorPagar(item, hoy)` y el orden de Por pagar por grupo y fecha, con el tope de 3 después de ordenar, y sus pruebas (design D4).
- [x] 2.2 PWA: shell con los destinos Hoy, Planear, Cuentas y Ajustes.
  - Móvil: barra de cinco espacios con el + central.
  - Web: barra superior con el nombre del hogar, el botón Agregar y los avatares (corregido en 6.1).
  - Specs del shell actualizadas (spec `steward-ui-shell`, "Navegación principal").
- [x] 2.3 PWA: hoja Agregar con pestañas Gasto, Aporte y Pago, que monta el contenido actual de `gasto-hoja`, `aporte-hoja` y `pagar-hoja` (design D3).
  - Se abre sobre la pantalla actual.
  - `/hoy/aporte` y `/hoy/gasto` redirigen a ella.
  - Pruebas de los escenarios de "Agregar desde un solo botón".
- [x] 2.4 App: pestañas con el + central como modal `/agregar` y la pestaña Ajustes, con las mismas tres pestañas y pruebas.

## 3. Hoy

- [x] 3.1 PWA, Hoy a 390 px (artboard "Hoy"):
  - la tarjeta verde con "Te queda libre en {mes}", la barra y "Gastaron $X menos que el plan";
  - Por pagar en Vencido, Esta semana y Durante el mes, con el bloque de fecha;
  - "Entró este mes" con "+ Aporte";
  - Ya pagado plegable.
  - El diezmo sigue como ítem (design D5).
  - Pruebas de "Resumen del mes en Hoy".
- [x] 3.2 PWA: Hoy en escritorio con el layout de "Hoy (web)".
- [x] 3.3 App: Hoy con el mismo layout, y las pruebas de paridad al día.

## 4. El resto de pantallas

- [x] 4.1 Entrar: acceso, Face ID, onboarding de 5 pasos e invitación (artboards MAcceso, MOnboarding, MInvitado y WAcceso), en la PWA y en la app.
- [x] 4.2 Planear: Planear, plan del mes con opciones y año (MPlanear, MMes, MAno, WPlanear, WMes y WAno), en la PWA y en la app.
- [x] 4.3 Cierre de mes (MCierre y WCierre), en la PWA y en la app.
- [x] 4.4 Cuentas: cuentas, tarjetas, créditos, cuadrar, detalle de crédito y cómo baja el saldo (MCuentas, MCuadrar, MCredito, MMetodo y WCuentas), en la PWA y en la app.
- [x] 4.5 Ajustes (MAjustes y WAjustes), en la PWA y en la app, sin la sección de avisos, que entra con `avisos-pagos`.
- [x] 4.6 Las pruebas de PWA y app al día, sin cambiar las cifras de los escenarios. Correr `ng build`, las pruebas del dominio, de la PWA y de la app. Actualizar los README que nombran los tokens o las fuentes.

## 5. Entrega

- [x] 5.1 Con confirmación de Daniel: PR y despliegue de la PWA.
- [ ] 5.2 Con confirmación de Daniel: app 2.3.0 a TestFlight.
- [ ] 5.3 Revisión visual de Daniel contra el canvas a 390 px y 1280 px, y en la app.

## 6. Ajustes tras la primera revisión

- [x] 6.1 Web: barra superior como el canvas en lugar del menú lateral, y un solo contenedor de 1320 px para todas las pantallas (cada pestaña tenía su ancho).
- [x] 6.2 Planear como MPlanear y WPlanear, en la PWA y en la app: en web, la fila de meses de los cerrados a los que vienen y el año con el libre de cada mes; en móvil, el mes activo, el borrador con el libre de cada opción, el primer mes sin plan con lo que ya trae y cómo crearlo ahí mismo, el año en tarjeta verde y los meses cerrados con lo que sobró. El dominio da el libre de cada opción en el resumen del mes.
- [x] 6.3 Cuentas como MCuentas y WCuentas, en la PWA y en la app: en web, subtítulo y acción por pestaña, pestañas subrayadas, indicadores arriba (plata del hogar, después de pagar lo pendiente, sin registrar), el cuadre y los movimientos recientes lado a lado; en móvil, la tarjeta del saldo con Cuadrar y Mover dinero, las cuentas con su color y los movimientos recientes. Tarjetas y Créditos con sus indicadores y tarjetas del canvas.
- [x] 6.4 Pruebas del dominio, la PWA y la app al día; `ng build`.
