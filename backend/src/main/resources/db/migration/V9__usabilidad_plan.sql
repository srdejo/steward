-- Etapa 11 (usabilidad-plan): el diezmo enlazado a su linea de ingreso, el bruto de la linea y el capital que un pago le bajo
-- a un credito (design D1, D3 y D8). Aditiva. Antes del deploy a produccion: deploy.ps1 -Action Backup.

-- 1. El bruto de cada linea: el del ingreso fijo enlazado, o su monto.
ALTER TABLE ingreso_plan ADD COLUMN bruto bigint;
UPDATE ingreso_plan l SET bruto = f.bruto FROM ingreso_fijo f WHERE l.ingreso_fijo_id = f.id;
UPDATE ingreso_plan SET bruto = monto WHERE bruto IS NULL;
ALTER TABLE ingreso_plan ALTER COLUMN bruto SET NOT NULL;
ALTER TABLE ingreso_plan ADD CONSTRAINT ingreso_plan_bruto_ck CHECK (bruto >= 0);

-- 2. El diezmo sigue a su linea; "ajustado a mano" deja de seguirla hasta "Volver a calcular".
ALTER TABLE item_plan ADD COLUMN ingreso_plan_id uuid
    REFERENCES ingreso_plan (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE item_plan ADD COLUMN ajustado_a_mano boolean NOT NULL DEFAULT false;

-- El de un ingreso fijo, a la linea FIJO de su misma opcion con ese ingreso.
UPDATE item_plan i SET ingreso_plan_id = l.id
FROM ingreso_plan l
WHERE i.tipo = 'DIEZMO' AND i.ingreso_fijo_id IS NOT NULL
  AND l.escenario_id = i.escenario_id AND l.tipo = 'FIJO' AND l.ingreso_fijo_id = i.ingreso_fijo_id;

-- El de un evento del anual (sin enlace), a la linea EXTRA de su opcion con el mismo nombre.
UPDATE item_plan i SET ingreso_plan_id = l.id
FROM ingreso_plan l
WHERE i.tipo = 'DIEZMO' AND i.ingreso_plan_id IS NULL AND i.ingreso_fijo_id IS NULL AND i.aporte_id IS NULL
  AND l.escenario_id = i.escenario_id AND l.tipo = 'EXTRA' AND i.nombre = 'Diezmo · ' || l.nombre;

-- Ajustado a mano: el que ya no coincide con lo que sugiere la regla actual (sin regla activa, el 10 % del monto).
UPDATE item_plan i SET ajustado_a_mano = true
FROM ingreso_plan l
LEFT JOIN regla_diezmo r ON r.usuario_id = l.usuario_id AND r.activa
WHERE i.ingreso_plan_id = l.id
  AND i.monto <> CASE WHEN r.usuario_id IS NULL THEN round(l.monto * 10 / 100.0)::bigint
                      ELSE round(CASE r.base WHEN 'BRUTO' THEN l.bruto ELSE l.monto END * r.porcentaje / 100)::bigint END;

-- 3. Lo que bajo el saldo de un credito un pago de cuota o un abono; se devuelve al borrarlo (null en los de antes).
ALTER TABLE movimiento ADD COLUMN capital bigint;

-- La FK item_plan.aporte_id ya es ON DELETE SET NULL desde V8: un aporte borrado deja su diezmo pagado sin enlace.
