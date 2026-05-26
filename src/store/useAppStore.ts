import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Segment, Tariff } from '../types';

const CACHE_KEY = 'naturgy_cache_v2';
const CACHE_TTL = 30 * 60 * 1000;
const SUPABASE_TIMEOUT_MS = 15000;

interface CachePayload {
  segments: Segment[];
  tariffs: Tariff[];
  ts: number;
}

function readCache(): { segments: Segment[]; tariffs: Tariff[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const payload: CachePayload = JSON.parse(raw);
    if (Date.now() - payload.ts > CACHE_TTL) return null;
    return { segments: payload.segments, tariffs: payload.tariffs };
  } catch {
    return null;
  }
}

function writeCache(segments: Segment[], tariffs: Tariff[]) {
  try {
    const payload: CachePayload = { segments, tariffs, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch { /* localStorage not available */ }
}

interface AppStore {
  segments: Segment[];
  tariffs: Tariff[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

const initialCache = readCache();

export const useAppStore = create<AppStore>((set) => ({
  segments: initialCache?.segments ?? [],
  tariffs: initialCache?.tariffs ?? [],
  loading: !initialCache,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
    try {
      const [segResult, tarResult] = await Promise.all([
        supabase.from('segments').select('*').order('id').abortSignal(controller.signal),
        supabase.from('tariffs').select('*').eq('is_active', true).order('segment_id').order('name').abortSignal(controller.signal),
      ]);
      if (segResult.error || tarResult.error) {
        set({ error: 'Error al cargar los datos. Comprueba tu conexión e inténtalo de nuevo.', loading: false });
        return;
      }
      const segments = segResult.data ?? [];
      const tariffs = tarResult.data ?? [];
      set({ segments, tariffs, loading: false, error: null });
      writeCache(segments, tariffs);
    } catch {
      set({ error: 'Error de conexión al cargar los datos.', loading: false });
    } finally {
      window.clearTimeout(timeout);
    }
  },

  refresh: async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
    try {
      const [segResult, tarResult] = await Promise.all([
        supabase.from('segments').select('*').order('id').abortSignal(controller.signal),
        supabase.from('tariffs').select('*').eq('is_active', true).order('segment_id').order('name').abortSignal(controller.signal),
      ]);
      if (segResult.error || tarResult.error) {
        set({ error: 'Error al actualizar los datos desde Supabase.' });
        return;
      }
      const segments = segResult.data ?? [];
      const tariffs = tarResult.data ?? [];
      set({ segments, tariffs, error: null });
      writeCache(segments, tariffs);
    } catch {
      set({ error: 'Error de conexión al actualizar los datos.' });
    } finally {
      window.clearTimeout(timeout);
    }
  },

  reset: () => {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* localStorage not available */ }
    set({ segments: [], tariffs: [], loading: false, error: null });
  },
}));
