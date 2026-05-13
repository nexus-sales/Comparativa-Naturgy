-- 1. Añadimos la columna booleana para marcado lógico
ALTER TABLE client_comparisons 
ADD COLUMN IF NOT EXISTS deleted_by_user BOOLEAN DEFAULT FALSE;

-- 2. Modificamos las políticas de RLS para que el usuario solo vea las NO borradas,
-- pero el admin pueda verlo TODO (incluidas las que el usuario marcó como borradas).

-- Primero eliminamos las políticas actuales para recrearlas
DROP POLICY IF EXISTS "Users can only view their own comparisons" ON client_comparisons;
DROP POLICY IF EXISTS "Users can only manage their own comparisons" ON client_comparisons;
DROP POLICY IF EXISTS "Admins can view all comparisons" ON client_comparisons;

-- POLÍTICA DE SELECCIÓN (SELECT)
-- El usuario normal solo ve las suyas que no estén marcadas como borradas.
-- El admin ve absolutamente todas.
CREATE POLICY "client_comparisons_select_policy" ON client_comparisons
FOR SELECT TO authenticated
USING (
    (auth.uid() = user_id AND deleted_by_user = FALSE AND public.is_user_approved())
    OR 
    (public.is_user_admin())
);

-- POLÍTICA DE ACTUALIZACIÓN (UPDATE)
-- El usuario solo puede actualizar las suyas (para marcarlas como borradas).
-- El admin puede gestionar todas.
CREATE POLICY "client_comparisons_update_policy" ON client_comparisons
FOR UPDATE TO authenticated
USING (
    (auth.uid() = user_id AND public.is_user_approved())
    OR 
    (public.is_user_admin())
);

-- POLÍTICA DE INSERCIÓN (INSERT)
-- El usuario puede insertar sus propias comparativas.
CREATE POLICY "client_comparisons_insert_policy" ON client_comparisons
FOR INSERT TO authenticated
WITH CHECK (
    (auth.uid() = user_id AND public.is_user_approved())
    OR 
    (public.is_user_admin())
);

-- POLÍTICA DE BORRADO (DELETE)
-- Solo el admin puede borrar físicamente de la base de datos.
CREATE POLICY "client_comparisons_delete_policy" ON client_comparisons
FOR DELETE TO authenticated
USING (public.is_user_admin());
