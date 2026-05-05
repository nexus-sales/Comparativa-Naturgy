import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 1. Obtener sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        setUser(session.user);
        await checkAdmin(session.user.id, () => cancelled);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    // 2. Escuchar cambios (Login/Logout/Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      
      console.log('Auth Event:', event);
      
      if (session?.user) {
        setUser(session.user);
        await checkAdmin(session.user.id, () => cancelled);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      
      // Solo marcamos como no cargando si no es el evento inicial (que ya maneja getSession)
      // o si explícitamente es un logout
      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setLoading(false);
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  async function checkAdmin(userId: string, isCancelled: () => boolean) {
    console.log('--- checkAdmin DEBUG ---');
    console.log('UserID:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    }
    console.log('Profile data:', data);

    if (!isCancelled() && !error && data) {
      setIsAdmin(data.is_admin);
      console.log('setIsAdmin called with:', data.is_admin);
    }
  }

  return { user, loading, isAdmin };
}
