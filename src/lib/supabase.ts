import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and Anon Key must be provided in .env file')
}

// Custom in-process lock: avoids cross-tab navigator.locks contention that
// can orphan the auth lock and cause all Supabase calls to hang indefinitely.
const inProcessLock = async <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn()

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: { lock: inProcessLock },
})
