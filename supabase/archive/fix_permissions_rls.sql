-- ============================================================
-- REFUERZO DE PERMISOS RLS: COLABORADORES Y ADMINS
-- ============================================================

-- Aseguramos que las tablas tengan RLS habilitado
ALTER TABLE IF EXISTS user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS client_comparisons ENABLE ROW LEVEL SECURITY;

-- 1. EXTENSIÓN DE LA FUNCIÓN DE ACCESO
-- Ahora permitimos el acceso a cualquier usuario autenticado que NO esté bloqueado.
-- No restringimos por 'is_approved' aquí para permitir el guardado inicial, 
-- pero las políticas de visualización pueden ser más estrictas si se desea.

CREATE OR REPLACE FUNCTION public.check_user_active()
RETURNS BOOLEAN AS $$
DECLARE
    is_blocked_status BOOLEAN;
BEGIN
    SELECT is_blocked INTO is_blocked_status FROM profiles WHERE id = auth.uid();
    -- Si no existe perfil o no está bloqueado, permitimos paso básico
    IF is_blocked_status IS NULL OR is_blocked_status = FALSE THEN
        RETURN TRUE;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. POLÍTICAS PARA client_comparisons (Las ofertas/comparativas)

DROP POLICY IF EXISTS "Users can only view their own comparisons" ON client_comparisons;
DROP POLICY IF EXISTS "Users can only manage their own comparisons" ON client_comparisons;
DROP POLICY IF EXISTS "Admins can view all comparisons" ON client_comparisons;

-- Los colaboradores (y cualquier user activo) pueden INSERTAR sus propias comparativas
CREATE POLICY "Users can insert their own comparisons" ON client_comparisons
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.check_user_active());

-- Los usuarios ven SOLO sus propias comparativas
CREATE POLICY "Users can view their own comparisons" ON client_comparisons
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.check_user_active());

-- Los ADMINS pueden ver TODAS las comparativas de todos los usuarios
CREATE POLICY "Admins can view all comparisons" ON client_comparisons
FOR SELECT TO authenticated
USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );


-- 3. POLÍTICAS PARA user_activity (El log de auditoría)

DROP POLICY IF EXISTS "Users can only view their own activity" ON user_activity;
DROP POLICY IF EXISTS "Users can only insert their own activity" ON user_activity;
DROP POLICY IF EXISTS "Admins can view all activity" ON user_activity;

CREATE POLICY "Users can insert their own activity" ON user_activity
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.check_user_active());

CREATE POLICY "Users can view their own activity" ON user_activity
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.check_user_active());

CREATE POLICY "Admins can view all activity" ON user_activity
FOR SELECT TO authenticated
USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

-- 4. PERMISOS EN LA TABLA PROFILES
-- Asegurar que los usuarios puedan actualizar su propio perfil (necesario para el primer registro)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Asegurar que puedan leer su propio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- Registro de auditoría para la ejecución
COMMENT ON TABLE client_comparisons IS 'Tabla de ofertas. Admins ven todo, colaboradores solo lo suyo.';
