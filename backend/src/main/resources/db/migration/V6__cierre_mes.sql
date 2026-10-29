-- Etapa 6 (backend-cierre-mes): la foto del cierre que calcula la PWA con el dominio compartido (design D1 y D2).

CREATE TABLE cierre_mes (
    id            uuid        PRIMARY KEY,
    hogar_id      uuid        NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    ref_anio      smallint    NOT NULL,
    ref_mes       smallint    NOT NULL CHECK (ref_mes BETWEEN 1 AND 12),
    sin_registrar bigint      NOT NULL,
    sobrante      bigint      NOT NULL,
    a_ahorro      bigint      NOT NULL CHECK (a_ahorro >= 0),
    a_siguiente   bigint      NOT NULL CHECK (a_siguiente >= 0),
    -- Sin cascada desde usuario, como creado_por en movimiento: el hogar se borra antes que las personas.
    cerrado_por   uuid        NOT NULL REFERENCES usuario (id),
    cerrado_en    date        NOT NULL,
    creado_en     timestamptz NOT NULL DEFAULT now()
);
-- Un mes se cierra una vez (MES_CERRADO), aunque lleguen dos a la vez.
CREATE UNIQUE INDEX cierre_mes_uq ON cierre_mes (hogar_id, ref_anio, ref_mes);

CREATE TABLE cierre_fila (
    cierre_id uuid     NOT NULL REFERENCES cierre_mes (id) ON DELETE CASCADE,
    orden     smallint NOT NULL,
    nombre    text     NOT NULL,
    plan      bigint,
    real      bigint   NOT NULL,
    PRIMARY KEY (cierre_id, orden)
);
