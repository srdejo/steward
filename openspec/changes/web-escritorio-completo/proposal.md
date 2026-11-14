# Proposal

## Why

En escritorio, Hoy y Planear ya usan todo el ancho, pero Cuentas, Cierre, Ajustes y Acceso siguen siendo la columna móvil de 560 px centrada, con mucho espacio vacío. Además, Ajustes solo se abre desde los avatares, y desde Hoy no hay cómo llegar al cierre del mes.

Fuente: canvas de diseño *Presupuesto Hogar v3*. Artboards `CuentasWeb`, `CierreWeb`, `AjustesWeb`, `AccesoWeb` y `HoyWeb` (botón "Cerrar octubre" y menú lateral).

## What Changes

- **Menú lateral (desde 1024 px):** Ajustes se suma como cuarto destino, con su ícono. En móvil la barra inferior sigue con tres destinos, y Ajustes se sigue abriendo desde los avatares.
- **Cuentas en escritorio:**
  - Encabezado con el saldo del hogar, "Mover dinero" y "+ Cuenta".
  - Pestañas Cuentas · Tarjetas · Créditos. Mientras llega el cambio de tarjetas, Tarjetas y Créditos llevan a la lista de créditos que existe hoy.
  - "Cuadrar cuentas" en una tabla: cuenta, titular, lo que estima la app, lo que dice el banco (campo), diferencia y último cuadre. Tiene el filtro por titular, "Se guardan como gastos sin registrar: $X" y "Guardar saldos" en la misma página.
  - "Movimientos recientes" de todas las cuentas, con filtro por cuenta. Al tocar uno se abre su detalle o la hoja para corregirlo, como hoy.
  - Al lado, el resumen de créditos (lo que se debe) con "Ver créditos ›".
- **Cierre en escritorio:**
  - Encabezado "{Mes} terminó con $X", con lo que el plan esperaba y cuánto mejor o peor salió.
  - "Plan frente a lo real": tabla con diferencia y barra de uso del plan por categoría, más "Sin registrar".
  - "Para tener en cuenta en {mes siguiente}": lo que salió sin registrar, las categorías que pasaron su plan y los ingresos por encima o por debajo.
  - Al lado, "¿Qué hacemos con lo que sobró?" con la barra del reparto, los dos montos, "Sin asignar" y "Cerrar {mes}".
- **Ajustes en escritorio:** las mismas secciones (Hogar, Mis ingresos y diezmo, Categorías, Seguridad y privacidad), como tarjetas en una cuadrícula de dos columnas. Hogar permite invitar por correo ahí mismo, e Ingresos muestra bruto y neto en tabla. Las acciones de cuenta (cerrar sesión, empezar de nuevo, eliminar, salir del hogar) quedan al final.
- **Acceso en escritorio:** dos paneles. A la izquierda, el panel verde con la marca y lo que hace la app; a la derecha, "Entrar" con las mismas opciones y reglas de hoy.
- **Hoy en escritorio:** botón "Cerrar {mes}" junto a las acciones del mes en curso, que abre su cierre.

**No se incluye** (va en el cambio de tarjetas y créditos):
- Las pantallas Tarjetas y Créditos nuevas (calendario de cortes, métodos de crédito, proyección).
- Unir "Tarjetas y cuotas" con Créditos.
- Las llaves de acceso de Ajustes (passkeys).

**Otras decisiones:**
- Los nombres de la navegación siguen siendo Ejecución, Plan y Cuentas. El canvas dice Hoy y Planear, pero el cambio de nombre ya se había decidido.
- Sin cambios de dominio ni de backend: todo sale de los puertos que ya existen.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `steward-ui-shell`: "Navegación principal": Ajustes como destino del menú lateral.
- `steward-cuentas`: "Cuentas, cuadre y créditos": la vista de escritorio, con el cuadre en tabla y los movimientos recientes.
- `steward-planear`: "Cierre de mes": la vista de escritorio, con la diferencia, el uso del plan y "Para tener en cuenta".
- `steward-ajustes`: nuevo requisito "Ajustes en escritorio".
- `steward-acceso-onboarding`: nuevo requisito "Acceso en escritorio".
- `steward-hoy`: nuevo requisito "Cerrar el mes desde Hoy".

## Impact

- **PWA:**
  - `core/layout/shell.ts`: Ajustes en el menú lateral, y el ancho de escritorio para Cuentas, Cierre y Ajustes.
  - `features/cuentas/cuentas-page.ts`: vista de escritorio con el cuadre y los movimientos.
  - `features/planear/cierre-page.ts`, `features/ajustes/ajustes-page.ts`, `features/acceso/acceso-page.ts` y `features/hoy/hoy-escritorio.ts`.
  - `app.routes.ts`: `data.ancho`.
- Pruebas en las especificaciones de cada página.
- Sin cambios en el dominio, el backend ni la app móvil.
