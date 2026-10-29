-- Etapa 5 (backend-cuentas-creditos): cuadre, mover dinero y creditos.

-- Creditos del hogar. Que el total original no sea menor que el saldo se valida al crear, en el caso de uso:
-- "Actualizar saldo" puede subirlo despues (design D4).
CREATE TABLE credito (
    id                   uuid         PRIMARY KEY,
    hogar_id             uuid         NOT NULL REFERENCES hogar (id) ON DELETE CASCADE,
    nombre               text         NOT NULL,
    entidad              text         NOT NULL DEFAULT '',
    saldo                bigint       NOT NULL CHECK (saldo >= 0),
    saldo_actualizado_en date         NOT NULL,
    cuota                bigint       NOT NULL CHECK (cuota > 0),
    tasa_em              numeric(5,2) NOT NULL CHECK (tasa_em >= 0 AND tasa_em <= 10),
    dia_pago             smallint     NOT NULL CHECK (dia_pago BETWEEN 1 AND 31),
    total_original       bigint       NOT NULL CHECK (total_original > 0),
    creado_en            timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX credito_hogar_ix ON credito (hogar_id);

-- Orden de registro (design D1): el saldo estimado suma lo registrado despues del ultimo cuadre, no por fecha.
-- Los existentes se numeran por creado_en; despues lo asigna la identidad.
ALTER TABLE movimiento ADD COLUMN seq bigint;
UPDATE movimiento m SET seq = o.n
FROM (SELECT id, row_number() OVER (ORDER BY creado_en, id) AS n FROM movimiento) o
WHERE m.id = o.id;
ALTER TABLE movimiento ALTER COLUMN seq SET NOT NULL;
ALTER TABLE movimiento ALTER COLUMN seq ADD GENERATED ALWAYS AS IDENTITY;
SELECT setval(pg_get_serial_sequence('movimiento', 'seq'), coalesce((SELECT max(seq) FROM movimiento), 0) + 1, false);
CREATE UNIQUE INDEX movimiento_seq_uq ON movimiento (seq);

-- El seq del ultimo movimiento incluido en saldo_cuadre. Las cuentas que ya existen quedan en 0: su saldo estimado
-- sigue sumando todo desde el saldo inicial.
ALTER TABLE cuenta ADD COLUMN seq_cuadre bigint NOT NULL DEFAULT 0;

ALTER TABLE movimiento DROP CONSTRAINT movimiento_tipo_check;
ALTER TABLE movimiento ADD CONSTRAINT movimiento_tipo_check
    CHECK (tipo IN ('INGRESO_FIJO', 'DIEZMO_ENTREGADO', 'APORTE', 'PAGO', 'GASTO', 'AJUSTE_CUADRE', 'TRANSFERENCIA', 'ABONO_CREDITO'));
-- TRANSFERENCIA: cuenta destino (la de origen va en cuenta_id).
ALTER TABLE movimiento ADD COLUMN cuenta_destino_id uuid REFERENCES cuenta (id) ON DELETE SET NULL;
-- PAGO de un item enlazado y ABONO_CREDITO. Diferidas, como las de V4, para el borrado en cascada del hogar.
ALTER TABLE movimiento ADD COLUMN credito_id uuid REFERENCES credito (id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX movimiento_credito_ix ON movimiento (credito_id) WHERE credito_id IS NOT NULL;
ALTER TABLE item_plan ADD COLUMN credito_id uuid REFERENCES credito (id) DEFERRABLE INITIALLY DEFERRED;
