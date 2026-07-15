import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and Anon Key must be provided in .env file')
}

// In-memory promise chain: serialises auth calls within this tab without
// touching navigator.locks or localStorage. Each call is chained onto the
// previous one. The chain advances after LOCK_TIMEOUT_MS even if `fn` never
// settles, so one hung call (e.g. a stuck getSession() on mount) can't
// permanently block every later sign-in/session call in this tab.
const LOCK_TIMEOUT_MS = 15_000;
let authChain: Promise<unknown> = Promise.resolve();
const lock = <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
  const run = authChain.then(fn, fn);
  authChain = Promise.race([
    run.then(() => undefined, () => undefined),
    new Promise<undefined>((resolve) => setTimeout(resolve, LOCK_TIMEOUT_MS)),
  ]);
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
