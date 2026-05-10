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
      try {
        if (session?.user) {
          setUser(session.user);
          await checkAdmin(session.user.id, () => cancelled);
        } else {
          setUser(null);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error during initial auth setup:', err);
      } finally {
        setLoading(false);
      }
    }).catch(error => {
      console.error('Error in getSession:', error);
      if (!cancelled) setLoading(false);
    });

    // 2. Escuchar cambios (Login/Logout/Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      
      console.log('Auth Event:', event);
      
      try {
        if (session?.user) {
          setUser(session.user);
          await checkAdmin(session.user.id, () => cancelled);
        } else {
          setUser(null);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error handling auth state change:', err);
      } finally {
        // Solo marcamos como no cargando si no es el evento inicial (que ya maneja getSession)
        // o si explícitamente es un logout
        if (event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'SIGNED_IN') {
          setLoading(false);
        }
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  async function checkAdmin(userId: string, isCancelled: () => boolean) {
    console.log('--- BUSCANDO PERFIL EN DB ---');
    
    try {
      // Usamos .select() sin filtros primero para ver si el RLS nos deja ver ALGO
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('ERROR RLS / DB:', error.message);
      }
      
      console.log('¿Perfil encontrado?:', data ? 'SÍ' : 'NO');
      if (data) console.log('Admin Status en DB:', data.is_admin);

      if (!isCancelled()) {
        setIsAdmin(data?.is_admin ?? false);
      }
    } catch (err) {
      console.error('EXCEPTION in checkAdmin:', err);
      if (!isCancelled()) {
        setIsAdmin(false);
      }
    }
  }

  return { user, loading, isAdmin };
}
