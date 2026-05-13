-- Reparacion de perfiles de usuario.
-- Ejecutar en Supabase SQL Editor si los datos de "Mi Perfil" no se guardan
-- o si los usuarios autenticados no aparecen en public.profiles.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  is_admin BOOLEAN DEFAULT FALSE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  is_approved BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT is_approved FROM public.profiles WHERE id = auth.uid()), false);
$$;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  AND COALESCE(is_admin, false) = false
  AND COALESCE(is_approved, false) = false
);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND COALESCE(is_admin, false) = public.is_user_admin()
  AND COALESCE(is_approved, false) = public.is_user_approved()
);

CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_user_admin())
WITH CHECK (public.is_user_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, is_approved)
  VALUES (new.id, new.email, false, false)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO public.profiles (id, email, is_admin, is_approved)
SELECT id, email, false, false
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

-- Cuenta propietaria de la app: debe existir como admin en public.profiles
-- para que las politicas RLS de Supabase permitan ver usuarios/tarifas.
INSERT INTO public.profiles (id, email, is_admin, is_approved)
SELECT id, email, true, true
FROM auth.users
WHERE lower(email) = 'salvamunoz@avantiasl.com'
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  is_admin = true,
  is_approved = true;

-- Reparar lectura/escritura de segmentos y tarifas.
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Segments are viewable by approved users" ON public.segments;
DROP POLICY IF EXISTS "Segments viewable by approved or admin" ON public.segments;
DROP POLICY IF EXISTS "Approved users can read segments" ON public.segments;
DROP POLICY IF EXISTS "Anyone can read segments" ON public.segments;
DROP POLICY IF EXISTS "Admins can update segments" ON public.segments;

CREATE POLICY "Approved users can read segments"
ON public.segments
FOR SELECT
TO authenticated
USING (public.is_user_admin() OR public.is_user_approved());

CREATE POLICY "Admins can update segments"
ON public.segments
FOR UPDATE
TO authenticated
USING (public.is_user_admin())
WITH CHECK (public.is_user_admin());

DROP POLICY IF EXISTS "Tariffs are viewable by approved users" ON public.tariffs;
DROP POLICY IF EXISTS "Tariffs viewable by approved or admin" ON public.tariffs;
DROP POLICY IF EXISTS "Approved users can read tariffs" ON public.tariffs;
DROP POLICY IF EXISTS "Anyone can read tariffs" ON public.tariffs;
DROP POLICY IF EXISTS "Admins can manage tariffs" ON public.tariffs;
DROP POLICY IF EXISTS "Admins manage tariffs" ON public.tariffs;
DROP POLICY IF EXISTS "Admins can delete tariffs" ON public.tariffs;

CREATE POLICY "Approved users can read tariffs"
ON public.tariffs
FOR SELECT
TO authenticated
USING (public.is_user_admin() OR public.is_user_approved());

CREATE POLICY "Admins can manage tariffs"
ON public.tariffs
FOR ALL
TO authenticated
USING (public.is_user_admin())
WITH CHECK (public.is_user_admin());
