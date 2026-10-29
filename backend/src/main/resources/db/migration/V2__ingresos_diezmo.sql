-- Etapa 3: regla de diezmo, ingresos fijos, cuentas basicas y movimientos (cambio OpenSpec backend-ingresos-diezmo,
-- design D2). Montos en pesos enteros, como Pesos en el dominio compartido.

-- La regla es de la persona, no del hogar: sobrevive a salir y entrar a otro.
CREATE TABLE regla_diezmo (
    usuario_id     uuid         PRIMARY KEY REFERENCES usuario (id) ON DELETE CASCADE,
    activa         boolean      NOT NULL,
    porcentaje     numeric(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
    base           text         NOT NULL CHECK (base IN ('BRUTO', 'NETO')),
    aplica_aportes boolean      NOT NULL
);

-- Nombrada como en el dominio para que la Etapa 5 solo agregue el cuadre.
CREATE TABLE cuenta (
    id           uuid    PRIMARY KEY,
    hogar_id     uuid    NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    nombre       text    NOT NULL,
    -- null = conjunta.
    titular_id   uuid    REFERENCES usuario (id),
    saldo_cuadre bigint  NOT NULL CHECK (saldo_cuadre >= 0),
    fecha_cuadre date    NOT NULL,
    cuadrada     boolean NOT NULL DEFAULT false
);
CREATE INDEX cuenta_hogar_ix ON cuenta (hogar_id);

CREATE TABLE ingreso_fijo (
    id         uuid     PRIMARY KEY,
    hogar_id   uuid     NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    usuario_id uuid     NOT NULL REFERENCES usuario (id),
    nombre     text     NOT NULL,
    bruto      bigint   NOT NULL,
    neto       bigint   NOT NULL,
    dia_pago   smallint NOT NULL CHECK (dia_pago BETWEEN 1 AND 31),
    cuenta_id  uuid     REFERENCES cuenta (id) ON DELETE SET NULL,
    activo     boolean  NOT NULL DEFAULT true,
    CHECK (neto > 0 AND bruto >= neto)
);
CREATE INDEX ingreso_fijo_hogar_ix ON ingreso_fijo (hogar_id);

-- Un solo Movimiento con campos opcionales, como en el dominio; la Etapa 4 amplia los tipos.
CREATE TABLE movimiento (
    id              uuid        PRIMARY KEY,
    hogar_id        uuid        NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    tipo            text        NOT NULL CHECK (tipo IN ('INGRESO_FIJO', 'DIEZMO_ENTREGADO')),
    ref_anio        smallint    NOT NULL,
    ref_mes         smallint    NOT NULL CHECK (ref_mes BETWEEN 1 AND 12),
    monto           bigint      NOT NULL,
    fecha           date        NOT NULL,
    usuario_id      uuid        NOT NULL REFERENCES usuario (id),
    creado_por      uuid        NOT NULL REFERENCES usuario (id),
    cuenta_id       uuid        REFERENCES cuenta (id) ON DELETE SET NULL,
    ingreso_fijo_id uuid        REFERENCES ingreso_fijo (id),
    bruto           bigint,
    aplica_diezmo   boolean     NOT NULL DEFAULT false,
    creado_en       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX movimiento_hogar_mes_ix ON movimiento (hogar_id, ref_anio, ref_mes);
-- "Recibi" una sola vez por mes, aunque lleguen dos a la vez (YA_RECIBIDO).
CREATE UNIQUE INDEX movimiento_recibido_uq ON movimiento (ingreso_fijo_id, ref_anio, ref_mes) WHERE tipo = 'INGRESO_FIJO';

-- Que obligaciones cubre cada entrega; la PK impide entregar una obligacion dos veces (SIN_DIEZMO).
CREATE TABLE diezmo_cubierto (
    movimiento_id uuid PRIMARY KEY REFERENCES movimiento (id) ON DELETE CASCADE,
    entrega_id    uuid NOT NULL REFERENCES movimiento (id) ON DELETE CASCADE
);
CREATE INDEX diezmo_cubierto_entrega_ix ON diezmo_cubierto (entrega_id);

-- La eleccion del invitado ("diezmar de mis aportes") pasa a ser su regla, como en el dominio.
INSERT INTO regla_diezmo (usuario_id, activa, porcentaje, base, aplica_aportes)
SELECT usuario_id, true, 10, 'BRUTO', true FROM miembro WHERE diezmo_aportes;

ALTER TABLE miembro DROP COLUMN diezmo_aportes;
