-- Etapa 10 (diezmo-como-gasto): el diezmo se presupuesta como items del plan y cada opcion tiene sus propias lineas de
-- ingreso (design D1, D5 y D8). Antes del deploy a produccion: deploy.ps1 -Action Backup (quita una columna).

-- 1. La categoria del sistema "Diezmo", primera, en cada hogar. Ningun hogar tiene otra con ese nombre (RESERVADA).
ALTER TABLE categoria DROP CONSTRAINT categoria_tipo_check;
ALTER TABLE categoria ADD CONSTRAINT categoria_tipo_check
    CHECK (tipo IN ('DIEZMO', 'FIJO', 'TARJETA', 'VARIABLE', 'CREDITO', 'OTRO'));
INSERT INTO categoria (id, hogar_id, nombre, color, orden, tipo, sistema)
SELECT gen_random_uuid(), h.id, 'Diezmo', '#0F766E', 0, 'DIEZMO', true FROM hogar h;

-- 2. Items de diezmo, enlazados al ingreso fijo o al aporte que los origina (excluyentes).
ALTER TABLE item_plan DROP CONSTRAINT item_plan_tipo_check;
ALTER TABLE item_plan ADD CONSTRAINT item_plan_tipo_check
    CHECK (tipo IN ('FIJO', 'VARIABLE', 'CUOTA', 'CREDITO', 'DIEZMO'));
