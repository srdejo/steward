-- tarjetas-y-creditos: Tarjetas vuelve como categoria del sistema, aparte de Creditos. Las lineas de las tarjetas
-- (item_plan.tarjeta_id) van en Tarjetas; las compras a cuotas y los prestamos se quedan en Creditos.

-- Si el hogar ya tiene una categoria propia llamada "Tarjetas", esa pasa a ser la del sistema (el nombre es unico).
UPDATE categoria c SET tipo = 'TARJETA', sistema = true
WHERE lower(c.nombre) = 'tarjetas' AND c.tipo <> 'TARJETA'
  AND NOT EXISTS (SELECT 1 FROM categoria t WHERE t.hogar_id = c.hogar_id AND t.tipo = 'TARJETA');

INSERT INTO categoria (id, hogar_id, nombre, color, orden, tipo, sistema)
SELECT gen_random_uuid(), h.id, 'Tarjetas', '#7C4DDB', 3, 'TARJETA', true
FROM hogar h
WHERE NOT EXISTS (SELECT 1 FROM categoria t WHERE t.hogar_id = h.id AND t.tipo = 'TARJETA');

-- Orden: Diezmo, Gastos fijos, Variables, Tarjetas, Creditos.
UPDATE categoria SET orden = 2 WHERE tipo = 'VARIABLE' AND sistema;
UPDATE categoria SET orden = 3 WHERE tipo = 'TARJETA' AND sistema;
UPDATE categoria SET orden = 4 WHERE tipo = 'CREDITO' AND sistema;
-- Creditos deja el color de las tarjetas, si seguia en el que le puso V12.
UPDATE categoria SET color = '#2E6B45' WHERE tipo = 'CREDITO' AND sistema AND upper(color) = '#7C4DDB';

-- Las lineas de las tarjetas pasan a Tarjetas.
UPDATE item_plan i SET categoria_id = t.id
FROM escenario e
JOIN plan_mes p ON p.id = e.plan_id
JOIN categoria t ON t.hogar_id = p.hogar_id AND t.tipo = 'TARJETA'
WHERE e.id = i.escenario_id AND i.tarjeta_id IS NOT NULL AND i.categoria_id <> t.id;
