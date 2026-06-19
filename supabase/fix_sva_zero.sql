-- ============================================================
-- Migración: poner sva=0 en los PFL One de pyme20one, pyme30, pyme61
-- Fecha: 2026-06-17
-- Motivo: el SVE es un servicio OPCIONAL gestionado en la UI,
--   no un atributo de la tarifa. El precio 6.44€/mes que tenían
--   los PFL One era incorrecto y además estaba desactualizado.
--   Los planes importados desde JSON ya tienen sva=0 correctamente.
-- ============================================================

UPDATE tariffs
SET sva = 0, updated_at = NOW()
WHERE sva <> 0
  AND segment_id IN ('pyme20one', 'pyme30', 'pyme61');

-- Verificación
SELECT segment_id, name, type, sva
FROM tariffs
WHERE segment_id IN ('pyme20one', 'pyme30', 'pyme61')
ORDER BY segment_id, name;
