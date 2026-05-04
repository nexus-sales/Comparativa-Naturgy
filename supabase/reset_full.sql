-- ============================================================
-- RESET COMPLETO — Nexus Hub / Comparativa Naturgy
-- Borra todo y reconstruye desde cero con el schema corregido
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- ── 1. BORRAR TODO (orden correcto por dependencias FK) ───────

DROP TRIGGER IF EXISTS tariffs_updated_at ON tariffs;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.update_timestamp() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

DROP TABLE IF EXISTS tariffs CASCADE;
DROP TABLE IF EXISTS segments CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ── 2. EXTENSIÓN ──────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 3. TABLAS ─────────────────────────────────────────────────

CREATE TABLE profiles (
    id          UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email       TEXT,
    is_admin    BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE
);

CREATE TABLE segments (
    id        TEXT PRIMARY KEY,
    label     TEXT NOT NULL,
    tax_model TEXT NOT NULL,
    pot_p     INTEGER NOT NULL DEFAULT 2
);

CREATE TABLE tariffs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id   TEXT REFERENCES segments(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('uni', 'tri', 'hex')),
    pot_unit     TEXT NOT NULL,
    r_pot        NUMERIC[] NOT NULL,
    r_en         NUMERIC[] NOT NULL,
    sva          NUMERIC DEFAULT 0,
    requires_auth BOOLEAN DEFAULT FALSE,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_ren_len CHECK (
        (type = 'uni' AND array_length(r_en, 1) = 1) OR
        (type = 'tri' AND array_length(r_en, 1) = 3) OR
        (type = 'hex' AND array_length(r_en, 1) = 6)
    ),
    CONSTRAINT chk_rpot_len CHECK (
        (type IN ('uni', 'tri') AND array_length(r_pot, 1) = 2) OR
        (type = 'hex'           AND array_length(r_pot, 1) = 6)
    )
);

-- ── 4. RLS ────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs  ENABLE ROW LEVEL SECURITY;

-- profiles: cada usuario solo ve/edita su propio perfil; admins lo gestionan todo
CREATE POLICY "Users can view own profile"    ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL    TO authenticated
    USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);

-- segments: lectura pública (sin autenticación requerida)
CREATE POLICY "Anyone can read segments" ON segments FOR SELECT TO anon, authenticated USING (true);

-- tariffs: lectura pública; escritura solo admins
CREATE POLICY "Anyone can read tariffs"  ON tariffs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can manage tariffs" ON tariffs FOR ALL    TO authenticated
    USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = true);

-- ── 5. FUNCIONES Y TRIGGERS ───────────────────────────────────

-- Auto-crear perfil al registrar un usuario nuevo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, is_admin, is_approved)
    VALUES (NEW.id, NEW.email, false, false);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Auto-actualizar updated_at al modificar una tarifa
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tariffs_updated_at
    BEFORE UPDATE ON tariffs
    FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();

-- ── 6. DATOS: SEGMENTOS ───────────────────────────────────────

INSERT INTO segments (id, label, tax_model, pot_p) VALUES
    ('res',       'Residencial',    'res',  2),
    ('pyme20',    'Pyme 2.0TD',     'pyme', 2),
    ('pyme20one', 'Pyme ONE 2.0TD', 'pyme', 2),
    ('pyme361',   'Pyme 3.0/6.1TD', 'pyme', 6);

-- ── 7. DATOS: TARIFAS ─────────────────────────────────────────

-- ─── Residencial ──────────────────────────────────────────────
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('res', 'Por Uso (imp. reducidos)', 'uni', 'anio',
    ARRAY[34.341384, 10.30104], ARRAY[0.140599], 0, false);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('res', 'Por Uso Luz 2.0', 'uni', 'dia',
    ARRAY[0.12303, 0.037337], ARRAY[0.1099], 0, false);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('res', 'Noche Luz 2.0', 'tri', 'dia',
    ARRAY[0.11097, 0.033677], ARRAY[0.189562, 0.116955, 0.082281], 0, false);

