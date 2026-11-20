## Context

El mes de cada cuota de un crédito no se guarda: se calcula. En el dominio, `cuotasProyectadas(c, hoy, n)` empieza en el mes de `hoy` (o el siguiente si ya hay un pago de cuota ese mes), y de ahí salen el detalle (`vistaCredito`: próxima, próximas, termina, intereses), la proyección (`saldosFinDeMes`), el plan anual (`pagaEnMes`) y el plan de escritorio. En el backend, `Amortizacion.pagaEnMes` repite la regla para `AnualUseCase`; `PlanUseCase.conCuotas` agrega la cuota de cada crédito con saldo al crear un mes, y crear un crédito agrega su cuota al mes en curso.

Johana (creado el 3 nov 2026, primera cuota en diciembre) muestra noviembre como su primera cuota. Sus ítems de plan ya están bien: de diciembre 2026 a diciembre 2027, ninguno en noviembre.

## Goals / Non-Goals

**Goals:**
- Guardar, por crédito, el mes de la primera cuota, y que todas las proyecciones la respeten mientras no llegue.
- Elegirla al crear el crédito y corregirla desde "Cambiar", en la PWA y en la app.
- Sin cambio para los créditos sin el campo.

**Non-Goals:**
- Quitar o mover ítems de plan ya creados al cambiar la primera cuota (Johana no lo necesita; un mes ya creado se corrige a mano en Planear).
- Llevar la cuenta de meses sin pagar (cuotas atrasadas) o periodos de gracia con intereses.
- Cambiar el cálculo de "Cuota N de M" (sale de `cuotasPagadas`).

## Decisions

### D1. Un `MesRef` opcional, no una fecha de inicio del crédito

`Credito.primeraCuota: MesRef | null` (backend: `YearMonth`, columna `primera_cuota date` con el día 1, null por defecto). Solo influye mientras el mes en curso sea anterior; después, la regla de siempre. Alternativa descartada: una "fecha del primer pago" con día: el día ya es `diaPago`, y un mes basta para todas las vistas.

### D2. Un solo punto de cálculo: la primera cuota proyectada

En el dominio, `cuotasProyectadas` calcula `primera = max(primeraCuota, mesEnCurso o el siguiente si ya pagó)`. `pagaEnMes`, `saldosFinDeMes` y `vistaCredito` ya dependen de ella, así que no cambian. En el backend, `Amortizacion.pagaEnMes` hace lo mismo con su `primera`. Un `ref` anterior a `primeraCuota` no paga, aunque sea anterior al mes en curso (hoy `pagaEnMes` da true a los meses pasados; con primera cuota futura no hay meses pasados que la tengan).

### D3. Altas y meses nuevos

- `agregarCredito` (dominio) y el crear del backend agregan la cuota al mes en curso solo si `primeraCuota` es null o no es posterior a ese mes.
- `crearMes` (dominio, vía `cuotasDeCreditos` con filtro) y `PlanUseCase.conCuotas` (backend) no agregan la cuota de un crédito cuya `primeraCuota` es posterior a `ref`, y no copian su ítem del mes anterior.
- El plan anual ya pasa por `pagaEnMes` (D2).

### D4. Validación y "este mes" = null

El selector ofrece el mes en curso y los 12 siguientes, y la hoja siempre envía el mes elegido. El mes en curso se guarda como null (así, el crédito queda como cualquier otro). El backend acepta un mes entre el en curso y 12 meses después; si no, 400 `DATOS_INVALIDOS`. Un crédito con una primera cuota ya pasada se lee igual (el campo no influye) y la hoja la muestra como el mes en curso; guardarla así la deja en null.

### D5. API

`primeraCuota` como texto `"YYYY-MM"` (o null) en `POST /api/creditos`, en `PUT /api/creditos/{id}/metodo` y en `CreditoResponse`. Sin el campo (o null), crear lo deja en null y `PUT …/metodo` conserva el valor guardado: así una app vieja que cambia el método no lo borra. El modo de prueba lee los estados guardados viejos con `primeraCuota: null`.

## Risks / Trade-offs

- [Cambiar la primera cuota no mueve ítems ya creados] → En la hoja se dice: "Los meses ya planeados no cambian; ajústalos en Planear". Con Johana no hace falta.
- [Pagar la cuota antes de la primera cuota] → Se registra igual; como `primera` es el máximo, la proyección sigue empezando en la primera cuota. Es un caso raro y no rompe nada.
- [App vieja (2.3.0) que cambia el método sin enviar el campo] → lo dejaría en null. Mitigación: sin el campo, el backend conserva el valor guardado (D5); para quitarlo, la hoja envía el mes en curso.

## Migration Plan

1. V19: `ALTER TABLE credito ADD COLUMN primera_cuota date` (null). Sin cambios de datos.
2. Backend → PWA → app (2.3.1+).
3. Johana: "Cambiar" → "Primera cuota: diciembre 2026" → Guardar.
Rollback: la columna nullable es inofensiva para el backend anterior.

## Open Questions

Ninguna.
