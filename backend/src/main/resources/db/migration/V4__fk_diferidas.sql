-- Borrar un hogar (sale el ultimo miembro) borra en cascada sus categorias, planes, items y movimientos. Las llaves
-- sin cascada entre ellos se verificaban fila por fila a mitad del borrado y lo hacian fallar. Diferidas, se verifican
-- al terminar la transaccion: la cascada completa pasa, y quitar solo un item con pagos sigue fallando (design D7 de
-- backend-plan-mes-hoy; el caso de uso responde antes ITEM_CON_PAGOS).

ALTER TABLE item_plan DROP CONSTRAINT item_plan_categoria_id_fkey;
ALTER TABLE item_plan ADD CONSTRAINT item_plan_categoria_id_fkey
    FOREIGN KEY (categoria_id) REFERENCES categoria (id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE movimiento DROP CONSTRAINT movimiento_item_id_fkey;
ALTER TABLE movimiento ADD CONSTRAINT movimiento_item_id_fkey
    FOREIGN KEY (item_id) REFERENCES item_plan (id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE movimiento DROP CONSTRAINT movimiento_ingreso_fijo_id_fkey;
ALTER TABLE movimiento ADD CONSTRAINT movimiento_ingreso_fijo_id_fkey
    FOREIGN KEY (ingreso_fijo_id) REFERENCES ingreso_fijo (id) DEFERRABLE INITIALLY DEFERRED;
