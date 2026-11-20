-- El mes de la primera cuota de un credito, si es posterior al mes en que se creo (design D1 de credito-primera-cuota).
-- Se guarda el dia 1 de ese mes; null es la regla de siempre. Los creditos que ya existen quedan en null.
ALTER TABLE credito ADD COLUMN primera_cuota date;
