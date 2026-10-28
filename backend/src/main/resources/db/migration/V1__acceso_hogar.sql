-- Etapa 2: usuarios, hogar, miembros e invitaciones (cambio OpenSpec backend-acceso-hogar, design D3).
-- Ids UUID generados por la app. Montos y demas modulos llegan en migraciones posteriores.

CREATE TABLE usuario (
    id        uuid        PRIMARY KEY,
    email     text        NOT NULL,
    nombre    text        NOT NULL,
    creado_en timestamptz NOT NULL DEFAULT now()
);
-- Un usuario por correo, sin distinguir mayusculas.
CREATE UNIQUE INDEX usuario_email_uq ON usuario (lower(email));

CREATE TABLE hogar (
    id            uuid        PRIMARY KEY,
    nombre        text        NOT NULL,
    configurado   boolean     NOT NULL DEFAULT false,
    -- La lee y escribe el adaptador de prueba de la PWA hasta la Etapa 3; la columna ya queda.
    diezmo_en_hoy text        NOT NULL DEFAULT 'SEPARADO' CHECK (diezmo_en_hoy IN ('SEPARADO', 'AGRUPADO')),
    creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE miembro (
    hogar_id       uuid    NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    usuario_id     uuid    NOT NULL REFERENCES usuario (id),
    unido_en       date    NOT NULL,
    diezmo_aportes boolean NOT NULL DEFAULT false,
    PRIMARY KEY (hogar_id, usuario_id),
    -- Un hogar por usuario, garantizado por la base.
    CONSTRAINT miembro_usuario_uq UNIQUE (usuario_id)
);

CREATE TABLE invitacion (
    id          uuid        PRIMARY KEY,
    hogar_id    uuid        NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    email       text        NOT NULL,
    -- SHA-256 del token: el token en claro solo viaja en el enlace (design D7).
    token_hash  text        NOT NULL,
    estado      text        NOT NULL CHECK (estado IN ('PENDIENTE', 'ACEPTADA')),
    creada_por  uuid        NOT NULL REFERENCES usuario (id),
    enviada_en  timestamptz NOT NULL,
    expira_en   timestamptz NOT NULL,
    aceptada_por uuid       REFERENCES usuario (id),
    aceptada_en timestamptz
);
CREATE UNIQUE INDEX invitacion_token_uq ON invitacion (token_hash);
-- Una sola invitacion pendiente por correo en cada hogar.
CREATE UNIQUE INDEX invitacion_pendiente_uq ON invitacion (hogar_id, lower(email)) WHERE estado = 'PENDIENTE';
