-- ============================================================
-- MIGRACIÓN: Correcciones auditoría de seguridad y calidad
-- Ejecutar en Supabase SQL Editor sobre la BD existente
-- ============================================================

-- 1. FIX CRÍTICO: RLS profiles — eliminar política que expone todos los perfiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Política correcta: cada usuario solo ve su propio perfil
-- (Los admins tienen acceso total vía la política FOR ALL de abajo)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Renombrar la política FOR ALL de admins para claridad
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL TO authenticated
  USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

-- 2. FIX BLOQUEANTE: RLS tariffs — faltaban políticas de escritura para admins
--    Sin esto, el panel admin falla al crear/editar/borrar tarifas
CREATE POLICY "Admins can manage tariffs" ON tariffs
  FOR ALL TO authenticated
  USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

-- 3. Trigger para mantener updated_at al día en tariffs
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

-- 4. Añadir columna requires_auth si no existe
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS requires_auth BOOLEAN DEFAULT FALSE;

-- 5. Añadir CHECK constraint para validar tipo de tarifa
DO $$ BEGIN
  ALTER TABLE tariffs ADD CONSTRAINT chk_type CHECK (type IN ('uni', 'tri', 'hex'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Añadir CHECK constraint para longitud de r_en según tipo
DO $$ BEGIN
  ALTER TABLE tariffs ADD CONSTRAINT chk_ren_len CHECK (
    (type = 'uni' AND array_length(r_en, 1) = 1) OR
    (type = 'tri' AND array_length(r_en, 1) = 3) OR
    (type = 'hex' AND array_length(r_en, 1) = 6)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Añadir CHECK constraint para longitud de r_pot según tipo
--    uni/tri usan 2 períodos de potencia (P1+P2), hex usa 6
DO $$ BEGIN
  ALTER TABLE tariffs ADD CONSTRAINT chk_rpot_len CHECK (
    (type IN ('uni', 'tri') AND array_length(r_pot, 1) = 2) OR
    (type = 'hex' AND array_length(r_pot, 1) = 6)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Verificación ──────────────────────────────────────────────
SELECT 'RLS profiles' AS "check", count(*)::text AS result
  FROM pg_policies WHERE tablename = 'profiles'
UNION ALL
SELECT 'RLS tariffs', count(*)::text
  FROM pg_policies WHERE tablename = 'tariffs'
UNION ALL
SELECT 'tariffs constraints', count(*)::text
  FROM information_schema.check_constraints
  WHERE constraint_name IN ('chk_type', 'chk_ren_len', 'chk_rpot_len')
UNION ALL
SELECT 'updated_at trigger', count(*)::text
  FROM information_schema.triggers
  WHERE trigger_name = 'tariffs_updated_at';
