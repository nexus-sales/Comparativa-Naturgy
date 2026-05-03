-- ============================================================
-- MIGRACIÓN: Correcciones auditoría de seguridad y calidad
-- Ejecutar en Supabase SQL Editor sobre la BD existente
-- ============================================================

-- 1. FIX CRÍTICO: RLS profiles — eliminar política que expone todos los perfiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Política correcta: cada usuario solo ve su propio perfil
-- (Los admins ya tienen acceso total vía "Admins can update any profile" FOR ALL)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Renombrar la política FOR ALL de admins para claridad (opcional, no rompe nada)
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL TO authenticated
  USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

-- 2. Añadir columna requires_auth si no existe
ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS requires_auth BOOLEAN DEFAULT FALSE;

-- 3. Añadir CHECK constraint para validar tipo de tarifa
ALTER TABLE tariffs ADD CONSTRAINT IF NOT EXISTS chk_type
  CHECK (type IN ('uni', 'tri', 'hex'));

-- 4. Añadir CHECK constraint para longitud de r_en según tipo
ALTER TABLE tariffs ADD CONSTRAINT IF NOT EXISTS chk_ren_len CHECK (
    (type = 'uni' AND array_length(r_en, 1) = 1) OR
    (type = 'tri' AND array_length(r_en, 1) = 3) OR
    (type = 'hex' AND array_length(r_en, 1) = 6)
);

-- 5. Añadir CHECK constraint para longitud de r_pot según tipo
--    uni/tri usan 2 períodos de potencia (P1+P2), hex usa 6
ALTER TABLE tariffs ADD CONSTRAINT IF NOT EXISTS chk_rpot_len CHECK (
    (type IN ('uni', 'tri') AND array_length(r_pot, 1) = 2) OR
    (type = 'hex' AND array_length(r_pot, 1) = 6)
);

-- Verificación
SELECT 'RLS profiles' AS check, count(*) AS policies
  FROM pg_policies WHERE tablename = 'profiles'
UNION ALL
SELECT 'tariffs constraints', count(*)
  FROM information_schema.check_constraints
  WHERE constraint_name IN ('chk_type', 'chk_ren_len', 'chk_rpot_len');
