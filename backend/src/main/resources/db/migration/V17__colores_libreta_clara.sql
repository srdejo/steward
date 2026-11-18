-- Colores de categoria de Libreta clara como color inicial (color-categorias, design D3).
-- Solo cambian las que siguen en el color del diseño anterior: las que el hogar ya cambio se quedan como estan.
UPDATE categoria SET color = '#2C7A70' WHERE sistema AND tipo = 'DIEZMO' AND upper(color) = '#0F766E';
UPDATE categoria SET color = '#C2603A' WHERE sistema AND tipo = 'FIJO' AND upper(color) = '#E2551B';
UPDATE categoria SET color = '#8A8D85' WHERE sistema AND tipo = 'VARIABLE' AND upper(color) = '#8D8F88';
UPDATE categoria SET color = '#6B5BA8' WHERE sistema AND tipo = 'TARJETA' AND upper(color) = '#7C4DDB';
UPDATE categoria SET color = '#6B5BA8' WHERE sistema AND tipo = 'CREDITO' AND upper(color) IN ('#2E6B45', '#7C4DDB');
-- Las propias que nacieron con el gris anterior.
UPDATE categoria SET color = '#8A8D85' WHERE NOT sistema AND upper(color) = '#8D8F88';
