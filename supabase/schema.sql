-- Habilitar extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de perfiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    is_admin BOOLEAN DEFAULT FALSE,
    email TEXT,
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
    type TEXT NOT NULL,
    pot_unit TEXT NOT NULL,
    r_pot NUMERIC[] NOT NULL,
    r_en NUMERIC[] NOT NULL,
    sva NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;

-- Políticas para Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON profiles FOR ALL TO authenticated 
USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

-- Políticas para Segments (Solo si está aprobado)
CREATE POLICY "Segments are viewable by approved users" ON segments FOR SELECT TO authenticated 
USING ( (SELECT is_approved FROM profiles WHERE id = auth.uid()) = true OR (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

-- Políticas para Tariffs (Solo si está aprobado)
CREATE POLICY "Tariffs are viewable by approved users" ON tariffs FOR SELECT TO authenticated 
USING ( (SELECT is_approved FROM profiles WHERE id = auth.uid()) = true OR (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

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