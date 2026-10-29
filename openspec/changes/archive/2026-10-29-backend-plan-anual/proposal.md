# Proposal

## Why

Con la Etapa 7, todo el mes es real: plan con varias opciones, registros, cuentas, créditos y cierre. Lo único que sigue con datos de prueba en modo conectado es el **plan anual**:
- la cuadrícula de 12 meses es la del ejemplo de 2027;
- sus aportes proyectados aparecen tenues en Planear y en la columna "plan" del Cierre (por ejemplo "Aportes Esposa · Proyectado $2.000.000" en un hogar que no los tiene);
- "Crear meses desde este plan" avisa que llega en una próxima versión.

Además, el dominio no tiene cómo **crear** un plan anual ni sus proyecciones: solo existen en la semilla.

Esta es la Etapa 8 del ROADMAP.

Criterio de cierre: dos personas crean el plan anual del año siguiente, le ponen montos por categoría, un evento del año y los aportes que cada una espera hacer; las dos ven la misma cuadrícula y los mismos KPI, y "Crear meses desde este plan" crea los meses en Borrador con su columna como Opción A.

## What Changes

- **Crear el plan anual** (decisiones de Daniel):
  - "Crear plan anual {año}" lo crea **vacío**: las categorías del hogar en $0 los 12 meses, para llenarlo a mano;
  - solo para el año en curso o uno futuro, uno por año.
- **Aportes proyectados editables por persona:** el anual muestra una fila por miembro con el aporte que espera hacer cada mes. Se ve tenue en el anual y en Planear hasta que haya aportes reales, como en el diseño. Cualquier miembro puede editar las celdas.
- **Dominio compartido** (para que demo y conectado den lo mismo):
  - `crearAnual` y `editarProyeccion` nuevos;
  - `resumenAnual` muestra una fila por categoría del hogar (las nuevas aparecen en $0) y una fila de aportes por miembro, aunque no tenga proyecciones;
  - `editarMontoAnual` acepta una categoría sin fila todavía;
  - `crearMesesDesdeAnual` salta los meses cerrados.
- **Backend: una capacidad nueva, `steward-plan-anual`:**
  - crear el anual;
  - editar una celda;
  - agregar un evento del año;
  - editar un aporte proyectado;
  - "Crear meses desde este plan", que reproduce `crearMesesDesdeAnual`: los meses sin plan nacen en Borrador con su columna como Opción A, a partir del último plan anterior al año, más "Eventos del año".
- **La lectura de finanzas** trae los planes anuales y las proyecciones desde el año de la ventana. Las vistas (cuadrícula, KPI, aportes tenues) siguen en el dominio compartido.
- **PWA en modo conectado:**
  - el plan anual y sus escrituras van al backend;
  - Planear inicio ofrece "Crear plan anual {año}" cuando el año no tiene;
  - **ya nada es de prueba:** desaparecen el aviso "Datos de prueba" y "Restablecer datos de prueba".
- **Migración Flyway `V7`:** plan anual, celdas, eventos y proyecciones.

## Capabilities

### New Capabilities

- `steward-plan-anual`: el plan anual del hogar en el backend (celdas por categoría y mes, eventos del año, aportes proyectados por persona) y crear los meses desde él, con el aislamiento entre hogares.

### Modified Capabilities

- `steward-planear`: "Plan anual", con crear el anual, las proyecciones editables y el modo conectado.
- `steward-finanzas`: "Finanzas del hogar en una lectura" incluye los planes anuales y las proyecciones.
- `steward-ui-shell`: en modo conectado ya no hay módulos de prueba (sin aviso ni "Restablecer").

## Impact

- **`packages/domain`**:
  - `crearAnual`, `editarProyeccion` y los ajustes de `resumenAnual`, `editarMontoAnual` y `crearMesesDesdeAnual`;
  - `PlanPort.crearAnual` y `editarProyeccion`;
  - tests.
- **`backend/`**:
  - `V7__plan_anual.sql`;
  - modelo, puerto y adaptador del anual;
  - `AnualUseCase`, `AnualController` y la lectura;
  - contrato nuevo, también en modo AOT.
- **`frontend/`**:
  - `PuertosConectados.plan` (anual y sus escrituras);
  - la superposición de anuales y proyecciones;
  - el anual con "Crear plan anual" y las filas de aportes editables;
  - el aviso y "Restablecer" solo en modo demo.
- **Sin cambios** en `infra/`, el despliegue ni la app Expo (usa el adaptador de prueba).
