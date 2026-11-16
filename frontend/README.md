# Presupuesto Hogar · PWA

PWA de Presupuesto Hogar en Angular 22 (standalone, signals, zoneless), con Tailwind 4 y service worker. Una sola base responsive: por debajo de 1024 px se ve como app móvil, con barra inferior Ejecución · Plan · Cuentas; desde 1024 px, con menú lateral, que suma Ajustes como cuarto destino.

Las páginas con vista de escritorio leen el ancho con `anchoEscritorio()` (`shared/escritorio.ts`); en las pruebas se simula con `anchoDeVentana(px)` de `testing/harness.ts`. Desde 1024 px:
- **Cuentas** (`CuentasWeb.dc.html`): el cuadre en tabla en la misma página (la lógica está en `features/cuentas/estado-cuadre.ts`, compartida con `/cuentas/cuadrar`), "Movimientos recientes" de todas las cuentas, armados con `movimientos(id)` de cada una, y los resúmenes de tarjetas y créditos.
- **Cierre** (`CierreWeb.dc.html`): plan frente a lo real con diferencia y uso del plan, "Para tener en cuenta en {mes}" y el reparto al lado.
- **Ajustes** (`AjustesWeb.dc.html`): las secciones como tarjetas en cuadrícula, con "Invitar por correo" en la tarjeta Hogar.
- **Acceso** (`AccesoWeb.dc.html`): dos paneles, solo con CSS (el botón de Google se dibuja una vez).
- **Hoy**: "Cerrar {mes}" para el mes en curso.

Desde 1024 px, Hoy usa la vista detallada de `HoyWeb.dc.html` (`features/hoy/hoy-escritorio.ts`), y por debajo, la de una columna de `Main.dc.html`. Esa vista tiene:
- cuatro tarjetas;
- las tablas Por pagar y Ya pagado, con categoría, vencimiento, quién pagó y desde qué cuenta;
- una columna lateral con Ingresos, Por categoría y Cuentas.

`HoyPage` monta solo una de las dos vistas, según `matchMedia('(min-width: 1024px)')`. Las hojas de registro son las mismas rutas hijas de `/hoy`. La ruta lleva `data.ancho = 'escritorio'`: así el shell no limita el ancho a 560 px desde 1024 px, tampoco con una hoja abierta.

Planear también cambia desde 1024 px (`PlanInicioWeb.dc.html`): la tarjeta del año arriba y los meses como tarjetas en cuadrícula, con `data.ancho = 'escritorio'`.

**El plan de un mes en escritorio** (cambio `plan-mes-escritorio`). `/planear/:mes` lleva `data.ancho = 'completo'`; en móvil, `MesPage` se limita a 560 px en su propio host. Desde 1024 px monta una de dos vistas:
- **Una opción** (`mes-una-opcion.ts`, `MesWeb.dc.html`), para un Borrador con una opción, un mes Activo o uno Cerrado. Tiene los indicadores Entra, Sale, Quedaría libre y Diezmo; la tabla del mes frente al anterior, con las etiquetas "Solo {mes}", "Proyectado" y "Último" y los montos editables en la celda; el calendario de pagos, con el día elegido; la plata en cuentas día a día, con su punto más bajo; y "Se libera". Los datos salen de `PlanPort.mesEscritorio` (`vistaMesEscritorio` del dominio).
- **Varias opciones** (`mes-opciones.ts`, `Comparar.dc.html`): la tabla de opciones gasto por gasto (`PlanPort.tablaOpciones`). La opción "Editando" se edita en la celda, y escribir en una celda "—" agrega ese gasto. Tiene "Solo lo que cambia" y, al lado, la opción con sus cambios frente a la A, lo que el mes ya trae y los atajos: Ctrl + D duplica y N agrega un gasto en la categoría de la celda.

"Crear otra opción" pasa a la vista de opciones, y "Usar" vuelve a la de una opción sin salir del mes. Las hojas de gasto e ingreso siguen en `MesPage`. Un mes sin plan muestra las formas de empezar y "ya trae" en dos columnas. En escritorio, `/planear/:mes/comparar` redirige al mes (guard `compararEnElMes`).

