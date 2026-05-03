-- Datos iniciales para segmentos (si no existen)
INSERT INTO segments (id, label, tax_model, pot_p) VALUES
('res', 'Residencial', 'res', 2),
('pyme20', 'Pyme 2.0TD', 'pyme', 2),
('pyme20one', 'Pyme ONE 2.0TD', 'pyme', 2),
('pyme361', 'Pyme 3.0/6.1TD', 'pyme', 6)
ON CONFLICT (id) DO NOTHING;

-- Tarifas de ejemplo (Naturgy Canarias)
-- r_pot y r_en son arrays de precios: [P1, P2, P3, P4, P5, P6]
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva) VALUES
-- Residencial Unihoraria
('res', 'Naturgy Por Uso (Res)', 'uni', 'anio', '{28.50, 28.50}', '{0.1450}', 0),
('res', 'Naturgy Digital (Res)', 'uni', 'anio', '{26.10, 26.10}', '{0.1380}', 1.50),

-- Pyme 2.0TD
('pyme20', 'Naturgy Pyme Fija 2.0', 'uni', 'dia', '{0.078, 0.078}', '{0.155}', 0),
('pyme20', 'Naturgy Pyme Variable', 'tri', 'dia', '{0.082, 0.082}', '{0.180, 0.140, 0.110}', 3.00),

-- Pyme 3.0TD (6 periodos)
('pyme361', 'Naturgy Industrial 3.0', 'hex', 'dia', '{0.10, 0.09, 0.08, 0.07, 0.06, 0.05}', '{0.19, 0.17, 0.15, 0.13, 0.11, 0.09}', 10.00);