-- ============================================================
-- NATURGY COMPARATIVA — SCHEMA DEFINITIVO v2
-- Fecha: 2026-05-14
-- ============================================================
-- PRERREQUISITO: Ejecutar PASO_1_backup_antes_de_reset.sql
-- y guardar los resultados ANTES de ejecutar este script.
-- ============================================================
-- Este script:
--   1. Conserva la tabla profiles y sus datos (usuarios, roles)
--   2. Elimina y recrea el resto de tablas limpias
--   3. Configura RLS sin conflictos ni funciones inexistentes
--   4. Usa is_user_admin() de forma consistente (sin is_admin())
-- ============================================================


-- ============================================================
-- SECCIÓN 1: LIMPIEZA DE TABLAS (conservando profiles)
-- ============================================================

DROP TABLE IF EXISTS audit_logs          CASCADE;
DROP TABLE IF EXISTS user_activity       CASCADE;
DROP TABLE IF EXISTS client_comparisons  CASCADE;
DROP TABLE IF EXISTS tariffs             CASCADE;
DROP TABLE IF EXISTS segments            CASCADE;

-- Limpiar funciones (serán recreadas correctamente)
DROP FUNCTION IF EXISTS public.is_user_admin()    CASCADE;
DROP FUNCTION IF EXISTS public.is_user_approved() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin()         CASCADE;
DROP FUNCTION IF EXISTS public.check_user_access() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user()  CASCADE;
DROP FUNCTION IF EXISTS public.log_user_login()   CASCADE;
DROP FUNCTION IF EXISTS public.update_timestamp() CASCADE;

-- Limpiar políticas de profiles (serán recreadas limpias)
DROP POLICY IF EXISTS "Users can view own profile"               ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile"       ON profiles;
DROP POLICY IF EXISTS "Users can update own basic info"          ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles"           ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"             ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles for moderation" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"                      ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"                      ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all"                       ON profiles;


-- ============================================================
-- SECCIÓN 2: FUNCIONES HELPER
-- Deben existir antes de crear políticas que las usan
-- ============================================================

-- Verifica si el usuario actual es admin (SECURITY DEFINER evita recursión RLS)
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Verifica si el usuario actual está aprobado
CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT is_approved FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Actualiza updated_at automáticamente en UPDATE
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea perfil automáticamente al registrarse un usuario en auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, is_approved)
  VALUES (new.id, new.email, false, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear trigger de nuevo usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ============================================================
-- SECCIÓN 3: TABLA PROFILES
-- No se borra. Solo se asegura la estructura y se limpian las
-- políticas antiguas para recrearlas sin conflictos.
-- ============================================================

-- Asegurar columnas que pueden no haber sido añadidas en migraciones anteriores
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS full_name         TEXT,
  ADD COLUMN IF NOT EXISTS phone             TEXT,
  ADD COLUMN IF NOT EXISTS is_blocked        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blocked_reason    TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at     TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Usuario ve y edita solo su propio perfil (no puede cambiar is_admin ni is_approved)
CREATE POLICY "profiles_select_own" ON profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_admin    = (SELECT is_admin    FROM profiles WHERE id = auth.uid())
  AND is_approved = (SELECT is_approved FROM profiles WHERE id = auth.uid())
);

-- Admin puede hacer cualquier cosa en profiles
CREATE POLICY "profiles_admin_all" ON profiles
FOR ALL TO authenticated
USING (public.is_user_admin())
WITH CHECK (public.is_user_admin());


-- ============================================================
-- SECCIÓN 4: TABLA SEGMENTS
-- ============================================================

