-- ============================================================
-- SEGURIDAD AVANZADA Y CUMPLIMIENTO RGPD (GDPR)
-- ============================================================

-- 1. Ampliación de perfiles con estados de seguridad y datos personales protegidos
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP WITH TIME ZONE;

-- 2. Tabla de Historial de Actividad Individual (Activity Log)
-- Cumple con el principio de trazabilidad del RGPD
CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL, -- e.g., 'CALCULATION_CREATED', 'PDF_EXPORTED'
    details JSONB, -- Detalles técnicos no sensibles
    ip_address TEXT, -- Solo si es estrictamente necesario para seguridad
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS en historial
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- 3. Tabla de Consultas/Cargas de Clientes (Datos Sensibles)
-- Aquí es donde se guarda la actividad real (dirección, email cliente, etc.)
CREATE TABLE IF NOT EXISTS client_comparisons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    client_name TEXT,
    client_email TEXT,
    client_address TEXT,
    calculation_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS en datos sensibles
ALTER TABLE client_comparisons ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS ESTRICTAS (MÁXIMA PRIVACIDAD)
-- ============================================================

-- Bloqueo de acceso si el usuario está marcado como is_blocked
-- Modificamos la función de verificación de admin para incluir chequeo de bloqueo
CREATE OR REPLACE FUNCTION public.check_user_access()
RETURNS BOOLEAN AS $$
DECLARE
    is_blocked_status BOOLEAN;
BEGIN
    SELECT is_blocked INTO is_blocked_status FROM profiles WHERE id = auth.uid();
    IF is_blocked_status = TRUE THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El usuario SOLO ve su propia actividad
CREATE POLICY "Users can only view their own activity" ON user_activity
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.check_user_access());

CREATE POLICY "Users can only insert their own activity" ON user_activity
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.check_user_access());

-- El usuario SOLO ve sus propias comparativas (Maximiza GDPR)
CREATE POLICY "Users can only view their own comparisons" ON client_comparisons
FOR SELECT TO authenticated
USING (auth.uid() = user_id AND public.check_user_access());

CREATE POLICY "Users can only manage their own comparisons" ON client_comparisons
FOR ALL TO authenticated
USING (auth.uid() = user_id AND public.check_user_access());

-- ADMIN: El admin puede verlo TODO
CREATE POLICY "Admins can view all activity" ON user_activity
FOR SELECT TO authenticated
USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

CREATE POLICY "Admins can view all comparisons" ON client_comparisons
FOR SELECT TO authenticated
USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

-- ADMIN: Solo el admin puede bloquear
CREATE POLICY "Admins can update profiles for moderation" ON profiles
FOR UPDATE TO authenticated
USING ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true )
WITH CHECK ( (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true );

-- 4. Trigger para registrar logins (Auditoría RGPD)
CREATE OR REPLACE FUNCTION public.log_user_login()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles 
  SET last_login_at = NOW()
  WHERE id = new.id;
  
  INSERT INTO public.user_activity (user_id, action)
  VALUES (new.id, 'USER_LOGIN');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
