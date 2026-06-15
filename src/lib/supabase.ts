import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and Anon Key must be provided in .env file')
}

// In-memory promise chain: serialises auth calls within this tab without
// touching navigator.locks or localStorage. Each call is chained onto the
// previous one; the chain itself never stays rejected so it can't deadlock.
let authChain: Promise<unknown> = Promise.resolve();
const lock = <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const run = authChain.then(fn, fn);                          // runs fn after the previous call, pass or fail
  authChain = run.then(() => undefined, () => undefined);      // keep the chain always resolved
  return run;
};

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'naturgy_auth_v1',
    lock,
  },
})
