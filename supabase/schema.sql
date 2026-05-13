-- Habilitar extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de perfiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    is_admin BOOLEAN DEFAULT FALSE,
    email TEXT,
    full_name TEXT,
    phone TEXT,
    is_approved BOOLEAN DEFAULT FALSE -- Campo para que el admin apruebe el acceso
);

-- 2. Tabla de Segmentos
CREATE TABLE IF NOT EXISTS segments (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    tax_model TEXT NOT NULL,
    pot_p INTEGER NOT NULL DEFAULT 2
);

-- 3. Tabla de Tarifas
CREATE TABLE IF NOT EXISTS tariffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    segment_id TEXT REFERENCES segments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('uni', 'tri', 'hex')),
    pot_unit TEXT NOT NULL,
    r_pot NUMERIC[] NOT NULL,
    r_en NUMERIC[] NOT NULL,
    sva NUMERIC DEFAULT 0,
    requires_auth BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_ren_len CHECK (
        (type = 'uni' AND array_length(r_en, 1) = 1) OR
        (type = 'tri' AND array_length(r_en, 1) = 3) OR
        (type = 'hex' AND array_length(r_en, 1) = 6)
    ),
    CONSTRAINT chk_rpot_len CHECK (
        (type IN ('uni', 'tri') AND array_length(r_pot, 1) = 2) OR
        (type = 'hex' AND array_length(r_pot, 1) = 6)
    )
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;

-- Funciones helper con SECURITY DEFINER para evitar recursión en RLS
-- (bypasean RLS al consultar profiles, rompiendo el bucle infinito)
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT is_approved FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- Políticas para Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL TO authenticated
USING ( public.is_user_admin() );

-- Políticas para Segments (Solo si está aprobado)
CREATE POLICY "Segments are viewable by approved users" ON segments FOR SELECT TO authenticated
USING ( public.is_user_admin() OR public.is_user_approved() );

-- Políticas para Tariffs (Solo si está aprobado)
CREATE POLICY "Tariffs are viewable by approved users" ON tariffs FOR SELECT TO authenticated
USING ( public.is_user_admin() OR public.is_user_approved() );

-- Solo admins pueden crear, modificar o borrar tarifas
CREATE POLICY "Admins can manage tariffs" ON tariffs FOR ALL TO authenticated
USING ( public.is_user_admin() );

-- Trigger para mantener updated_at al día
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tariffs_updated_at
  BEFORE UPDATE ON tariffs
  FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- Trigger para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, is_approved)
  VALUES (new.id, new.email, false, false); -- Por defecto no es admin ni está aprobado
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Datos iniciales
INSERT INTO segments (id, label, tax_model, pot_p) VALUES
('res', 'Residencial', 'res', 2),
('pyme20', 'Pyme 2.0TD', 'pyme', 2),
('pyme20one', 'Pyme ONE 2.0TD', 'pyme', 2),
('pyme361', 'Pyme 3.0/6.1TD', 'pyme', 6)
ON CONFLICT (id) DO NOTHING;