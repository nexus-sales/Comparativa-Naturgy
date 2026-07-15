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

// Every supabase-js call (auth, REST inserts/selects, etc.) reads the
// current session through the lock above before it can fire its request. If
// that lock is still stuck on a previous hung call, the new call waits
// silently with no feedback and no way to retry. Wrap call sites with this
// so the UI always gets a result within `ms` instead of hanging forever.
export function withTimeout<T>(promise: PromiseLike<T>, ms = 15_000, message = 'Tiempo de espera agotado. Comprueba tu conexión e inténtalo de nuevo.'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}
