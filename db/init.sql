-- ============================================================
-- NATURGY COMPARATIVA — esquema Postgres propio (Dokploy)
-- Sustituye por completo el esquema Supabase (supabase/schema_v2.sql).
-- Admin único: sin RLS, sin tabla profiles, sin dueño de fila.
-- ============================================================

-- ============================================================
-- SEGMENTS — catálogo de segmentos tarifarios
-- ============================================================

CREATE TABLE IF NOT EXISTS segments (
  id              TEXT    PRIMARY KEY,
  label           TEXT    NOT NULL,
  tax_model       TEXT    NOT NULL,
  pot_p           INTEGER NOT NULL DEFAULT 2,
  bono_rate       NUMERIC DEFAULT 0.019121,
  excedente_rate  NUMERIC DEFAULT 0.06,
  tax_imp_elec    NUMERIC DEFAULT 5.1127,
  tax_igic        NUMERIC DEFAULT 7,
  tax_igic_red    NUMERIC DEFAULT 3,
  tax_igic_7      NUMERIC DEFAULT 7
);

INSERT INTO segments (id, label, tax_model, pot_p, bono_rate, excedente_rate, tax_imp_elec, tax_igic, tax_igic_red, tax_igic_7) VALUES
  ('res',       'Residencial',    'res',  2, 0.019121, 0.06, 5.1127, 7, 0, 0),
  ('pyme20',    'Pyme 2.0TD',     'pyme', 2, 0.019121, 0.06, 5.1127, 0, 3, 7),
  ('pyme20one', 'Pyme ONE 2.0TD', 'pyme', 2, 0.019121, 0.06, 5.1127, 0, 3, 7),
  ('pyme30',    'Pyme 3.0TD',     'pyme', 6, 0.019121, 0.06, 5.1127, 0, 3, 7),
  ('pyme61',    'Pyme 6.1TD',     'pyme', 6, 0.019121, 0.06, 5.1127, 0, 3, 7)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TARIFFS — catálogo de tarifas por segmento
-- ============================================================

CREATE TABLE IF NOT EXISTS tariffs (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id    TEXT    NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  -- uni6  = 6 periodos de potencia + 1 precio único de energía (PFL 24h en 3.0/6.1TD)
  -- tri6  = 6 periodos de potencia + 3 bloques de energía (horario trihorario en AT)
  type          TEXT    NOT NULL CHECK (type IN ('uni', 'uni6', 'tri', 'tri6', 'hex')),
  pot_unit      TEXT    NOT NULL CHECK (pot_unit IN ('dia', 'anio')),
  r_pot         NUMERIC[] NOT NULL,
  r_en          NUMERIC[] NOT NULL,
  sva           NUMERIC DEFAULT 0,
  requires_auth BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_ren_len CHECK (
    (type = 'uni'  AND array_length(r_en,  1) = 1) OR
    (type = 'uni6' AND array_length(r_en,  1) = 1) OR
    (type = 'tri'  AND array_length(r_en,  1) = 3) OR
    (type = 'tri6' AND array_length(r_en,  1) = 3) OR
    (type = 'hex'  AND array_length(r_en,  1) = 6)
  ),
  CONSTRAINT chk_rpot_len CHECK (
    (type IN ('uni','tri')         AND array_length(r_pot, 1) = 2) OR
    (type IN ('uni6','tri6','hex') AND array_length(r_pot, 1) = 6)
  )
);

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tariffs_updated_at ON tariffs;
CREATE TRIGGER tariffs_updated_at
  BEFORE UPDATE ON tariffs
  FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- ============================================================
-- CLIENT_COMPARISONS — historial de comparativas guardadas
-- Sin user_id: admin único, no hay dueño de fila que distinguir.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_comparisons (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name      TEXT,
  client_email     TEXT,
  client_address   TEXT,
  target_tariff    TEXT,
  target_segment   TEXT,
  calculation_data JSONB   NOT NULL DEFAULT '{}',
  deleted_by_user  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_comparisons_created_at ON client_comparisons (created_at DESC);

-- ============================================================
-- NOTICES — avisos y novedades internas
-- Sin created_by: no hay varios usuarios que distinguir.
-- ============================================================

CREATE TABLE IF NOT EXISTS notices (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  type           TEXT    NOT NULL CHECK (type IN ('tarifa', 'servicio', 'noticia')),
  title          TEXT    NOT NULL,
  body           TEXT    NOT NULL DEFAULT '',
  effective_date DATE,
  expires_at     DATE,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS notices_updated_at ON notices;
CREATE TRIGGER notices_updated_at
  BEFORE UPDATE ON notices
  FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- ============================================================
-- VERIFICACIÓN
-- SELECT * FROM segments;
-- SELECT * FROM tariffs LIMIT 5;
-- ============================================================
