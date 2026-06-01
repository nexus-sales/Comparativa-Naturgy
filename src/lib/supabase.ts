import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and Anon Key must be provided in .env file')
}

// Custom in-process lock to avoid cross-tab navigator.locks contention
// while still providing a real mutex for the current process.
let currentLock: Promise<void> | null = null;
const inProcessLock = async <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => {
  while (currentLock) {
    await currentLock;
  }
  let resolveLock!: () => void;
  currentLock = new Promise((resolve) => { resolveLock = resolve; });
  try {
    return await fn();
  } finally {
    currentLock = null;
    resolveLock();
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: { lock: inProcessLock },
})
