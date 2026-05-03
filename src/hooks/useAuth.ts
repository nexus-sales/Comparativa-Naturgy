import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) await checkAdmin(session.user.id, () => cancelled);
      if (!cancelled) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) await checkAdmin(session.user.id, () => cancelled);
      else setIsAdmin(false);
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  async function checkAdmin(userId: string, isCancelled: () => boolean) {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (!isCancelled() && !error && data) {
      setIsAdmin(data.is_admin);
    }
  }

  return { user, loading, isAdmin };
}