ALTER TABLE item_plan ADD COLUMN ingreso_fijo_id uuid
    REFERENCES ingreso_fijo (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE item_plan ADD COLUMN aporte_id uuid
    REFERENCES movimiento (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE item_plan ADD CONSTRAINT item_plan_enlace_diezmo_ck CHECK (ingreso_fijo_id IS NULL OR aporte_id IS NULL);

-- 3. Lineas de ingreso de cada opcion (design D8), y la linea que se recibio en cada ingreso.
CREATE TABLE ingreso_plan (
    id              uuid    PRIMARY KEY,
    escenario_id    uuid    NOT NULL REFERENCES escenario (id) ON DELETE CASCADE,
    nombre          text    NOT NULL,
    monto           bigint  NOT NULL CHECK (monto >= 0),
    usuario_id      uuid    REFERENCES usuario (id) ON DELETE SET NULL,
    tipo            text    NOT NULL CHECK (tipo IN ('FIJO', 'EXTRA', 'OTRO')),
    ingreso_fijo_id uuid    REFERENCES ingreso_fijo (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    orden           integer NOT NULL
);
CREATE INDEX ingreso_plan_escenario_ix ON ingreso_plan (escenario_id);
ALTER TABLE movimiento ADD COLUMN ingreso_plan_id uuid
    REFERENCES ingreso_plan (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
-- Una linea se recibe una vez (YA_RECIBIDO), aunque lleguen dos a la vez; la de un ingreso fijo sigue con movimiento_recibido_uq.
CREATE UNIQUE INDEX movimiento_recibido_linea_uq ON movimiento (ingreso_plan_id) WHERE tipo = 'INGRESO_FIJO';

-- 4. Lineas para todas las opciones de los planes no cerrados, de cualquier mes: los fijos activos con su neto y los
-- eventos de ingreso del anual de ese mes. Lo ya recibido no se toca: una linea FIJO se lee recibida por su ingreso.
INSERT INTO ingreso_plan (id, escenario_id, nombre, monto, usuario_id, tipo, ingreso_fijo_id, orden)
SELECT gen_random_uuid(), e.id, f.nombre, f.neto, f.usuario_id, 'FIJO', f.id,
       row_number() OVER (PARTITION BY e.id ORDER BY f.nombre, f.id)
FROM escenario e
JOIN plan_mes p ON p.id = e.plan_id
JOIN ingreso_fijo f ON f.hogar_id = p.hogar_id AND f.activo
WHERE p.estado <> 'CERRADO';

INSERT INTO ingreso_plan (id, escenario_id, nombre, monto, usuario_id, tipo, ingreso_fijo_id, orden)
SELECT gen_random_uuid(), e.id, ev.nombre, ev.monto, ev.usuario_id, 'EXTRA', NULL,
       100 + row_number() OVER (PARTITION BY e.id ORDER BY ev.creado_en, ev.id)
FROM escenario e
JOIN plan_mes p ON p.id = e.plan_id
JOIN plan_anual a ON a.hogar_id = p.hogar_id AND a.anio = p.ref_anio
JOIN anual_evento ev ON ev.anual_id = a.id AND ev.tipo = 'INGRESO' AND ev.mes = p.ref_mes
WHERE p.estado <> 'CERRADO';

-- 5. Items de diezmo para las opciones vigentes de los planes no cerrados del mes en curso en adelante (America/Bogota),
-- con round() de Postgres, que en positivos redondea las mitades hacia arriba como Math.round.
WITH abiertas AS (
    SELECT e.id AS escenario_id, p.hogar_id, p.ref_anio, p.ref_mes, c.id AS categoria_id
    FROM escenario e
    JOIN plan_mes p ON p.id = e.plan_id
    JOIN categoria c ON c.hogar_id = p.hogar_id AND c.tipo = 'DIEZMO'
    WHERE p.estado <> 'CERRADO' AND NOT e.archivado
      AND p.ref_anio * 12 + p.ref_mes >= extract(year FROM now() AT TIME ZONE 'America/Bogota')::int * 12
                                         + extract(month FROM now() AT TIME ZONE 'America/Bogota')::int
), nuevos (escenario_id, categoria_id, nombre, monto, dia_vence, ingreso_fijo_id, aporte_id, clave) AS (
-- Un ingreso fijo activo cuyo dueño tiene regla activa, salvo que ese mes ya se recibio y se entrego su diezmo.
SELECT o.escenario_id, o.categoria_id, 'Diezmo · ' || f.nombre,
       round(CASE r.base WHEN 'BRUTO' THEN f.bruto ELSE f.neto END * r.porcentaje / 100)::bigint,
       f.dia_pago, f.id, NULL::uuid, '1' || f.nombre
FROM abiertas o
JOIN ingreso_fijo f ON f.hogar_id = o.hogar_id AND f.activo
JOIN regla_diezmo r ON r.usuario_id = f.usuario_id AND r.activa
WHERE NOT EXISTS (SELECT 1 FROM movimiento m JOIN diezmo_cubierto d ON d.movimiento_id = m.id
                  WHERE m.tipo = 'INGRESO_FIJO' AND m.ingreso_fijo_id = f.id
                    AND m.ref_anio = o.ref_anio AND m.ref_mes = o.ref_mes)
UNION ALL
-- Un evento de ingreso del anual con un miembro con regla activa, sobre su monto (base BRUTO).
SELECT o.escenario_id, o.categoria_id, 'Diezmo · ' || ev.nombre, round(ev.monto * r.porcentaje / 100)::bigint,
       NULL::smallint, NULL::uuid, NULL::uuid, '2' || ev.nombre
FROM abiertas o
JOIN plan_anual a ON a.hogar_id = o.hogar_id AND a.anio = o.ref_anio
JOIN anual_evento ev ON ev.anual_id = a.id AND ev.tipo = 'INGRESO' AND ev.mes = o.ref_mes
JOIN regla_diezmo r ON r.usuario_id = ev.usuario_id AND r.activa
UNION ALL
-- Un aporte del mes con "Aplicar diezmo" que no se entrego: la regla de quien aporto (10 % si no tiene).
SELECT o.escenario_id, o.categoria_id,
       'Diezmo · aporte ' || extract(day FROM m.fecha)::int || ' '
           || (ARRAY['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'])[extract(month FROM m.fecha)::int],
       round(m.monto * coalesce(r.porcentaje, 10) / 100)::bigint, NULL::smallint, NULL::uuid, m.id, '3' || m.seq
FROM abiertas o
JOIN movimiento m ON m.hogar_id = o.hogar_id AND m.tipo = 'APORTE' AND m.aplica_diezmo
                 AND m.ref_anio = o.ref_anio AND m.ref_mes = o.ref_mes
LEFT JOIN regla_diezmo r ON r.usuario_id = m.usuario_id
WHERE NOT EXISTS (SELECT 1 FROM diezmo_cubierto d WHERE d.movimiento_id = m.id)
)
INSERT INTO item_plan (id, escenario_id, categoria_id, nombre, monto, dia_vence, tipo, orden, ingreso_fijo_id, aporte_id)
SELECT gen_random_uuid(), n.escenario_id, n.categoria_id, n.nombre, n.monto, n.dia_vence, 'DIEZMO',
       coalesce((SELECT max(i.orden) FROM item_plan i WHERE i.escenario_id = n.escenario_id), 0)
           + row_number() OVER (PARTITION BY n.escenario_id ORDER BY n.clave),
       n.ingreso_fijo_id, n.aporte_id
FROM nuevos n;

-- 6. Sin "Diezmo en Hoy": solo agrupaba la tarjeta que desaparece.
ALTER TABLE hogar DROP COLUMN diezmo_en_hoy;
