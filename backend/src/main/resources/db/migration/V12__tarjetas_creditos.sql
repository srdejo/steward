-- tarjetas-y-creditos (design D1, D3 y D5): tarjetas de credito, el metodo de cada credito, una sola categoria Creditos
-- y las compras a cuotas convertidas en creditos con plan de pagos.

-- 1. Tarjetas: fechas, uso y como se paga. No llevan deuda ni compras. pago_monto es el pago fijo o, si se paga completa,
--    el ultimo valor pagado (el monto de su linea en los meses nuevos).
CREATE TABLE tarjeta (
    id         uuid        PRIMARY KEY,
    hogar_id   uuid        NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    nombre     text        NOT NULL,
    dia_corte  smallint    NOT NULL CHECK (dia_corte BETWEEN 1 AND 31),
    dia_pago   smallint    NOT NULL CHECK (dia_pago BETWEEN 1 AND 31),
    uso        text        NOT NULL DEFAULT '',
    pago_tipo  text        NOT NULL CHECK (pago_tipo IN ('COMPLETA', 'FIJO')),
    pago_monto bigint      NOT NULL CHECK (pago_monto >= 0),
    creado_en  timestamptz NOT NULL DEFAULT now(),
    CHECK (pago_tipo = 'COMPLETA' OR pago_monto > 0)
);
CREATE INDEX tarjeta_hogar_ix ON tarjeta (hogar_id);

-- La linea del plan de una tarjeta. Quitar la tarjeta deja el item sin enlace. Diferida, como las de V4 y V5.
ALTER TABLE item_plan ADD COLUMN tarjeta_id uuid REFERENCES tarjeta (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- 2. Como baja el saldo de un credito. Los de antes son TASA.
ALTER TABLE credito ADD COLUMN metodo text NOT NULL DEFAULT 'TASA' CHECK (metodo IN ('TASA', 'PLAN', 'MANUAL'));
ALTER TABLE credito ADD COLUMN numero_cuotas smallint CHECK (numero_cuotas BETWEEN 1 AND 600);
ALTER TABLE credito ADD COLUMN cuotas_pagadas smallint NOT NULL DEFAULT 0 CHECK (cuotas_pagadas >= 0);
ALTER TABLE credito ADD COLUMN valor_financiado bigint CHECK (valor_financiado > 0);
ALTER TABLE credito ADD CONSTRAINT credito_plan_check
    CHECK (metodo <> 'PLAN' OR (numero_cuotas IS NOT NULL AND valor_financiado IS NOT NULL AND cuotas_pagadas <= numero_cuotas));

-- 3. Una sola categoria Creditos: lo de "Tarjetas y cuotas" pasa a Creditos con el mismo monto.
--    Las celdas del anual se suman a las de Creditos del mismo mes.
INSERT INTO anual_celda (anual_id, categoria_id, mes, monto)
SELECT c.anual_id, cr.id, c.mes, c.monto
FROM anual_celda c
JOIN categoria t ON t.id = c.categoria_id AND t.tipo = 'TARJETA'
JOIN categoria cr ON cr.hogar_id = t.hogar_id AND cr.tipo = 'CREDITO'
ON CONFLICT (anual_id, categoria_id, mes) DO UPDATE SET monto = anual_celda.monto + excluded.monto;

DELETE FROM anual_celda c USING categoria t
WHERE t.id = c.categoria_id AND t.tipo = 'TARJETA'
  AND EXISTS (SELECT 1 FROM categoria cr WHERE cr.hogar_id = t.hogar_id AND cr.tipo = 'CREDITO');

UPDATE item_plan i SET categoria_id = cr.id
FROM categoria t
JOIN categoria cr ON cr.hogar_id = t.hogar_id AND cr.tipo = 'CREDITO'
WHERE i.categoria_id = t.id AND t.tipo = 'TARJETA';

UPDATE anual_evento e SET categoria_id = cr.id
FROM categoria t
JOIN categoria cr ON cr.hogar_id = t.hogar_id AND cr.tipo = 'CREDITO'
WHERE e.categoria_id = t.id AND t.tipo = 'TARJETA';

DELETE FROM categoria t
WHERE t.tipo = 'TARJETA'
  AND EXISTS (SELECT 1 FROM categoria cr WHERE cr.hogar_id = t.hogar_id AND cr.tipo = 'CREDITO');

-- El color de Creditos pasa al de las tarjetas, si seguia en el del sistema; y el orden queda Diezmo, Fijos, Variables, Creditos.
UPDATE categoria SET color = '#7C4DDB' WHERE tipo = 'CREDITO' AND sistema AND upper(color) = '#2E6B45';
UPDATE categoria SET orden = 2 WHERE tipo = 'VARIABLE' AND sistema;
UPDATE categoria SET orden = 3 WHERE tipo = 'CREDITO' AND sistema;

-- 4. Cada serie de compras a cuotas (hogar, nombre, total) se vuelve un credito con plan de pagos sin intereses. Las cuotas
--    pagadas son la mas alta con un pago registrado o, si no hay, la anterior a la del mes mas reciente.
WITH cuotas AS (
    SELECT i.id AS item_id, p.hogar_id, i.nombre, i.cuota_total, i.cuota_actual, i.monto, i.dia_vence,
           p.ref_anio * 12 + p.ref_mes AS mes,
           EXISTS (SELECT 1 FROM movimiento m WHERE m.item_id = i.id AND m.tipo = 'PAGO') AS pagado
    FROM item_plan i
    JOIN escenario e ON e.id = i.escenario_id
    JOIN plan_mes p ON p.id = e.plan_id
    WHERE i.tipo = 'CUOTA' AND i.cuota_total IS NOT NULL
),
series AS (
    SELECT hogar_id, nombre, cuota_total,
           (array_agg(monto ORDER BY mes DESC))[1] AS monto,
           (array_agg(coalesce(dia_vence, 1) ORDER BY mes DESC))[1] AS dia,
           least(cuota_total, greatest(0, coalesce(max(cuota_actual) FILTER (WHERE pagado),
                                                   (array_agg(cuota_actual ORDER BY mes DESC))[1] - 1))) AS pagadas
    FROM cuotas
    GROUP BY hogar_id, nombre, cuota_total
),
nuevos AS (
    INSERT INTO credito (id, hogar_id, nombre, entidad, saldo, saldo_actualizado_en, cuota, tasa_em, dia_pago, total_original,
                         metodo, numero_cuotas, cuotas_pagadas, valor_financiado)
    SELECT gen_random_uuid(), hogar_id, left(nombre, 40), '', monto * (cuota_total - pagadas), current_date, monto, 0, dia,
           monto * cuota_total, 'PLAN', cuota_total, pagadas, monto * cuota_total
    FROM series
    WHERE monto > 0
    RETURNING id, hogar_id, nombre, numero_cuotas
)
UPDATE item_plan i SET credito_id = n.id, tipo = 'CREDITO', cuota_actual = NULL, cuota_total = NULL
FROM cuotas c
JOIN nuevos n ON n.hogar_id = c.hogar_id AND n.nombre = left(c.nombre, 40) AND n.numero_cuotas = c.cuota_total
WHERE i.id = c.item_id;
