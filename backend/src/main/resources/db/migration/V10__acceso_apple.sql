-- Acceso con Apple y eliminar la cuenta (design D4 y D5 de app-movil-conectada). Aditiva.
ALTER TABLE usuario ADD COLUMN apple_sub text;
ALTER TABLE usuario ADD COLUMN eliminado_en timestamptz;
CREATE UNIQUE INDEX usuario_apple_sub_uq ON usuario (apple_sub) WHERE apple_sub IS NOT NULL;
