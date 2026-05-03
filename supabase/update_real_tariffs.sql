-- Limpiar tarifas residenciales antiguas
DELETE FROM tariffs WHERE segment_id = 'res';

-- Insertar tarifas residenciales VERDADERAS (Canarias 2026)
-- 1. Por Uso (imp. reducidos) - USA €/kW·año
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva) 
VALUES (
  'res', 
  'Por Uso (imp. reducidos)', 
  'uni', 
  'anio', 
  ARRAY[34.341384, 10.301040], -- P1, P2 (kW/año)
  ARRAY[0.140599],             -- E1 (kWh)
  0
);

-- 2. Por Uso Luz 2.0 - USA €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva) 
VALUES (
  'res', 
  'Por Uso Luz 2.0', 
  'uni', 
  'dia', 
  ARRAY[0.123030, 0.037337], -- P1, P2 (kW/día)
  ARRAY[0.109900],           -- E1 (kWh)
  0
);

-- 3. Noche Luz 2.0 - USA €/kW·día + TRI-HORARIA
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva) 
VALUES (
  'res', 
  'Noche Luz 2.0', 
  'tri', 
  'dia', 
  ARRAY[0.110970, 0.033677], -- P1, P2 (kW/día)
  ARRAY[0.189562, 0.116955, 0.082281], -- E1, E2, E3 (kWh)
  0
);
