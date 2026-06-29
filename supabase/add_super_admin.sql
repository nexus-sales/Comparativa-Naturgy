-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add super-administrator role
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Helper function (SECURITY DEFINER so it reads the actual DB row, not the
--    RLS-filtered view of the calling user).
CREATE OR REPLACE FUNCTION public.is_user_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_super_admin = TRUE
      AND (is_blocked IS NULL OR is_blocked = FALSE)
  );
END;
$$;

-- 3. Update the privilege-overwrite trigger so that:
--    · super admins can modify any profile
--    · regular admins CANNOT modify super-admin profiles
--    · non-admins are still blocked from changing privilege fields
DROP TRIGGER IF EXISTS prevent_profile_privilege_overwrite ON public.profiles;

CREATE OR REPLACE FUNCTION public.prevent_privilege_overwrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Superusuario de Postgres (Table Editor, migraciones): sin restricción.
  -- auth.uid() devuelve NULL fuera de una sesión autenticada, por lo que el
  -- trigger trataría al DBA como un usuario sin privilegios. Este bypass lo evita.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Super admin: unrestricted
  IF public.is_user_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Regular admin: cannot touch super-admin profiles
  IF public.is_user_admin() THEN
    IF COALESCE(OLD.is_super_admin, FALSE) THEN
      RAISE EXCEPTION 'Solo el super administrador puede modificar a otro super administrador.';
    END IF;
    RETURN NEW;
  END IF;

  -- Non-admin: block any attempt to elevate privileges
  IF (NEW.is_admin      IS DISTINCT FROM OLD.is_admin)      OR
     (NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin) OR
     (NEW.is_approved   IS DISTINCT FROM OLD.is_approved)   OR
     (NEW.is_blocked    IS DISTINCT FROM OLD.is_blocked)
  THEN
    RAISE EXCEPTION 'No tienes permiso para modificar privilegios de usuario.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_profile_privilege_overwrite
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_overwrite();

-- 4. RLS: allow super admin to DELETE profiles (regular admins should not delete)
--    The existing profiles_admin_all policy covers INSERT/SELECT/UPDATE for admins.
--    We add an explicit DELETE-only policy restricted to super admins.
--    If profiles_admin_all already allows DELETE for all admins and you want to
--    restrict that, drop it and recreate split policies (see commented block below).
DROP POLICY IF EXISTS profiles_super_admin_delete ON public.profiles;
CREATE POLICY profiles_super_admin_delete
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_user_super_admin());

-- ── Optional: tighten profiles_admin_all to SELECT + UPDATE only ────────────
-- Uncomment the block below if you want to prevent regular admins from
-- deleting profiles via direct API calls (the UI already hides the button).
--
-- DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
-- CREATE POLICY profiles_admin_select ON public.profiles
--   FOR SELECT TO authenticated USING (public.is_user_admin());
-- CREATE POLICY profiles_admin_update ON public.profiles
--   FOR UPDATE TO authenticated USING (public.is_user_admin());
-- ─────────────────────────────────────────────────────────────────────────────

-- 5. Seed: promote the first super admin
--    (email must already exist in auth.users and have a profiles row)
UPDATE public.profiles
SET
  is_super_admin = TRUE,
  is_admin       = TRUE,
  is_approved    = TRUE,
  is_blocked     = FALSE
WHERE email = 'info@ucoipcanarias.com';
