-- avisos-pagos: dispositivos que reciben avisos, la configuracion de cada persona y lo ya enviado (design D2 y D6).
-- No toca datos existentes.

-- Un iPhone (token de Expo) o un navegador (suscripcion Web Push) de una persona. Un token es de un solo usuario: si
-- otra persona inicia sesion en el mismo dispositivo, el token pasa a ella.
CREATE TABLE dispositivo_aviso (
    id         uuid        PRIMARY KEY,
    usuario_id uuid        NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    tipo       text        NOT NULL CHECK (tipo IN ('EXPO', 'WEB')),
    token      text        NOT NULL,
    p256dh     text,
    auth       text,
    creado_en  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dispositivo_aviso_token_uq UNIQUE (token),
    CONSTRAINT dispositivo_aviso_web_ck CHECK (tipo = 'EXPO' OR (p256dh IS NOT NULL AND auth IS NOT NULL))
);
CREATE INDEX dispositivo_aviso_usuario_ix ON dispositivo_aviso (usuario_id);

-- Solo hay fila cuando la persona guarda algo; sin fila rigen los valores por defecto (todo activo, correo y no molestar).
CREATE TABLE preferencia_aviso (
    usuario_id     uuid    PRIMARY KEY REFERENCES usuario (id) ON DELETE CASCADE,
    tipos_apagados text[]  NOT NULL DEFAULT '{}',
    correo         boolean NOT NULL DEFAULT true,
    no_molestar    boolean NOT NULL DEFAULT true
);

-- Cada aviso enviado (o pospuesto) a una persona: clave = tipo:id:yyyy-mm, momento = LUNES | ANTES | DIA | POSPUESTO |
-- CORREO | ACTIVIDAD, y fecha = el dia en que toca. Se inserta antes de enviar; la restriccion unica evita repetir.
CREATE TABLE aviso_enviado (
    id         uuid        PRIMARY KEY,
    usuario_id uuid        NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    clave      text        NOT NULL,
    momento    text        NOT NULL CHECK (momento IN ('LUNES', 'ANTES', 'DIA', 'POSPUESTO', 'CORREO', 'ACTIVIDAD')),
    fecha      date        NOT NULL,
    enviado_en timestamptz,
    CONSTRAINT aviso_enviado_uq UNIQUE (usuario_id, clave, momento, fecha)
);
CREATE INDEX aviso_enviado_pendiente_ix ON aviso_enviado (fecha) WHERE enviado_en IS NULL;
