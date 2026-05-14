-- ============================================================
-- MIGRACIÓN: Acceso público a tarifas (sin login para colaboradores)
-- Ejecutar en: Supabase → SQL Editor
-- No borra datos — solo actualiza políticas RLS
-- ============================================================

-- Eliminar políticas restrictivas de lectura
DROP POLICY IF EXISTS "Segments viewable by approved" ON segments;
DROP POLICY IF EXISTS "Tariffs viewable by approved"  ON tariffs;

-- Lectura pública: cualquier visitante puede ver segmentos y tarifas
CREATE POLICY "Anyone can read segments" ON segments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can read tariffs"  ON tariffs  FOR SELECT TO anon, authenticated USING (true);

-- (Opcional) Marcar todos los usuarios existentes como aprobados por coherencia
UPDATE profiles SET is_approved = true WHERE is_approved = false;
