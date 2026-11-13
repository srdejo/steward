-- planear-anio-desde-un-mes (design D1 y D3): el mes base que se replico en el anual, y los eventos con categoria y
-- "de ese mes en adelante". Todo admite nulos o tiene valor por defecto: los anuales y eventos de antes no cambian.

ALTER TABLE plan_anual ADD COLUMN base_anio smallint;
ALTER TABLE plan_anual ADD COLUMN base_mes smallint CHECK (base_mes BETWEEN 1 AND 12);

-- Un gasto en una categoria del hogar; null = "Eventos del año". FK diferida, como las de V4 y V7.
ALTER TABLE anual_evento ADD COLUMN categoria_id uuid REFERENCES categoria (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE anual_evento ADD COLUMN en_adelante boolean NOT NULL DEFAULT false;
