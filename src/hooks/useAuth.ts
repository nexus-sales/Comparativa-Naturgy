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
    is_approved: false,
    is_blocked: null,
    last_login_at: null,
    accepted_terms_at: null,
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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
          setIsAdmin((data.is_admin ?? false) && !(data.is_blocked ?? false));
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

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

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

      // On actual sign-out reset everything; on token refresh just update
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
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

    // Re-check auth when the tab becomes visible again after being hidden/idle
    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          setUser(session.user);
          await checkAdminStatus(session.user);
        } else if (user) {
          // Session was lost while idle
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
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

  return { user, loading, isAdmin, profile };
}
