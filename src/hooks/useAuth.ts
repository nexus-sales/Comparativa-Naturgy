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

    async function checkAdminStatus(authUser: User) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (!cancelled && data) {
          setProfile(data as Profile);
          setIsAdmin((data.is_admin ?? false) && !(data.is_blocked ?? false));
        } else if (!cancelled) {
          setProfile(fallbackProfile(authUser));
        }
      } catch (err) {
        console.error("Error checking profile:", err);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;

      if (session?.user) {
        setUser(session.user);
        await checkAdminStatus(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  return { user, loading, isAdmin, profile };
}