CREATE TABLE segments (
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

ALTER TABLE segments ENABLE ROW LEVEL SECURITY;

-- Lectura: admin o usuario aprobado
CREATE POLICY "segments_read" ON segments
FOR SELECT TO authenticated
USING (public.is_user_admin() OR public.is_user_approved());

-- Escritura: solo admin (INSERT, UPDATE, DELETE)
CREATE POLICY "segments_write_admin" ON segments
FOR ALL TO authenticated
USING (public.is_user_admin())
WITH CHECK (public.is_user_admin());

-- Datos semilla de segmentos con valores fiscales correctos para Canarias
INSERT INTO segments (id, label, tax_model, pot_p, bono_rate, excedente_rate, tax_imp_elec, tax_igic, tax_igic_red, tax_igic_7) VALUES
  ('res',       'Residencial',    'res',  2, 0.019121, 0.06, 5.1127, 7, 0, 0),
  ('pyme20',    'Pyme 2.0TD',     'pyme', 2, 0.019121, 0.06, 5.1127, 0, 3, 7),
  ('pyme20one', 'Pyme ONE 2.0TD', 'pyme', 2, 0.019121, 0.06, 5.1127, 0, 3, 7),
  ('pyme361',   'Pyme 3.0/6.1TD', 'pyme', 6, 0.019121, 0.06, 5.1127, 0, 3, 7);


-- ============================================================
-- SECCIÓN 5: TABLA TARIFFS
-- ============================================================

CREATE TABLE tariffs (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id    TEXT    NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  type          TEXT    NOT NULL CHECK (type IN ('uni', 'tri', 'hex')),
  pot_unit      TEXT    NOT NULL CHECK (pot_unit IN ('dia', 'anio')),
  r_pot         NUMERIC[] NOT NULL,
  r_en          NUMERIC[] NOT NULL,
  sva           NUMERIC DEFAULT 0,
  requires_auth BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_ren_len CHECK (
    (type = 'uni' AND array_length(r_en,  1) = 1) OR
    (type = 'tri' AND array_length(r_en,  1) = 3) OR
    (type = 'hex' AND array_length(r_en,  1) = 6)
  ),
  CONSTRAINT chk_rpot_len CHECK (
    (type IN ('uni','tri') AND array_length(r_pot, 1) = 2) OR
    (type = 'hex'          AND array_length(r_pot, 1) = 6)
  )
);

ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;

-- Lectura: admin o usuario aprobado
CREATE POLICY "tariffs_read" ON tariffs
FOR SELECT TO authenticated
USING (public.is_user_admin() OR public.is_user_approved());

-- Escritura completa (INSERT + UPDATE + DELETE): solo admin
CREATE POLICY "tariffs_write_admin" ON tariffs
FOR ALL TO authenticated
USING (public.is_user_admin())
WITH CHECK (public.is_user_admin());

-- Trigger para updated_at
CREATE TRIGGER tariffs_updated_at
  BEFORE UPDATE ON tariffs
  FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();


-- ============================================================
-- SECCIÓN 6: TABLA CLIENT_COMPARISONS
-- FK hacia profiles.id (necesario para el JOIN en Supabase API)
-- ============================================================

CREATE TABLE client_comparisons (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_name      TEXT,
  client_email     TEXT,
  client_address   TEXT,
  target_tariff    TEXT,
  target_segment   TEXT,
  calculation_data JSONB   NOT NULL DEFAULT '{}',
  deleted_by_user  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE client_comparisons ENABLE ROW LEVEL SECURITY;

-- SELECT: usuario ve las suyas no marcadas como borradas; admin ve todas
CREATE POLICY "comparisons_select" ON client_comparisons
FOR SELECT TO authenticated
USING (
  (auth.uid() = user_id AND deleted_by_user = FALSE)
  OR public.is_user_admin()
);

-- INSERT: usuario inserta solo las suyas
CREATE POLICY "comparisons_insert" ON client_comparisons
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_user_admin());

-- UPDATE: usuario puede marcar como borrada; admin puede modificar cualquiera
CREATE POLICY "comparisons_update" ON client_comparisons
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_user_admin());

-- DELETE físico: solo admin
CREATE POLICY "comparisons_delete" ON client_comparisons
FOR DELETE TO authenticated
USING (public.is_user_admin());


-- ============================================================
-- SECCIÓN 7: TABLA USER_ACTIVITY (log de auditoría)
-- ============================================================

CREATE TABLE user_activity (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  details    JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_read_own" ON user_activity
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "activity_insert_own" ON user_activity
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activity_admin_all" ON user_activity
FOR ALL TO authenticated
USING (public.is_user_admin());


-- ============================================================
-- VERIFICACIÓN FINAL
-- Ejecutar estas queries para confirmar que todo está correcto
-- ============================================================

/*
-- Ver todas las políticas activas
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('profiles','segments','tariffs','client_comparisons','user_activity')
ORDER BY tablename, cmd;

-- Ver funciones creadas
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('is_user_admin','is_user_approved','handle_new_user','update_timestamp')
AND pronamespace = 'public'::regnamespace;

-- Ver columnas de cada tabla
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('segments','tariffs','client_comparisons')
ORDER BY table_name, ordinal_position;
*/
