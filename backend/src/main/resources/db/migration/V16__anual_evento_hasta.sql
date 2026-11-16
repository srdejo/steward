-- anual-evento-rango (design D2): un evento del año va de su mes hasta otro mes, en lugar de "solo ese mes" o "en
-- adelante". Los eventos de antes quedan hasta diciembre si eran "en adelante"; si no, en su mismo mes.

ALTER TABLE anual_evento ADD COLUMN hasta smallint;
UPDATE anual_evento SET hasta = CASE WHEN en_adelante THEN 12 ELSE mes END;
ALTER TABLE anual_evento ALTER COLUMN hasta SET NOT NULL;
ALTER TABLE anual_evento ADD CONSTRAINT anual_evento_hasta_ck CHECK (hasta BETWEEN mes AND 12);
ALTER TABLE anual_evento DROP COLUMN en_adelante;
