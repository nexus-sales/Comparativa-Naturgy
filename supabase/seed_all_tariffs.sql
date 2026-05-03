-- ============================================================
-- SEED COMPLETO: Todas las tarifas reales extraídas de index_vanilla.html
-- Canarias 2026 — Naturgy
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Limpiar tarifas existentes (placeholder + parciales previas)
DELETE FROM tariffs;

-- ────────────────────────────────────────────────────────────
-- SEGMENTO: Residencial (res)  |  potP=2  |  taxModel='res'
-- ────────────────────────────────────────────────────────────

-- r1: Por Uso (imp. reducidos) — UNI / €/kW·AÑO
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('res', 'Por Uso (imp. reducidos)', 'uni', 'anio',
  ARRAY[34.341384, 10.30104],
  ARRAY[0.140599],
  0, false);

-- r2: Por Uso Luz 2.0 — UNI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('res', 'Por Uso Luz 2.0', 'uni', 'dia',
  ARRAY[0.12303, 0.037337],
  ARRAY[0.1099],
  0, false);

-- r3: Noche Luz 2.0 — TRI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('res', 'Noche Luz 2.0', 'tri', 'dia',
  ARRAY[0.11097, 0.033677],
  ARRAY[0.189562, 0.116955, 0.082281],
  0, false);

-- ────────────────────────────────────────────────────────────
-- SEGMENTO: Pyme 2.0TD (pyme20)  |  potP=2  |  taxModel='pyme'
-- ────────────────────────────────────────────────────────────

-- p1: Plan Fijo Luz 24h — UNI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'Plan Fijo Luz 24h', 'uni', 'dia',
  ARRAY[0.122973, 0.043976],
  ARRAY[0.136171],
  0, false);

-- p2: Plan Fijo Luz 24h SUPRA — UNI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'Plan Fijo Luz 24h SUPRA', 'uni', 'dia',
  ARRAY[0.122973, 0.043976],
  ARRAY[0.149171],
  0, false);

-- p3: PFL ONE 24h — UNI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'PFL ONE 24h', 'uni', 'dia',
  ARRAY[0.116318, 0.044521],
  ARRAY[0.115099],
  0, false);

-- p4: Plan Fijo Trihorario — TRI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'Plan Fijo Trihorario', 'tri', 'dia',
  ARRAY[0.120853, 0.0439],
  ARRAY[0.201461, 0.132213, 0.097634],
  0, false);

-- p5: PFL Trihorario ONE — TRI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'PFL Trihorario ONE', 'tri', 'dia',
  ARRAY[0.116318, 0.044521],
  ARRAY[0.1705, 0.116499, 0.0819],
  0, false);

-- p6: Plan Fijo SUPRA Trihorario — TRI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'Plan Fijo SUPRA Trihorario', 'tri', 'dia',
  ARRAY[0.120853, 0.0439],
  ARRAY[0.214461, 0.145213, 0.110634],
  0, false);

-- ────────────────────────────────────────────────────────────
-- SEGMENTO: Pyme ONE 2.0TD (pyme20one)  |  potP=2  |  taxModel='pyme'
-- requires_auth=true: este segmento requiere autorización previa de Naturgy
-- ────────────────────────────────────────────────────────────

-- o1: Plan Fijo Luz 24h One — UNI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20one', 'Plan Fijo Luz 24h One', 'uni', 'dia',
  ARRAY[0.122973, 0.043976],
  ARRAY[0.120671],
  0, true);

-- o2: PFL ONE 24h — UNI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20one', 'PFL ONE 24h', 'uni', 'dia',
  ARRAY[0.116318, 0.044521],
  ARRAY[0.115099],
  0, true);

-- o3: Plan Fijo Luz One (trihoraria) — TRI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20one', 'Plan Fijo Luz One (trihoraria)', 'tri', 'dia',
  ARRAY[0.122973, 0.043976],
  ARRAY[0.190964, 0.117811, 0.082473],
  0, true);

-- o4: PFL Trihorario ONE — TRI / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20one', 'PFL Trihorario ONE', 'tri', 'dia',
  ARRAY[0.116318, 0.044521],
  ARRAY[0.1705, 0.116499, 0.0819],
  0, true);

-- ────────────────────────────────────────────────────────────
-- SEGMENTO: Pyme 3.0/6.1TD (pyme361)  |  potP=6  |  taxModel='pyme'
-- ────────────────────────────────────────────────────────────

-- x1: Plan Fijo Luz BASIC 3.0 — HEX / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme361', 'Plan Fijo Luz BASIC 3.0', 'hex', 'dia',
  ARRAY[0.055959, 0.030187, 0.013779, 0.012187, 0.008479, 0.005817],
  ARRAY[0.190851, 0.165002, 0.142965, 0.130256, 0.123688, 0.11613],
  0, false);

-- x2: Plan Fijo Luz ONE 3.0 — HEX / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme361', 'Plan Fijo Luz ONE 3.0', 'hex', 'dia',
  ARRAY[0.055959, 0.030187, 0.013779, 0.012187, 0.008479, 0.005817],
  ARRAY[0.185351, 0.159502, 0.137465, 0.124756, 0.118188, 0.11063],
  0, false);

-- x3: Plan Fijo Luz BASIC 6.1 — HEX / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme361', 'Plan Fijo Luz BASIC 6.1', 'hex', 'dia',
  ARRAY[0.078882, 0.041309, 0.01797, 0.01417, 0.005295, 0.00251],
  ARRAY[0.166016, 0.144923, 0.130155, 0.121017, 0.114657, 0.108359],
  0, false);

-- x4: Plan Fijo Luz ONE 6.1 — HEX / €/kW·día
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme361', 'Plan Fijo Luz ONE 6.1', 'hex', 'dia',
  ARRAY[0.078882, 0.041309, 0.01797, 0.01417, 0.005295, 0.00251],
  ARRAY[0.160516, 0.139423, 0.124655, 0.115517, 0.109157, 0.102859],
  0, false);

-- ────────────────────────────────────────────────────────────
-- Verificación: contar tarifas por segmento (debería dar 3/6/4/4)
-- ────────────────────────────────────────────────────────────
SELECT segment_id, COUNT(*) as total
FROM tariffs
GROUP BY segment_id
ORDER BY segment_id;
