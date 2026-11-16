-- anual-opciones-y-meses (design D2): el plan anual tiene opciones (A, B, ...). Las celdas, los eventos y el mes base son
-- de una opcion; los aportes proyectados siguen siendo del año. Cada año que ya existia gana su Opcion A con lo que tenia,
-- y si ya habia creado sus meses, la A queda en uso.

CREATE TABLE anual_opcion (
    id         uuid        PRIMARY KEY,
    anual_id   uuid        NOT NULL REFERENCES plan_anual (id) ON DELETE CASCADE,
    letra      text        NOT NULL,
    creado_por uuid        REFERENCES usuario (id) ON DELETE SET NULL,
    nota       text        NOT NULL DEFAULT '',
    base_anio  smallint,
    base_mes   smallint    CHECK (base_mes BETWEEN 1 AND 12),
    creado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX anual_opcion_uq ON anual_opcion (anual_id, letra);

ALTER TABLE plan_anual ADD COLUMN opcion_en_uso_id uuid REFERENCES anual_opcion (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- La Opcion A de cada año, a nombre del primer miembro del hogar y con su mes base.
INSERT INTO anual_opcion (id, anual_id, letra, creado_por, base_anio, base_mes)
SELECT gen_random_uuid(), a.id, 'A',
       (SELECT m.usuario_id FROM miembro m WHERE m.hogar_id = a.hogar_id ORDER BY m.unido_en, m.usuario_id LIMIT 1),
       a.base_anio, a.base_mes
FROM plan_anual a;

-- El mes base vive en la opcion.
ALTER TABLE plan_anual DROP COLUMN base_anio;
ALTER TABLE plan_anual DROP COLUMN base_mes;

-- Las celdas pasan a ser de la opcion: su clave es (opcion, categoria, mes).
ALTER TABLE anual_celda ADD COLUMN opcion_id uuid REFERENCES anual_opcion (id) ON DELETE CASCADE;
UPDATE anual_celda c SET opcion_id = o.id FROM anual_opcion o WHERE o.anual_id = c.anual_id;
ALTER TABLE anual_celda ALTER COLUMN opcion_id SET NOT NULL;
ALTER TABLE anual_celda DROP CONSTRAINT anual_celda_pkey;
ALTER TABLE anual_celda ADD PRIMARY KEY (opcion_id, categoria_id, mes);

-- Los eventos tambien.
ALTER TABLE anual_evento ADD COLUMN opcion_id uuid REFERENCES anual_opcion (id) ON DELETE CASCADE;
UPDATE anual_evento e SET opcion_id = o.id FROM anual_opcion o WHERE o.anual_id = e.anual_id;
ALTER TABLE anual_evento ALTER COLUMN opcion_id SET NOT NULL;
CREATE INDEX anual_evento_opcion_ix ON anual_evento (opcion_id);

-- Al final, la A queda en uso en los años que ya habian creado sus meses (la FK es diferida: nada de plan_anual se
-- altera despues de esto).
UPDATE plan_anual a SET opcion_en_uso_id = o.id
FROM anual_opcion o
WHERE o.anual_id = a.id AND a.estado = 'CREADO';
