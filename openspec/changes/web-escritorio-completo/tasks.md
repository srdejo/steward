# Tasks

## 1. Base

- [x] 1.1 Crear `anchoEscritorio()` en `shared/` (design D1) y usarla en `planear-inicio-page.ts` y en `hoy-page.ts`. Verificar con `npm test` en `frontend`: las pruebas actuales siguen pasando.
- [x] 1.2 Agregar Ajustes a `Shell` como destino solo del menú lateral, con su ícono, y `data.ancho: 'escritorio'` en `/cuentas`, `/ajustes` y `/planear/:mes/cierre` (design D2). Verificar con pruebas:
  - a 1280 px, el menú lateral tiene cuatro destinos y Ajustes queda activo en `/ajustes`;
  - la barra inferior sigue con tres.

## 2. Cuentas

- [x] 2.1 Sacar la lógica del cuadre a `EstadoCuadre` y usarla en `cuadrar-page.ts` (design D3). Verificar con `cuentas.spec.ts`: las pruebas del cuadre móvil siguen pasando.
- [x] 2.2 Agregar la vista de escritorio de Cuentas: encabezado, pestañas, tabla de cuadre con filtro, "Guardar saldos" sin salir de la página, movimientos recientes con filtro por cuenta (design D4) y la tarjeta de Créditos. Verificar con pruebas a 1280 px de:
  - Davivienda $3.980.000 y Efectivo $150.000: diferencias, "$220.000" y saldos guardados;
  - Arriendo en movimientos y el filtro por Efectivo;
  - tocar un movimiento corregible abre su hoja;
  - las pestañas Tarjetas y Créditos llevan a la lista de créditos.

## 3. Cierre

- [x] 3.1 Agregar la vista de escritorio del cierre: encabezado con la diferencia, tabla con diferencia y uso, "Para tener en cuenta" (design D5) y el reparto con barra y "Sin asignar". Verificar con pruebas a 1280 px: la fila de una categoría por encima del plan en rojo con "+$X", el aviso de sin registrar, y "Cerrar octubre" deshabilitado mientras "Sin asignar" ≠ $0.

## 4. Ajustes, Acceso y Hoy

- [x] 4.1 Agregar la vista de escritorio de Ajustes (design D6). Verificar con pruebas a 1280 px: invitar desde la tarjeta Hogar, "Editar" de Salario abre su hoja, y sin "‹ Ejecución".
- [x] 4.2 Agregar la vista de escritorio de Acceso en dos paneles. Verificar con `acceso.spec.ts` a 1280 px, en modo demo y conectado: las opciones y su estado de deshabilitado son los mismos de hoy.
- [x] 4.3 Agregar "Cerrar {mes}" en `hoy-escritorio.ts` (design D7). Verificar con `hoy-escritorio.spec.ts`: lleva a `/planear/2026-10/cierre`, y no se ve con noviembre elegido.

## 5. Cierre del cambio

- [x] 5.1 Correr `npm test` y `ng build` en `frontend` y actualizar `frontend/README.md` si menciona las pantallas.
- [ ] 5.2 Revisión visual a 1024, 1280 y 1440 px de Cuentas, Cierre, Ajustes y Acceso: sin scroll horizontal de la página y fiel al canvas.
