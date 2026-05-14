ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- Actualizar el trigger por si acaso no se actualizó bien
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, is_approved)
  VALUES (new.id, new.email, false, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;