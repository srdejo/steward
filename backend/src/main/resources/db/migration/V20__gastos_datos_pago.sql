-- gastos-datos-pago (design D1): datos de pago opcionales de un gasto, en el plan del mes y en el mes base del plan anual.
-- Nacen vacios; el enlace (http o https, hasta 500) y el codigo (hasta 60) los valida la aplicacion.

ALTER TABLE item_plan ADD COLUMN enlace_pago text;
ALTER TABLE item_plan ADD COLUMN codigo_pago text;

ALTER TABLE anual_base_item ADD COLUMN enlace_pago text;
ALTER TABLE anual_base_item ADD COLUMN codigo_pago text;
