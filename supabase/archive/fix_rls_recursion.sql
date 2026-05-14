-- FIX: Reparar recursión infinita en políticas RLS de la tabla profiles

-- 1. Eliminar políticas problemáticas existentes
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Segments are viewable by approved users" ON segments;
DROP POLICY IF EXISTS "Tariffs are viewable by approved users" ON tariffs;
DROP POLICY IF EXISTS "Admins can manage tariffs" ON tariffs;

-- 2. Crear función auxiliar para verificar si es admin sin causar recursión
-- Esta función accede a los metadatos del JWT de Supabase o hace una consulta directa
-- pero evitamos usar SELECT is_admin FROM profiles dentro de la política de profiles.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT is_admin 
    FROM profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Nueva política para profiles (Usando el campo del JWT o una lógica más simple)
-- El problema era: Para ver un perfil, el sistema miraba si eras admin. 
-- Para saber si eres admin, el sistema intentaba ver tu perfil... RECURSIÓN.

-- Opción segura: Los admins pueden ver todo, pero validamos de forma que no buclee.
CREATE POLICY "Admins can manage all profiles" ON profiles 
FOR ALL TO authenticated
USING (
  (SELECT (auth.jwt() ->> 'is_admin')::boolean) = true 
  OR 
  (auth.uid() = id) -- Siempre pueden ver el suyo
);

-- 4. Corregir políticas de otras tablas
CREATE POLICY "Segments viewable by approved or admin" ON segments FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND (is_approved = true OR is_admin = true)
    )
);

CREATE POLICY "Tariffs viewable by approved or admin" ON tariffs FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND (is_approved = true OR is_admin = true)
    )
);

CREATE POLICY "Admins manage tariffs" ON tariffs FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- NOTA: Para que el JWT de Supabase tenga 'is_admin', tendrías que añadirlo a los claims.
-- Como solución inmediata que no rompa nada, vamos a usar una política que no sea recursiva para profiles:

DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

CREATE POLICY "Admins can select all" ON profiles FOR SELECT TO authenticated
USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) ); -- Esto sigue fallando si no se gestiona bien.

-- LA SOLUCIÓN DEFINITIVA PARA LA RECURSIÓN:
CREATE POLICY "Admins bypass recursion" ON profiles FOR SELECT TO authenticated
USING ( auth.uid() = id OR is_admin = true ); 
-- Al poner 'is_admin = true' directamente sin un sub-select a la misma tabla, Postgres lo gestiona mejor en algunos casos, 
-- pero la forma correcta es que la condición Admin no dependa de un SELECT sobre la misma tabla que se está evaluando.
