-- Etapa 8 (backend-plan-anual): el plan anual del hogar, sus celdas, eventos y los aportes proyectados (design D2).

CREATE TABLE plan_anual (
    id        uuid        PRIMARY KEY,
    hogar_id  uuid        NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    anio      smallint    NOT NULL,
    estado    text        NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'CREADO')),
    creado_en timestamptz NOT NULL DEFAULT now()
);
-- Uno por año y hogar (YA_EXISTE).
CREATE UNIQUE INDEX plan_anual_uq ON plan_anual (hogar_id, anio);

-- Solo las celdas tocadas; la lectura pone ceros en las demas. La FK a categoria es diferida, como las de V4.
CREATE TABLE anual_celda (
    anual_id     uuid     NOT NULL REFERENCES plan_anual (id) ON DELETE CASCADE,
    categoria_id uuid     NOT NULL REFERENCES categoria (id) DEFERRABLE INITIALLY DEFERRED,
    mes          smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
    monto        bigint   NOT NULL CHECK (monto >= 0),
    PRIMARY KEY (anual_id, categoria_id, mes)
);

CREATE TABLE anual_evento (
    id         uuid        PRIMARY KEY,
    anual_id   uuid        NOT NULL REFERENCES plan_anual (id) ON DELETE CASCADE,
    nombre     text        NOT NULL,
    mes        smallint    NOT NULL CHECK (mes BETWEEN 1 AND 12),
    monto      bigint      NOT NULL CHECK (monto > 0),
    tipo       text        NOT NULL CHECK (tipo IN ('INGRESO', 'GASTO')),
    -- Un ingreso extra (prima) hereda la regla de diezmo de esta persona.
    usuario_id uuid        REFERENCES usuario (id) ON DELETE SET NULL,
    creado_en  timestamptz NOT NULL DEFAULT now()
);

-- Por hogar, como EstadoHogar.proyecciones del dominio. Poner 0 borra la fila.
CREATE TABLE proyeccion_aporte (
    hogar_id   uuid     NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    usuario_id uuid     NOT NULL REFERENCES usuario (id),
    anio       smallint NOT NULL,
    mes        smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
    monto      bigint   NOT NULL CHECK (monto > 0),
    PRIMARY KEY (hogar_id, usuario_id, anio, mes)
);
