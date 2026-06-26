import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../types';

function fallbackProfile(user: User): Profile {
  return {
    id: user.id,
    email: user.email ?? '',
    full_name: null,
    phone: null,
    is_admin: false,
    is_super_admin: false,
    is_approved: false,
    is_blocked: null,
    last_login_at: null,
    accepted_terms_at: null,
  };
}

// Catches AuthApiError 400 for "Refresh Token Not Found" and variants.
// The SDK message format is "Invalid Refresh Token: <reason>", status 400.
function isRefreshTokenError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string };
  return e.status === 400 &&
    typeof e.message === 'string' &&
    /refresh.token/i.test(e.message);
}

const SESSION_TIMEOUT_MS = 10_000;

// Wraps getSession() with a hard 10 s deadline so a locked or hung auth
// call never blocks the app init or tab-focus handler indefinitely.
function sessionWithTimeout() {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('getSession timeout')), SESSION_TIMEOUT_MS)
    ),
  ]);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAdminStatus(authUser: User, attempt = 0) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (cancelled) return;

        if (data) {
          setProfile(data as Profile);
          const active = !(data.is_blocked ?? false);
          setIsAdmin((data.is_admin ?? false) && active);
          setIsSuperAdmin((data.is_super_admin ?? false) && active);
        } else {
          setProfile(fallbackProfile(authUser));
          // Retry once after 2s — network may be reconnecting after sleep
          if (attempt === 0) {
            setTimeout(() => { if (!cancelled) checkAdminStatus(authUser, 1); }, 2000);
          }
        }
      } catch (err) {
        console.error("Error checking profile:", err);
        if (attempt === 0 && !cancelled) {
          setTimeout(() => { if (!cancelled) checkAdminStatus(authUser, 1); }, 2000);
        }
      }
    }

    // Clears the local Supabase session and resets all auth state.
    // Uses scope:'local' so we don't attempt a server call with a broken token.
    async function signOutAndReset() {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      if (cancelled) return;
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setLoading(false);
    }

    async function init() {
      try {
        const { data: { session }, error } = await sessionWithTimeout();
        if (cancelled) return;

        if (error && isRefreshTokenError(error)) {
          await signOutAndReset();
          return;
        }

        if (session?.user) {
          setUser(session.user);
          await checkAdminStatus(session.user);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      setUser(session.user);
      // Only re-check profile on meaningful events, not every token refresh noise.
      // For TOKEN_REFRESHED, init() is still running and will call setLoading(false)
      // after checkAdminStatus finishes — calling it here early causes an isAdmin=false flash.
      if (event !== 'TOKEN_REFRESHED') {
        await checkAdminStatus(session.user);
        setLoading(false);
      }
    });

    // Re-check auth when the tab becomes visible again after being hidden/idle.
    // If the access token is expired, force a refresh; sign out cleanly on failure.
    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      try {
        const { data: { session }, error } = await sessionWithTimeout();
        if (cancelled) return;

        if (error && isRefreshTokenError(error)) {
          await signOutAndReset();
          return;
        }

        if (session?.user) {
          // Access token expired? Force a refresh now rather than waiting for the bg timer.
          const expiresAt = (session.expires_at ?? 0) * 1000;
          if (Date.now() > expiresAt) {
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
            if (cancelled) return;
            if (refreshError) {
              // Only sign out for invalid-token errors. Network / 5xx errors are
              // transient — leave the session intact and retry on next interaction.
              if (isRefreshTokenError(refreshError)) await signOutAndReset();
              return;
            }
            if (!refreshed.session?.user) {
              await signOutAndReset();
              return;
            }
            setUser(refreshed.session.user);
            await checkAdminStatus(refreshed.session.user);
            return;
          }

          setUser(session.user);
          await checkAdminStatus(session.user);
        } else if (user) {
          // Session was lost while idle
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setIsSuperAdmin(false);
        }
      } catch { /* ignore — will retry on next interaction */ }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading, isAdmin, isSuperAdmin, profile };
}
