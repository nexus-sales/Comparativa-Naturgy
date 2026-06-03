import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and Anon Key must be provided in .env file')
}

// Same-tab serialization: serializes concurrent refresh calls within one tab.
// Reentrancy is handled by supabase-js itself (pendingInLock queue), so this
// never deadlocks on its own lock.
let localLock: Promise<void> | null = null;

// Cross-tab semaphore via localStorage: avoids navigator.locks hanging when a
// background tab is frozen. The stored value is the lock's expiry timestamp.
const CROSS_TAB_LOCK_KEY = 'naturgy:auth:lock';
const LOCK_TTL_MS = 8_000;   // a held lock auto-expires, so a frozen tab can't block forever
const POLL_MS = 50;
const MAX_WAIT_MS = 10_000;  // > LOCK_TTL_MS so a waiter always outlives a stale lock

// Error that supabase-js recognizes (via the isAcquireTimeout flag) as a
// non-fatal "lock busy" signal, so it skips the operation (e.g. an auto-refresh
// tick) silently instead of re-throwing and spamming the console.
function acquireTimeoutError(): Error {
  const e = new Error('Auth lock timeout');
  (e as unknown as { isAcquireTimeout: boolean }).isAcquireTimeout = true;
  return e;
}

const authLock = async <R>(_name: string, timeout: number, fn: () => Promise<R>): Promise<R> => {
  // Phase 1: same-tab queue
  while (localLock) await localLock;
  let releaseLocal!: () => void;
  localLock = new Promise(r => { releaseLocal = r; });

  try {
    // Phase 2: cross-tab best-effort mutex.
    // supabase calls with timeout === 0 (try-once; used by the auto-refresh tick)
    // and timeout > 0 (wait up to N ms). We must NOT reject before checking the
    // semaphore, and we must honour try-once instead of looping.
    const tryOnce = timeout === 0;
    const waitMs = timeout > 0 ? Math.min(timeout, MAX_WAIT_MS) : MAX_WAIT_MS;
    const deadline = Date.now() + waitMs;

    await new Promise<void>((resolve, reject) => {
      const attempt = () => {
        let expiry = 0;
        try {
          expiry = Number(localStorage.getItem(CROSS_TAB_LOCK_KEY) ?? '0');
        } catch {
          // localStorage unavailable (private mode / disabled): degrade to
          // same-tab locking only rather than blocking auth entirely.
          resolve();
          return;
        }

        if (expiry < Date.now()) {
          // Lock is free (or its TTL expired) → acquire it.
          try { localStorage.setItem(CROSS_TAB_LOCK_KEY, String(Date.now() + LOCK_TTL_MS)); } catch { /* ignore */ }
          resolve();
          return;
        }

        // Lock is held by another tab.
        if (tryOnce || Date.now() >= deadline) {
          reject(acquireTimeoutError());
          return;
        }
        setTimeout(attempt, POLL_MS);
      };
      attempt();
    });

    try {
      return await fn();
    } finally {
      try { localStorage.removeItem(CROSS_TAB_LOCK_KEY); } catch { /* ignore */ }
    }
  } finally {
    localLock = null;
    releaseLocal();
  }
};

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'naturgy_auth_v1',
    lock: authLock,
  },
})