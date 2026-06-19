-- ============================================================
-- Migración: soporte tipo uni6 (PFL 24h en 3.0TD/6.1TD)
-- Fecha: 2026-06-17
-- uni6 = 6 periodos de potencia + 1 precio único de energía
-- ============================================================
-- ORDEN CRÍTICO:
--   Primero eliminar los constraints que bloquean el cambio de tipo,
--   luego reclasificar las filas, luego volver a añadir los constraints.
--   Si se añade chk_rpot_len ANTES del UPDATE, las filas uni/6-pot
--   lo violan porque la nueva definición exige 2 pot para type='uni'.
-- ============================================================

-- 1. Eliminar los tres constraints afectados
ALTER TABLE tariffs DROP CONSTRAINT IF EXISTS tariffs_type_check;
ALTER TABLE tariffs DROP CONSTRAINT IF EXISTS chk_ren_len;
ALTER TABLE tariffs DROP CONSTRAINT IF EXISTS chk_rpot_len;

-- 2. Reclasificar CUALQUIER fila uni con 6 potencias → uni6, ANTES de recrear constraints.
--    El criterio es estructural: uni + 6 r_pot = uni6, independientemente del nombre.
--    Esto cubre PFL 24h, Tarifa Plana, y cualquier otro flat-rate en segmentos de 6 periodos.
UPDATE tariffs
SET    type = 'uni6', updated_at = NOW()
WHERE  type = 'uni'
  AND  array_length(r_pot, 1) = 6;

-- 3. Recrear constraints ahora que los datos son consistentes
ALTER TABLE tariffs ADD CONSTRAINT tariffs_type_check
  CHECK (type IN ('uni', 'uni6', 'tri', 'tri6', 'hex'));

ALTER TABLE tariffs ADD CONSTRAINT chk_ren_len CHECK (
  (type = 'uni'  AND array_length(r_en, 1) = 1) OR
  (type = 'uni6' AND array_length(r_en, 1) = 1) OR
  (type = 'tri'  AND array_length(r_en, 1) = 3) OR
  (type = 'tri6' AND array_length(r_en, 1) = 3) OR
  (type = 'hex'  AND array_length(r_en, 1) = 6)
);

ALTER TABLE tariffs ADD CONSTRAINT chk_rpot_len CHECK (
  (type IN ('uni','tri')         AND array_length(r_pot, 1) = 2) OR
  (type IN ('uni6','tri6','hex') AND array_length(r_pot, 1) = 6)
);

-- Verificación
SELECT segment_id, name, type, array_length(r_pot, 1) AS npot, array_length(r_en, 1) AS nen
FROM   tariffs
WHERE  type IN ('uni6')
ORDER  BY segment_id, name;
