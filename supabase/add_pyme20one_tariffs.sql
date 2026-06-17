-- Migración para agregar tarifas PYME ONE 2.0TD
-- Fecha: 2024-06-17
-- SVE GC Xpress: 6.44 €/mes (prorrateado por días en el cálculo)

INSERT INTO tariffs (name, segment_id, type, pot_unit, r_pot, r_en, sva, requires_auth, is_active)
VALUES 
  -- Plan Fijo Luz 24h One (uniforme)
  ('PFL 24h One', 'pyme20one', 'uni', 'anio', 
   ARRAY[44.884445, 16.051480]::numeric[], -- P1 y P2 en €/kW·año
   ARRAY[0.128900]::numeric[], -- P1 único en €/kWh
   6.44, -- SVE GC Xpress en €/mes
   false, true),
   
  -- Plan Fijo Luz One (discriminación horaria 2 periodos)
  ('PFL One', 'pyme20one', 'tri', 'anio',
   ARRAY[44.884445, 16.051480]::numeric[], -- P1 y P2 en €/kW·año
   ARRAY[0.153300, 0.077300, 0.0]::numeric[], -- P1, P2, P3(no usado) en €/kWh
   6.44, -- SVE GC Xpress
   false, true),
   
  -- Plan Fijo Luz Trihorario One (3 periodos)
  ('PFL Trihorario One', 'pyme20one', 'tri', 'anio',
   ARRAY[44.884445, 16.051480]::numeric[], -- P1 y P2 en €/kW·año
   ARRAY[0.163500, 0.106400, 0.070900]::numeric[], -- P1, P2, P3 en €/kWh
   6.44, -- SVE GC Xpress
   false, true),
   
  -- Tarifa Plana One (precio único todo el año)
  ('Tarifa Plana One', 'pyme20one', 'uni', 'anio',
   ARRAY[44.884445, 16.051480]::numeric[], -- P1 y P2 en €/kW·año
   ARRAY[0.135500]::numeric[], -- Precio único en €/kWh
   6.44, -- SVE GC Xpress
   false, true)
ON CONFLICT (name, segment_id) DO UPDATE SET
  type = EXCLUDED.type,
  pot_unit = EXCLUDED.pot_unit,
  r_pot = EXCLUDED.r_pot,
  r_en = EXCLUDED.r_en,
  sva = EXCLUDED.sva,
  requires_auth = EXCLUDED.requires_auth,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verificar la inserción
SELECT id, name, segment_id, type, pot_unit, r_pot, r_en, sva 
FROM tariffs 
WHERE segment_id = 'pyme20one';