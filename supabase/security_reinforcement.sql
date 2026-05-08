-- ============================================================
-- SEGURIDAD AVANZADA: Refuerzo de políticas RLS y Seguridad
-- ============================================================

-- 1. Reparar la función handle_new_user para evitar escalada de privilegios
-- Aseguramos que los nuevos usuarios siempre sean creados con is_admin = false y is_approved = false
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, is_approved)
  VALUES (new.id, new.email, false, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Reforzar permisos en la tabla profiles
-- Los usuarios no deberían poder cambiar su propio estatus de admin o aprobado
-- Eliminamos políticas genéricas que podrían ser abusadas
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Nueva política: solo el email puede ser actualizado por el usuario (si es necesario)
CREATE POLICY "Users can update own basic info" ON profiles 
FOR UPDATE TO authenticated 
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id 
    AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid()) -- No permite cambiar is_admin
    AND is_approved = (SELECT is_approved FROM profiles WHERE id = auth.uid()) -- No permite cambiar is_approved
);

-- 3. Endurecer acceso a Segments y Tariffs
-- Revertimos el acceso público total permitido en migration_public_access.sql
-- Solo permitimos lectura a usuarios autenticados que estén aprobados o sean admins.
DROP POLICY IF EXISTS "Anyone can read segments" ON segments;
DROP POLICY IF EXISTS "Anyone can read tariffs" ON tariffs;

CREATE POLICY "Approved users can read segments" ON segments 
FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND (is_approved = true OR is_admin = true)
    )
);

CREATE POLICY "Approved users can read tariffs" ON tariffs 
FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND (is_approved = true OR is_admin = true)
    )
);

-- 4. Protección contra borrado accidental
-- Solo admins pueden realizar DELETE en tablas críticas
CREATE POLICY "Admins can delete segments" ON segments FOR DELETE TO authenticated USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
);

CREATE POLICY "Admins can delete tariffs" ON tariffs FOR DELETE TO authenticated USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
);

-- 5. Logging básico/Auditoría (Opcional pero recomendado)
-- Podrías crear una tabla de auditoría para cambios en tarifas
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT,
    record_id TEXT,
    action TEXT,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_data JSONB,
    new_data JSONB
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT TO authenticated USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
);

-- 6. Configuración de desarrollo: Auto-confirmación de perfiles (Opcional)
-- Si estás en el plan gratuito y tienes problemas con el límite de emails,
-- puedes usar este trigger para auto-aprobar usuarios conocidos o todos en desarrollo.
/*
UPDATE profiles SET is_approved = true WHERE email LIKE '%@tu-dominio.com';
*/
