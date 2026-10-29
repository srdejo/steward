# Design

## Context

Estado al empezar (ver proposal.md, "Why"):

- **Backend.** El de la Etapa 2 (`backend-acceso-hogar`): WebFlux + R2DBC con SQL explícito, hexagonal (`domain` / `application` / `infrastructure`), contrato caja negra contra Postgres real, que también corre en modo AOT (`aotTest`).
  - El hogar se resuelve siempre desde el usuario de la sesión (D6 de ese cambio).
  - Errores en el formato `{codigo, mensaje, campos?}`.
  - `hogar.diezmo_en_hoy` ya existe en `V1`.
  - `miembro.diezmo_aportes` guarda la elección del invitado, que todavía no se usa.
- **Dominio compartido (`packages/domain`).** Tiene las reglas que el backend debe reproducir: `marcarRecibido`, `diezmosPendientes`, `entregarDiezmo`, `calcularDiezmo`, `guardarRegla`, `guardarIngresoFijo`, `agregarCuenta` y `aceptarInvitacion` (que crea la regla 10 %/bruto/aportes).
  - Sus tests fijan las cifras: $700.000 del salario, la vista previa del onboarding y el agrupado.
  - Las obligaciones se calculan al leer, con la regla actual del dueño.
- **PWA.** `PuertosConectados` toma sesión y hogar del backend y delega lo demás, por getters, a un adaptador de prueba rehecho con la persona real como titular en el lugar de Daniel.
  - Hoy, Planear y Cuentas calculan sus vistas con las reglas del dominio sobre ese `EstadoHogar` local.

## Goals / Non-Goals

**Goals:**
- Que el backend sea la fuente de ingresos fijos, reglas, cuentas, ingresos recibidos y diezmos entregados, y que reproduzca exactamente las cifras del dominio.
- Que las pantallas no cambien: siguen hablando con los puertos, y las vistas (Te queda libre, la tarjeta de diezmo, la cuenta) salen de las mismas reglas con los datos reales mezclados con los de prueba.
- Dejar el modelo de movimientos listo para que la Etapa 4 agregue pagos, gastos y aportes sin rehacer tablas.

**Non-Goals:**
- Aportes con diezmo en el backend (Etapa 4).
- Cuadre, saldo estimado en el backend, transferencias y créditos (Etapa 5).
- Meses cerrados (Etapa 6): el backend no valida "mes cerrado" porque todavía no hay cierre.
- Recibir ingresos de un mes distinto al actual, e ingresos extra del plan anual (Etapa 8).
- Cambiar la UI de Hoy, Ajustes, Onboarding o Cuentas, salvo dos cosas: el aviso de Etapa 5 en Cuentas y "+ Agregar ingreso fijo" en Ajustes. Hoy Ajustes solo edita los ingresos que ya existen, y los hogares que terminaron el onboarding en la Etapa 2 no tendrían cómo agregar el salario.

## Decisions

### D1. Una capacidad `steward-finanzas` y un controlador

Ingresos, diezmo y cuentas básicas van juntos: comparten el hogar de la sesión y los movimientos, y la PWA los lee de una vez.

En el código: un `FinanzasController`, un puerto `IFinanzasServicePort` y un solo caso de uso, `FinanzasUseCase`. Al implementarlo, los casos de uso separados por recurso que se habían planeado compartían casi todo: el hogar de la sesión, las cuentas del hogar y el cálculo de pendientes. Siguen el patrón de la Etapa 2 (puertos `I*ServicePort` / `I*PersistencePort`) y la misma regla: el hogar se resuelve desde la sesión.

Alternativa descartada: un controlador por recurso. Quedaría más disperso para solo diez endpoints. Si crecen en la Etapa 4, se parten.

### D2. Datos: `V2__ingresos_diezmo.sql`

- **`regla_diezmo`**:
  - columnas: `usuario_id` PK (FK usuario), `activa`, `porcentaje numeric(5,2)` (con CHECK > 0 y <= 100), `base` (con CHECK en BRUTO/NETO), `aplica_aportes`;
  - es de la persona, no del hogar: sobrevive a salir y entrar a otro.
- **`ingreso_fijo`**:
  - columnas: `id`, `hogar_id` (FK con ON DELETE CASCADE), `usuario_id`, `nombre`, `bruto bigint`, `neto bigint`, `dia_pago smallint`, `cuenta_id` (FK con ON DELETE SET NULL), `activo`;
  - CHECK de neto > 0, bruto >= neto y día entre 1 y 31.
- **`cuenta`**:
  - columnas: `id`, `hogar_id` (con CASCADE), `nombre`, `titular_id` (null = conjunta), `saldo_cuadre bigint`, `fecha_cuadre date`, `cuadrada boolean`;
  - se nombra como en el dominio para que la Etapa 5 solo agregue el cuadre.
