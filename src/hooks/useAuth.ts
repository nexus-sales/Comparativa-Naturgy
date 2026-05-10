import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchSession = async () => {
      try {
        // Añadimos un timeout de 3 segundos por si el storage o la red se quedan colgados en móviles/PWA
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout obteniendo sesión')), 3000)
        );
        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        
        if (cancelled) return;
        
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
        if (!cancelled) setLoading(false);
      }
    };

    fetchSession();

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
        // En móviles a veces el evento inicial no dispara correctamente la carga o se pierde
        if (!cancelled) setLoading(false);
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  async function checkAdmin(userId: string, isCancelled: () => boolean) {
    console.log('--- BUSCANDO PERFIL EN DB ---');
    
    try {
      // Usamos un timeout para evitar que la app se quede en loading si la red está caída en la PWA
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout de red')), 4000)
      );
      
      const adminPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const { data, error } = await Promise.race([adminPromise, timeoutPromise]) as any;

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
