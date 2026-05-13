import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

function fallbackProfile(user: User) {
  return {
    id: user.id,
    email: user.email ?? '',
    full_name: '',
    phone: '',
    is_admin: false,
    is_approved: false,
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAdminStatus(userId: string) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        if (!cancelled && data) {
          setProfile(data);
          setIsAdmin(data.is_admin ?? false);
        } else if (!cancelled) {
          // Si no hay perfil, al menos intentamos ver si es el admin principal por email
          // Esto se refuerza en App.tsx con OWNER_ADMIN_EMAILS
          setProfile(fallbackProfile({ id: userId, email: user?.email } as any));
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
          await checkAdminStatus(session.user.id);
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
      
      if (session?.user) {
        setUser(session.user);
        await checkAdminStatus(session.user.id);
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
