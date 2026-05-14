-- ============================================================
-- SOLUCIÓN DEFINITIVA AL ERROR DE RECURSIÓN INFINITA (V2)
-- ============================================================

-- 1. Limpieza total de políticas previas que causan el bucle
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all comparisons" ON client_comparisons;
DROP POLICY IF EXISTS "Users can view their own comparisons" ON client_comparisons;
DROP POLICY IF EXISTS "Admins can view all activity" ON user_activity;
DROP POLICY IF EXISTS "Users can view their own activity" ON user_activity;

-- 2. Función con SECURITY DEFINER para romper la recursión
-- Esta función se ejecuta con privilegios de sistema, saltándose el RLS
-- y permitiendo comprobar si el usuario es admin sin disparar el bucle.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Aplicar nuevas políticas usando la función
-- Tabla PROFILES
CREATE POLICY "Profiles access policy" ON profiles
FOR SELECT TO authenticated
USING ( id = auth.uid() OR public.is_admin() );

-- Tabla CLIENT_COMPARISONS
CREATE POLICY "Comparisons access policy" ON client_comparisons
FOR SELECT TO authenticated
USING ( user_id = auth.uid() OR public.is_admin() );

-- Tabla USER_ACTIVITY
CREATE POLICY "Activity access policy" ON user_activity
FOR SELECT TO authenticated
USING ( user_id = auth.uid() OR public.is_admin() );

-- 4. Asegurar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

COMMENT ON FUNCTION public.is_admin IS 'Rompe la recursión infinita permitiendo verificar el rol de Admin de forma aislada.';
