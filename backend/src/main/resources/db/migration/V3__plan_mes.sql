-- Etapa 4: categorias, plan del mes con su opcion e items, y los registros de Hoy (cambio OpenSpec backend-plan-mes-hoy,
-- design D2).

CREATE TABLE categoria (
    id       uuid     PRIMARY KEY,
    hogar_id uuid     NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    nombre   text     NOT NULL,
    color    text     NOT NULL,
    orden    smallint NOT NULL,
    tipo     text     NOT NULL CHECK (tipo IN ('FIJO', 'TARJETA', 'VARIABLE', 'CREDITO', 'OTRO')),
    -- Las del sistema no se borran (si se renombran).
    sistema  boolean  NOT NULL DEFAULT false
);
-- Sin nombres repetidos en un hogar (DUPLICADA).
CREATE UNIQUE INDEX categoria_nombre_uq ON categoria (hogar_id, lower(nombre));

-- Las cuatro del sistema para los hogares que ya existen; los nuevos las reciben al crearse.
INSERT INTO categoria (id, hogar_id, nombre, color, orden, tipo, sistema)
SELECT gen_random_uuid(), h.id, c.nombre, c.color, c.orden, c.tipo, true
FROM hogar h
CROSS JOIN (VALUES ('Gastos fijos', '#E2551B', 1, 'FIJO'),
                   ('Tarjetas y cuotas', '#7C4DDB', 2, 'TARJETA'),
                   ('Variables', '#8D8F88', 3, 'VARIABLE'),
                   ('Créditos', '#2E6B45', 4, 'CREDITO')) AS c (nombre, color, orden, tipo);

CREATE TABLE plan_mes (
    id                  uuid     PRIMARY KEY,
    hogar_id            uuid     NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    ref_anio            smallint NOT NULL,
    ref_mes             smallint NOT NULL CHECK (ref_mes BETWEEN 1 AND 12),
    estado              text     NOT NULL CHECK (estado IN ('BORRADOR', 'ACTIVO', 'CERRADO')),
    escenario_activo_id uuid
);
-- Un plan por mes (YA_EXISTE).
CREATE UNIQUE INDEX plan_mes_uq ON plan_mes (hogar_id, ref_anio, ref_mes);

-- Opciones del mes (A, B, ...). En la Etapa 4 solo se crea la A; varias llegan en la Etapa 7.
CREATE TABLE escenario (
    id         uuid    PRIMARY KEY,
    plan_id    uuid    NOT NULL REFERENCES plan_mes (id) ON DELETE CASCADE,
    letra      text    NOT NULL,
    creado_por uuid    NOT NULL REFERENCES usuario (id),
    nota       text    NOT NULL DEFAULT '',
    archivado  boolean NOT NULL DEFAULT false,
    UNIQUE (plan_id, letra)
);

ALTER TABLE plan_mes ADD CONSTRAINT plan_mes_escenario_activo_fk
    FOREIGN KEY (escenario_activo_id) REFERENCES escenario (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE item_plan (
    id           uuid     PRIMARY KEY,
    escenario_id uuid     NOT NULL REFERENCES escenario (id) ON DELETE CASCADE,
    categoria_id uuid     NOT NULL REFERENCES categoria (id),
    nombre       text     NOT NULL,
    monto        bigint   NOT NULL CHECK (monto >= 0),
    dia_vence    smallint CHECK (dia_vence BETWEEN 1 AND 31),
    tipo         text     NOT NULL CHECK (tipo IN ('FIJO', 'VARIABLE', 'CUOTA', 'CREDITO')),
    cuota_actual smallint,
    cuota_total  smallint,
    orden        integer  NOT NULL,
    CHECK ((cuota_actual IS NULL) = (cuota_total IS NULL)),
    CHECK (cuota_actual IS NULL OR (cuota_actual >= 1 AND cuota_actual <= cuota_total))
);
CREATE INDEX item_plan_escenario_ix ON item_plan (escenario_id);

-- Los registros de Hoy van en la misma tabla, como el Movimiento del dominio.
ALTER TABLE movimiento DROP CONSTRAINT movimiento_tipo_check;
ALTER TABLE movimiento ADD CONSTRAINT movimiento_tipo_check
    CHECK (tipo IN ('INGRESO_FIJO', 'DIEZMO_ENTREGADO', 'APORTE', 'PAGO', 'GASTO'));
-- Sin cascada: un item con pagos no se quita (ITEM_CON_PAGOS, design D7).
ALTER TABLE movimiento ADD COLUMN item_id uuid REFERENCES item_plan (id);
ALTER TABLE movimiento ADD COLUMN nota text NOT NULL DEFAULT '';
-- De donde salio o a donde llego el dinero; EXTERNA = "Su cuenta", que cuenta como aporte implicito.
ALTER TABLE movimiento ADD COLUMN origen text NOT NULL DEFAULT 'NINGUNO'
    CHECK (origen IN ('CUENTA', 'EXTERNA', 'NINGUNO'));
UPDATE movimiento SET origen = 'CUENTA' WHERE cuenta_id IS NOT NULL;
-- Un fijo se paga una vez por mes (YA_PAGADO), aunque lleguen dos a la vez. Los variables se registran como GASTO.
CREATE UNIQUE INDEX movimiento_pago_uq ON movimiento (item_id, ref_anio, ref_mes) WHERE tipo = 'PAGO';