**Plan del año** (`features/planear/anual-page.ts`, spec `steward-planear` "Plan anual") se arma en dos pasos:
1. **Mes base:** un mes con plan, "Solo fijos e ingresos" o "Desde cero". "Replicar en los 12 meses" llena el año con ese mes (o reemplaza sus montos, con confirmación; se llega con `?paso=base`).
2. **Lo que cambia:** "Algo distinto en un mes" (`cambio-hoja.ts`) agrega un ingreso o gasto en su categoría, solo ese mes o de ese mes en adelante, y dice en cuánto queda el mes. Desde 1024 px se ve la tabla de 12 meses con las celdas que cambian resaltadas; con menos, la lista de meses (los seguidos sin cambios, agrupados). Abajo, la lista "Lo que cambia", donde cada cambio se corrige o se quita, y "Borrar plan de {año}", que dice qué se borra y deja el año sin plan (los meses ya creados no cambian).
3. **Opciones** (cambio `anual-opciones-y-meses`). El año tiene opciones A, B, ...:
   - Se eligen en pestañas (escritorio) o chips (móvil), y la elegida queda en la URL (`?opcion=B`). "+ Duplicar Opción X" copia la elegida y "Quitar opción" quita la que no está en uso.
   - Las celdas, los cambios y replicar van a la opción elegida. Con otra opción que no sea la A, las celdas distintas de la A se marcan con un borde azul, el KPI dice cuánto más o menos deja libre frente a la A, y aparece "Las dos opciones, mes a mes"; en móvil, cada mes muestra la diferencia "vs A".
   - **"Meses con la Opción X"** (`meses-anual-hoja.ts`) reemplaza a "Crear los 12 meses". Lista los meses agrupados: los que no tienen plan se crean, los que se pueden actualizar llevan una casilla y los que tienen registros o un cierre dicen por qué no se tocan. Llama a `PlanPort.crearOActualizarMeses` (`POST /api/anuales/{anio}/meses`).
4. **Mes base editable** (cambio `anual-mes-base-editable`, solo web):
   - "+ Nueva opción desde un mes base" (`nueva-opcion-hoja.ts`) elige la fuente (por defecto el mes en curso), crea la siguiente letra con una copia de ese mes y abre su editor. Un año sin plan hace lo mismo desde el paso 1: nace la Opción A.
   - El editor (`anual-base-page.ts`, ruta `/planear/anual/{año}/base?opcion=X`) lista los gastos por categoría con el monto editable en la celda, "+ Agregar a …", quitar, "Copiar otro mes" y lo que queda libre. Los cambios no tocan el mes real.
   - "Usar este mes en los 12 meses" llena la opción desde su mes base (sin los créditos que ya terminaron) y vuelve al año, donde se agregan los eventos. Con mes base, "Meses con la Opción X" toma de ahí los gastos de cada mes.
   - "Cambiar mes base" se ve siempre: si la opción aún no tiene, primero copia su base (o el mes en curso) y abre el editor.

Tiene dos **modos de datos** (`src/app/config/modo.ts`):

| Modo | Build | Qué viene del backend | Qué sigue con datos de prueba |
|---|---|---|---|
| **conectado** | `production` (lo que publica `local-deploy.ps1`) y `conectado` | sesión (Google), hogar, miembros, invitaciones, categorías (con la del sistema Diezmo), ingresos fijos, regla de diezmo, las cuentas con su cuadre y "Mover dinero", los créditos, el plan de cada mes con sus opciones (duplicar, quitar, probar un abono, Comparar y Usar, mientras el mes está en Borrador), las líneas de ingreso de cada opción (editar y "+ Ingreso"), los ítems de diezmo, y todo lo registrado ("Recibí" con el monto que llegó, pagos, gastos, aportes, ajustes de cuadre, transferencias y abonos; las entregas de diezmo de antes, como historia) los cierres de mes (un mes cerrado queda en solo lectura y su sobrante pasa al siguiente), y el plan anual con sus aportes proyectados | nada: sin aviso "Datos de prueba" ni "Restablecer" |
| **demo** | `demo` y `development` (`npm start`) | nada | todo |

**Al pasar a la Etapa 4, el plan de prueba desaparece en modo conectado.** Hoy y Planear muestran solo los planes reales. Un hogar que todavía no tiene el plan del mes en curso (por ejemplo, "Jimenez Navarro" en `steward.test`) ve en Hoy "Este mes no tiene plan" y lo crea desde Planear, con "Empezar desde cero" o "Solo fijos e ingresos". Desde la Etapa 8 tampoco hay plan anual de prueba: un año sin anual abre el paso del mes base.

**Tarjetas y créditos** (cambio `tarjetas-y-creditos`). Cuentas tiene tres pestañas, en móvil y escritorio, que se abren con `?pestana=tarjetas|creditos`:
- **Tarjetas** (`features/cuentas/tarjetas-tab.ts`, `TarjetasWeb` y `TarjetasMovil`): "Por pagar este ciclo", las próximas fechas (calendario de 5 semanas en escritorio, lista en móvil) y cada tarjeta con su próximo pago y corte y su ayuda; `tarjeta-hoja.ts` agrega, edita o quita. La tarjeta es la línea del plan (`ItemPlan.tarjetaId`) y no lleva deuda.
- **Créditos** (`features/cuentas/creditos-tab.ts`, `CreditosWeb` y `CreditosMovil`): lo que deben y pagan, los indicadores del año, la tabla con el crédito elegido al lado y la proyección a 6 meses. `metodo-hoja.ts` es "¿Cómo baja el saldo?" (con la tasa EM o EA, con el plan de pagos o a mano), para agregar y para "Cambiar".
- Las cifras salen de `rules/tarjetas.ts` y `rules/credito.ts` del dominio, como en la app.
- **El detalle de un crédito** (`credito-page.ts`, ruta con `data.ancho = 'escritorio'`; cambio `credito-escritorio-y-eliminar`). Desde 1024 px usa `CreditoWeb`:
  - los indicadores Cuota, Pagado, Termina e Intereses;
  - las 12 próximas cuotas, con su barra de capital e interés (`VistaCredito.proximasAnio`);
  - los últimos pagos, con su cuenta (`VistaCredito.pagos`);
  - al lado, el método, el simulador y "Eliminar crédito".

  "Eliminar crédito" está en móvil y escritorio. Una hoja dice qué se conserva; al confirmar, llama a `cuentas.eliminarCredito` (`DELETE /api/creditos/{id}`) y vuelve a la pestaña Créditos.