-- ─── Pyme 2.0TD ───────────────────────────────────────────────
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'Plan Fijo Luz 24h', 'uni', 'dia',
    ARRAY[0.122973, 0.043976], ARRAY[0.136171], 0, false);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'Plan Fijo Luz 24h SUPRA', 'uni', 'dia',
    ARRAY[0.122973, 0.043976], ARRAY[0.149171], 0, false);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'PFL ONE 24h', 'uni', 'dia',
    ARRAY[0.116318, 0.044521], ARRAY[0.115099], 0, false);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'Plan Fijo Trihorario', 'tri', 'dia',
    ARRAY[0.120853, 0.0439], ARRAY[0.201461, 0.132213, 0.097634], 0, false);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'PFL Trihorario ONE', 'tri', 'dia',
    ARRAY[0.116318, 0.044521], ARRAY[0.1705, 0.116499, 0.0819], 0, false);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20', 'Plan Fijo SUPRA Trihorario', 'tri', 'dia',
    ARRAY[0.120853, 0.0439], ARRAY[0.214461, 0.145213, 0.110634], 0, false);

-- ─── Pyme ONE 2.0TD (requires_auth = true) ────────────────────
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20one', 'Plan Fijo Luz 24h One', 'uni', 'dia',
    ARRAY[0.122973, 0.043976], ARRAY[0.120671], 0, true);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20one', 'PFL ONE 24h', 'uni', 'dia',
    ARRAY[0.116318, 0.044521], ARRAY[0.115099], 0, true);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20one', 'Plan Fijo Luz One (trihoraria)', 'tri', 'dia',
    ARRAY[0.122973, 0.043976], ARRAY[0.190964, 0.117811, 0.082473], 0, true);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme20one', 'PFL Trihorario ONE', 'tri', 'dia',
    ARRAY[0.116318, 0.044521], ARRAY[0.1705, 0.116499, 0.0819], 0, true);

-- ─── Pyme 3.0/6.1TD ───────────────────────────────────────────
INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme361', 'Plan Fijo Luz BASIC 3.0', 'hex', 'dia',
    ARRAY[0.055959, 0.030187, 0.013779, 0.012187, 0.008479, 0.005817],
    ARRAY[0.190851, 0.165002, 0.142965, 0.130256, 0.123688, 0.11613], 0, false);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme361', 'Plan Fijo Luz ONE 3.0', 'hex', 'dia',
    ARRAY[0.055959, 0.030187, 0.013779, 0.012187, 0.008479, 0.005817],
    ARRAY[0.185351, 0.159502, 0.137465, 0.124756, 0.118188, 0.11063], 0, false);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme361', 'Plan Fijo Luz BASIC 6.1', 'hex', 'dia',
    ARRAY[0.078882, 0.041309, 0.01797, 0.01417, 0.005295, 0.00251],
    ARRAY[0.166016, 0.144923, 0.130155, 0.121017, 0.114657, 0.108359], 0, false);

INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth) VALUES
('pyme361', 'Plan Fijo Luz ONE 6.1', 'hex', 'dia',
    ARRAY[0.078882, 0.041309, 0.01797, 0.01417, 0.005295, 0.00251],
    ARRAY[0.160516, 0.139423, 0.124655, 0.115517, 0.109157, 0.102859], 0, false);

-- ── 8. RESTAURAR PERFILES DE USUARIOS EXISTENTES EN AUTH ──────
-- Recrea el perfil de cualquier usuario que ya existía en auth.users
-- (el trigger solo actúa en registros nuevos, no en los ya existentes)
INSERT INTO profiles (id, email, is_admin, is_approved)
SELECT id, email, false, false
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── 9. ESTABLECER ADMIN ───────────────────────────────────────
UPDATE profiles
SET is_admin = true, is_approved = true
WHERE email = 'salvamunoz@avantiasl.com';

-- ── 10. VERIFICACIÓN FINAL ────────────────────────────────────
SELECT 'segmentos'  AS tabla, count(*)::text AS total FROM segments
UNION ALL
SELECT 'tarifas',   count(*)::text FROM tariffs
UNION ALL
SELECT 'perfiles',  count(*)::text FROM profiles
UNION ALL
SELECT 'admin ok',  count(*)::text FROM profiles WHERE is_admin = true;
