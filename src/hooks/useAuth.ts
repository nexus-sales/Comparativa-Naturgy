import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user.id);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) checkAdmin(session.user.id);
      else setIsAdmin(false);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();
    
    if (!error && data) {
      setIsAdmin(data.is_admin);
    }
  }

  return { user, loading, isAdmin };
}