**Al pasar a la Etapa 5, los créditos de prueba también desaparecen.** La pestaña Créditos muestra "Sin créditos." hasta que se agregan con "+ Crédito". La cuota de un crédito entra sola al plan del mes en curso (si ya tiene plan) y a los meses que se creen después.

Los datos de prueba viven en el navegador (`localStorage`, clave `steward-demo/v1`) y se restablecen desde Ajustes. Mientras algún módulo los use, se ve el aviso "Datos de prueba". En modo conectado no existe "Probar desde cero" y la sesión es un JWT en `localStorage` (`steward/sesion`).

## Comandos

```bash
npm install
npm start                                       # http://localhost:4200, modo demo
npx ng serve -c conectado                       # modo conectado con proxy de /api a localhost:8099 (backend con bootRun)
npm test                                        # Vitest (ng test)
npx ng build frontend --configuration production   # dist/frontend/browser, modo conectado
npx ng build frontend --configuration demo         # solo datos de prueba, sin backend
```

Para el entorno local del workspace: `.\infra\local-deploy.ps1 -Project steward` (desde PowerShell nativo) publica el build en `http://steward.test`.

## Estructura

```text
src/app/
├── core/
│   ├── datos/       PUERTOS (token), providePuertosDemo() / providePuertosConectados(), consulta()
│   │   └── http/    cliente del backend (Api), token de sesión, interceptor Bearer/401 y PuertosConectados
│   ├── sesion/      SesionActual, guards y el cargador de Google Identity Services
│   └── layout/      Shell responsive, avatares del hogar, miembros
├── features/        acceso · hoy · planear · cuentas · ajustes (una pantalla por artboard)
│                       (usabilidad-plan: en Planear, hojas con "Guardar" de ingreso y gasto, el mes en curso editable y "Borrar plan de {mes}";
│                       en Hoy y en el detalle de una cuenta, la hoja de un registro para corregirlo o borrarlo; en Ajustes, "Empezar de nuevo")
│                       (plan-mes-siguiente: los destinos se ven como Ejecución, Plan y Cuentas, con las rutas /hoy y /planear; en Hoy, MesDeHoy elige entre el mes en curso y el siguiente)
└── shared/components/  monto, monto-input, segmentado, interruptor, hoja, encabezado, fila, kpi, icono, avatar
```

Las reglas de negocio no están aquí: viven en `../packages/domain` (`@steward/domain`), compartido con la app Expo e importado por ruta de TypeScript (`tsconfig.json` → `paths`).

## Pasar un módulo del adaptador de prueba al backend

Las pantallas solo hablan con `PUERTOS` (`Puertos` de `@steward/domain`), así que no cambian. En modo conectado, `PuertosConectados` (`core/datos/http/puertos-conectados.ts`) decide qué puerto va por HTTP y cuál sigue con el adaptador de prueba.

**Datos mezclados.** Las vistas (Hoy, Planear, Cuentas, el Cierre) se calculan con las reglas del dominio sobre un solo `EstadoHogar`. Por eso lo real no se compone pantalla por pantalla, sino que se **superpone** al estado de prueba en cada lectura:
- `GET /api/finanzas` trae ingresos, reglas, cuentas, créditos, los planes (con sus líneas de ingreso y sus ítems de diezmo) y los movimientos reales;
- `superposicion.ts` los pone en lugar de los de prueba, con los ids reales y el orden real de registro (`seq`): así el saldo estimado de cada cuenta (último cuadre más lo registrado después) es el mismo que usa el backend al cuadrar;
- el adaptador de prueba los ve al leer y nunca los guarda.

`PuertosConectados` relee las finanzas al iniciar sesión y después de cada escritura real.

Para pasar otro módulo, por ejemplo el plan anual en la Etapa 8:

1. Agregar sus llamadas a `Api` (`core/datos/http/api.ts`), con los tipos del contrato del backend (`backend/README.md`).
2. En `PuertosConectados`, cambiar sus escrituras para que vayan por HTTP y relean las finanzas.
3. En `superposicion.ts`, superponer esa parte del estado con lo real.
4. Probarlo con `HttpTestingController` como en `core/datos/http/conectado.spec.ts`. Ahí `GET /api/finanzas` lo responde `finanzasPrueba` (`testing/conectado.ts`), que cada test deja como quedaría en el backend.

Los errores del backend (`{codigo, mensaje}`) llegan a las pantallas como `ReglaError`, igual que los del adaptador de prueba.