- **`movimiento`**:
  - columnas: `id`, `hogar_id` (con CASCADE), `tipo` (con CHECK en INGRESO_FIJO y DIEZMO_ENTREGADO; la Etapa 4 amplía la lista), `ref_anio`, `ref_mes`, `monto bigint`, `fecha date`, `usuario_id`, `creado_por`, `cuenta_id` (SET NULL), `ingreso_fijo_id`, `bruto bigint`, `aplica_diezmo`, `creado_en`;
  - índice único parcial `(ingreso_fijo_id, ref_anio, ref_mes) WHERE tipo = 'INGRESO_FIJO'`: es la garantía de `YA_RECIBIDO` aunque lleguen dos "Recibí" a la vez.
- **`diezmo_cubierto`**:
  - columnas: `entrega_id` (FK movimiento con CASCADE) y `movimiento_id` (FK movimiento con CASCADE), con `movimiento_id` como **PK**;
  - así una obligación no se entrega dos veces, ni siquiera en una carrera.
- **Migración del flag del invitado**: `INSERT INTO regla_diezmo SELECT usuario_id, true, 10, 'BRUTO', true FROM miembro WHERE diezmo_aportes`, y después `ALTER TABLE miembro DROP COLUMN diezmo_aportes`.

Los montos se guardan en pesos enteros (`bigint`), igual que `Pesos` en el dominio.

Alternativas descartadas:
- Una tabla por tipo de movimiento. La Etapa 4 suma pagos, gastos, aportes y ajustes, y el dominio ya tiene un solo `Movimiento` con campos opcionales.
- `diezmo_de uuid[]`, como en el dominio. Un arreglo no se puede hacer único por elemento.

### D3. Obligaciones calculadas al leer, como el dominio

Para el backend, una obligación es un `movimiento` INGRESO_FIJO con `aplica_diezmo` que no está en `diezmo_cubierto`, cuyo dueño tiene regla. Su monto se calcula con la regla **actual**:

```
round(base(bruto|neto) * porcentaje / 100), con HALF_UP
```

El detalle se arma igual que en el dominio: `formatPorcentaje` + nombre del ingreso + fecha corta en español (`25 oct`).

No se congela el monto al recibir, porque el dominio tampoco lo hace y el contrato reproduce sus cifras. Congelarlo queda en Open Questions.

Diferencia con el dominio: `diezmosPendientes` no mira `activa`. Una regla desactivada después de recibir sigue generando la obligación, y el backend hace lo mismo para que las cifras cuadren. El flag `aplica_diezmo` sí se decide con la regla activa al recibir, como en `marcarRecibido`.

### D4. El mes en curso lo decide el backend

"Recibí" y las obligaciones usan el mes en curso según `steward.zone` (America/Bogota): el puerto `IClockPort.hoy()`. El cuerpo de "Recibí" no lleva mes.

En la PWA, el adaptador sigue recibiendo `ref` por el puerto. Si no es el mes del backend, lo rechaza con `MES_NO_DISPONIBLE` antes de llamar. Hoy siempre pasa el mes en curso, así que en la práctica no ocurre.

### D5. PWA: superponer los datos reales sobre el adaptador de prueba

`crearAdaptadorDemo` gana la opción `superponer?: (s: EstadoHogar) => EstadoHogar`. Se aplica en cada lectura (`leerEstado`) y **no se persiste**. `PuertosConectados` la usa así:

1. Lee `GET /api/finanzas` al iniciar la sesión y después de cada escritura real, y guarda el resultado en memoria.
2. Reemplaza en el estado de prueba:
   - `ingresosFijos`, `reglas` y `cuentas`;
   - `hogar.diezmoEnHoy`;
   - los movimientos INGRESO_FIJO y DIEZMO_ENTREGADO, con los del backend del mes en curso.
3. Conserva los ids reales. Los miembros reales entran a `usuarios` con su id y su nombre, tomados de la última lectura del hogar.
   - No se traducen a `DANIEL`: desde la Etapa 2, las hojas de Hoy ya registran pagos, gastos y aportes con el id real de la sesión.
   - Los ingresos, las reglas y las cuentas reales usan el `titularId` real, y los puertos `ingresos.fijos()` y `regla()` filtran con él.
4. Les pone a los movimientos reales una secuencia mayor que la de las cuentas reales, para que el saldo estimado (aproximado + movimientos posteriores) salga con las reglas del dominio.

`ingresos` y `cuentas` dejan de ser getters al demo:

| Operación | Destino |
|---|---|
| `fijos`, `regla` | Leen del estado superpuesto |
| `guardarFijo`, `quitarFijo`, `guardarRegla`, `marcarRecibido`, `entregarDiezmo` | Van al backend y recargan las finanzas |
| `registrarAporte` | Sigue al demo (Etapa 4) |
| `cuentas.cuentas`, `diferencia` | Leen del estado superpuesto |
| `cuentas.agregar` | Va al backend |
| `cuadrar`, `mover` | Rechazan con `ReglaError('ETAPA_5', …)`; la pantalla muestra el aviso |
| Créditos | Siguen al demo |

