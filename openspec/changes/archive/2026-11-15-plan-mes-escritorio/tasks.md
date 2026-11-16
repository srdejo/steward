# Tasks

## 1. Dominio

- [x] 1.1 `vistaMesEscritorio(estado, ref, hoy)` en `rules/plan-escritorio.ts` (design D2), exportando `detalleVencimiento`, y exponerla en `PlanPort` (demo y conectado). Verificar con pruebas en `rules.test.ts`:
  - diciembre creado desde noviembre más la prima y la Navidad: "Solo diciembre", diferencias, `notaEntra`, el diezmo con su desglose;
  - `porDia` del 20;
  - el saldo diario y su mínimo desde el saldo del hogar;
  - `sinFecha`;
  - "Último" y `seLibera` en junio de 2027 para la compra a cuotas.
- [x] 1.2 `tablaOpciones(estado, ref)` (design D3) en `PlanPort`. Verificar con pruebas:
  - noviembre: "Regalos de Navidad" con [null, 600.000, null], resaltado solo en B;
  - los libres iguales a `vistasOpciones`;
  - los cambios de B frente a A;
  - `igualesEnTodas`;
  - los repetidos con sufijo.

## 2. PWA

- [x] 2.1 `mes-una-opcion.ts` (design D2, D4 y D5): encabezado, indicadores, tabla con celdas editables y etiquetas, calendario con día elegido, saldo diario con el mínimo y "Se libera". Montarlo desde `mes-page.ts` con `data.ancho: 'completo'` (design D1 y D6). Verificar con pruebas a 1280 px de los escenarios de "Plan de un mes en escritorio": diciembre, elegir un día, punto más bajo, editar en la celda; y octubre (Activo) editable y septiembre (Cerrado) sin inputs.
- [x] 2.2 `mes-opciones.ts` (design D3, D4 y D6): la tabla de opciones con "Editando", celdas vacías que agregan, "Solo lo que cambia", el panel lateral y los atajos. "Crear otra opción" y "Usar" pasan de una vista a la otra. Verificar con pruebas a 1280 px de los escenarios de "Opciones del mes en escritorio" y Ctrl + D.
- [x] 2.3 El mes sin plan en dos columnas, y Comparar que redirige en escritorio. Verificar con pruebas: `/planear/2026-11/comparar` a 1280 px abre el mes; a 390 px, Comparar sigue igual.
- [x] 2.4 Correr `npm test` y `ng build` en `frontend` y actualizar `frontend/README.md`.

## 3. Cierre

- [ ] 3.1 Revisión visual a 1024, 1280 y 1440 px de un mes con una opción y con varias: sin scroll horizontal de la página.
