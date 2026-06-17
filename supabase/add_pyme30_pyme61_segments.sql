-- ============================================================
-- Migración: Agregar segmentos pyme30 y pyme61 separados
-- Fecha: 2026-06-17
-- ============================================================
-- Esta migración:
--   1. Inserta segmentos pyme30 (3.0TD, 6 periodos) y pyme61 (6.1TD, 6 periodos)
--   2. Copia la fiscalidad PYME correcta (3% IGIC rojo, 7% IGIC verde, 5.11% imp. eléc.)
--   3. Agrega 4 tarifas ONE de ejemplo para cada segmento
--   4. Las tarifas normales (base/SUPRA) se importarán vía TariffImporter desde JSON
-- ============================================================

-- 1. Agregar segmentos pyme30 (3.0TD) y pyme61 (6.1TD)
INSERT INTO segments (id, label, tax_model, pot_p, bono_rate, excedente_rate, tax_imp_elec, tax_igic, tax_igic_red, tax_igic_7)
VALUES
  ('pyme30', 'Pyme 3.0TD', 'pyme', 6, 0.019121, 0.06, 5.1127, 0, 3, 7),
  ('pyme61', 'Pyme 6.1TD', 'pyme', 6, 0.019121, 0.06, 5.1127, 0, 3, 7)
ON CONFLICT (id) DO NOTHING;

-- 2. Agregar tarifas ONE para pyme30 (Pyme 3.0TD)
INSERT INTO tariffs (name, segment_id, type, pot_unit, r_pot, r_en, sva, requires_auth, is_active)
VALUES
  -- Plan Fijo Luz 24h One (3.0TD)
  ('PFL 24h One', 'pyme30', 'uni', 'anio', 
   ARRAY[0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
   ARRAY[0.1279],
   6.44, false, true),
  
  -- Plan Fijo Luz One (3.0TD) - Trihorario
  ('PFL One', 'pyme30', 'tri6', 'anio',
   ARRAY[0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
   ARRAY[0.1225, 0.1325, 0.0825],
   6.44, false, true),
  
  -- Plan Fijo Luz Trihorario One (3.0TD) - Hex
  ('PFL Trihorario One', 'pyme30', 'hex', 'anio',
   ARRAY[0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
   ARRAY[0.1225, 0.1225, 0.1225, 0.1325, 0.1325, 0.0825],
   6.44, false, true),
  
  -- Tarifa Plana One (3.0TD)
  ('Tarifa Plana One', 'pyme30', 'uni', 'anio',
   ARRAY[0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
   ARRAY[0.1199],
   6.44, false, true)
ON CONFLICT DO NOTHING;

-- 3. Agregar tarifas ONE para pyme61 (Pyme 6.1TD)
INSERT INTO tariffs (name, segment_id, type, pot_unit, r_pot, r_en, sva, requires_auth, is_active)
VALUES
  -- Plan Fijo Luz 24h One (6.1TD)
  ('PFL 24h One', 'pyme61', 'uni', 'anio', 
   ARRAY[0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
   ARRAY[0.1279],
   6.44, false, true),
  
  -- Plan Fijo Luz One (6.1TD) - Trihorario
  ('PFL One', 'pyme61', 'tri6', 'anio',
   ARRAY[0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
   ARRAY[0.1225, 0.1325, 0.0825],
   6.44, false, true),
  
  -- Plan Fijo Luz Trihorario One (6.1TD) - Hex
  ('PFL Trihorario One', 'pyme61', 'hex', 'anio',
   ARRAY[0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
   ARRAY[0.1225, 0.1225, 0.1225, 0.1325, 0.1325, 0.0825],
   6.44, false, true),
  
  -- Tarifa Plana One (6.1TD)
  ('Tarifa Plana One', 'pyme61', 'uni', 'anio',
   ARRAY[0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
   ARRAY[0.1199],
   6.44, false, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICACIÓN: confirmar que los segmentos y tarifas se crearon
-- ============================================================

-- Ver segmentos creados
SELECT id, label, tax_model, pot_p, tax_igic_red, tax_igic_7, tax_imp_elec
FROM segments
WHERE id IN ('pyme30', 'pyme61')
ORDER BY id;

-- Ver tarifas creadas por segmento
SELECT segment_id, name, type, pot_unit, sva, is_active
FROM tariffs
WHERE segment_id IN ('pyme30', 'pyme61')
ORDER BY segment_id, name;