`hogar.definirDiezmoEnHoy` va al backend.

Así Hoy, Planear, Cuentas y el Cierre siguen calculando con `R.resumenMes` y compañía, sin cambios, y las cifras mezcladas son coherentes: el "Te queda libre" de prueba incluye el salario real.

Alternativa descartada: componer las vistas, es decir, pedir el resumen al demo y reemplazar las líneas de ingresos y diezmo con lo del backend. "Te queda libre" y "Vs. plan" quedarían desalineados con los ingresos mostrados.

### D6. Escrituras en el onboarding: idempotentes desde la PWA

El paso 3 ya guarda con `id` cuando el ingreso existe (`guardarFijo({ id, ... })`), y con la superposición los ids son los del backend: volver al paso y guardar edita en lugar de duplicar.

El paso 4 ya evita repetir cuentas por nombre (compara contra `cuentas.cuentas()`), así que el backend no necesita unicidad por nombre de cuenta, que el dominio tampoco tiene.

### D7. Salir del hogar

En la misma transacción de `HogarUseCase.salir`, cuando quedan otros miembros:
- `UPDATE ingreso_fijo SET activo = false` para los de esa persona en ese hogar;
- `DELETE FROM cuenta` para las suyas, que dejan `cuenta_id` en null en movimientos e ingresos.

Si era el último miembro, el `ON DELETE CASCADE` del hogar borra todo. La regla de diezmo se conserva.

### D8. Aceptar con "diezmar de mis aportes"

`IHogarPersistencePort.unir` pierde el parámetro `diezmoAportes`. `InvitacionUseCase.unirse` llama, en la misma transacción, a `IReglaDiezmoPersistencePort.alUnirse(usuario, diezmoAportes)`, que aplica la regla de la spec:
- sin regla y con diezmo: crea 10 %/BRUTO/aportes;
- con regla: solo actualiza `aplica_aportes`.

### D9. Contrato

Se agregan `FinanzasContratoTest`, `DiezmoContratoTest` y `CuentasContratoTest` en el paquete `contract`, con las cifras de los tests del dominio. Corren en JVM y en `aotTest` sin configuración extra, porque no se agregan beans condicionales.

Unitarios:
- el cálculo y el detalle del diezmo (HALF_UP, base neto, el formato `25 oct`, porcentajes con decimales como `12,5%`);
- el adaptador R2DBC de movimientos (la violación del índice único se traduce en `YA_RECIBIDO` o `SIN_DIEZMO`).

## Risks / Trade-offs

- **[Superposición frágil con el demo]** Si el plan de prueba hace referencia a un ingreso o una cuenta de prueba que la superposición quita, una línea puede quedar sin nombre. → La superposición reemplaza solo los slices listados, `nombreUsuario` y las vistas ya toleran ids desconocidos, y hay tests de la PWA para Hoy, Cuentas y Ajustes con datos mezclados.
- **[Regla actual, no congelada]** Si alguien cambia su porcentaje después de recibir, la obligación pendiente cambia. → Es el comportamiento del dominio y está documentado en D3. Congelarla es una decisión de producto aparte.
- **[Una lectura grande]** `GET /api/finanzas` se lee después de cada escritura. → Son pocos registros por hogar y un mes de movimientos. Si crece en la Etapa 4, se parte o se usa ETag.
- **[Cuentas sin cuadre en conectado]** Se ven, pero no se pueden cuadrar hasta la Etapa 5. → La pantalla lo avisa (spec `steward-cuentas`).
- **[Migración que borra una columna]** `miembro.diezmo_aportes` se elimina. → Primero se migra a `regla_diezmo` en la misma migración. En el VPS no hay datos (el backend no está encendido).

## Migration Plan

1. `V2` corre al arrancar, con Flyway, en local (`steward.test`) y en el contrato. Rollback local: restaurar la base, porque no hay migración de bajada, igual que en la Etapa 2.
2. Desplegar con `local-deploy.ps1 -Project steward`. El VPS sigue con el backend reservado (Etapa 9).
3. Los datos de prueba del dispositivo no se migran. Un hogar que terminó el onboarding en la Etapa 2 (como "Jimenez Navarro" en `steward.test`) arranca sin ingresos, regla ni cuentas en el backend:
   - el ingreso y la regla se configuran desde Ajustes, con "+ Agregar ingreso fijo" y "Aportes variables · Editar";
   - las cuentas, desde Cuentas, con "+ Agregar".

## Open Questions

- ¿Congelar el monto de la obligación al recibir, para que un cambio de regla no altere lo pendiente? Si se decide, es una columna `diezmo` en `movimiento` y un cambio en el dominio, y no cambia el resto de este diseño.
- ¿Quién puede marcar "Entregado" de un diezmo ajeno? Hoy cualquier miembro, como en el dominio.
