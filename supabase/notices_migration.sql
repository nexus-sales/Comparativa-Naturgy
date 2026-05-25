-- ============================================================
-- MIGRATION: Tabla notices (Avisos y Novedades)
-- Fecha: 2026-05-25
-- No destructivo — solo añade tabla nueva.
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor).
-- ============================================================

CREATE TABLE IF NOT EXISTS notices (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  type           TEXT    NOT NULL CHECK (type IN ('tarifa', 'servicio', 'noticia')),
  title          TEXT    NOT NULL,
  body           TEXT    NOT NULL DEFAULT '',
  effective_date DATE,
  expires_at     DATE,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- SELECT: admin ve todo (activos e inactivos); usuario aprobado ve solo activos
CREATE POLICY "notices_read" ON notices
FOR SELECT TO authenticated
USING (
  public.is_user_admin()
  OR (is_active = TRUE AND public.is_user_approved())
);

-- Escritura: solo admin
CREATE POLICY "notices_write_admin" ON notices
FOR ALL TO authenticated
USING (public.is_user_admin())
WITH CHECK (public.is_user_admin());

-- Trigger updated_at automático
CREATE TRIGGER notices_updated_at
  BEFORE UPDATE ON notices
  FOR EACH ROW EXECUTE PROCEDURE public.update_timestamp();


-- ============================================================
-- VERIFICACIÓN
-- SELECT * FROM notices LIMIT 10;
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'notices';
-- ============================================================
