-- ============================================================
-- FIX: VINCULACIÓN DE TABLAS PARA EL HISTORIAL (FOREIGN KEY)
-- ============================================================

-- El error PGRST200 indica que PostgREST no encuentra la relación 
-- entre client_comparisons y profiles porque falta la Foreign Key explícita 
-- o el índice necesario para que la API de Supabase la reconozca.

-- 1. Aseguramos que la columna user_id existe y es del tipo correcto
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_comparisons' AND column_name='user_id') THEN
        ALTER TABLE client_comparisons ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Creamos la Foreign Key explícita hacia la tabla profiles (que es la que consultamos)
-- Primero eliminamos si existe para evitar duplicados con nombres distintos
ALTER TABLE client_comparisons DROP CONSTRAINT IF EXISTS client_comparisons_user_id_fkey;

ALTER TABLE client_comparisons 
ADD CONSTRAINT client_comparisons_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id) 
ON DELETE SET NULL;

-- 3. Notificar a PostgREST que recargue el esquema (esto se hace automático al alterar tablas,
-- pero asegurar los permisos de lectura en profiles es vital para el JOIN)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Permitir que los usuarios vean los emails de otros (solo email) para el historial global 
-- o al menos que el sistema pueda hacer el join.
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT TO authenticated
USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

-- 4. Re-verificación de permisos en client_comparisons
ALTER TABLE client_comparisons ENABLE ROW LEVEL SECURITY;

COMMENT ON CONSTRAINT client_comparisons_user_id_fkey ON client_comparisons IS 'Relación para mostrar el email del comercial en el historial';
