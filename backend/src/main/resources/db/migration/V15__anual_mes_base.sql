-- anual-mes-base-editable (design D3): el mes base editable de una opcion del año. Sus gastos se copian de un mes (o
-- desde cero) y se ajustan a mano; si una opcion lo tiene, los meses que se crean desde ella salen de aqui. El origen va
-- en anual_opcion.base_anio y base_mes.

ALTER TABLE anual_opcion ADD COLUMN con_mes_base boolean NOT NULL DEFAULT false;

CREATE TABLE anual_base_item (
    id           uuid     PRIMARY KEY,
    opcion_id    uuid     NOT NULL REFERENCES anual_opcion (id) ON DELETE CASCADE,
    categoria_id uuid     NOT NULL REFERENCES categoria (id) DEFERRABLE INITIALLY DEFERRED,
    nombre       text     NOT NULL,
    monto        bigint   NOT NULL CHECK (monto >= 0),
    dia_vence    smallint CHECK (dia_vence BETWEEN 1 AND 31),
    tipo         text     NOT NULL,
    cuota_actual smallint,
    cuota_total  smallint,
    credito_id   uuid     REFERENCES credito (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    tarjeta_id   uuid     REFERENCES tarjeta (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    orden        integer  NOT NULL DEFAULT 0
);
CREATE INDEX anual_base_item_opcion_ix ON anual_base_item (opcion_id);
