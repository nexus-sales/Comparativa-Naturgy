import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Tariff {
  id: string;
  segment_id: string;
  name: string;
  type: string;
  pot_unit: string;
  r_pot: number[];
  r_en: number[];
  sva: number;
  requires_auth?: boolean;
}

export interface Segment {
  id: string;
  label: string;
  tax_model: string;
  pot_p: number;
  bono_rate: number;
  excedente_rate: number;
  tax_imp_elec: number;
  tax_igic: number;
  tax_igic_red: number;
  tax_igic_7: number;
}

const CACHE_KEY = 'naturgy_data_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos
const DATA_TIMEOUT_MS = 8000;

interface CachedData {
  segments: Segment[];
  tariffs: Tariff[];
  savedAt: number;
}

function loadCache(): CachedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedData = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(segments: Segment[], tariffs: Tariff[]) {
  try {
    const data: CachedData = { segments, tariffs, savedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage puede estar lleno o bloqueado, no es critico
  }
}

export function useData(enabled = true, cacheScope = 'default') {
  const [initialCache] = useState(() => loadCache());
  const [segments, setSegments] = useState<Segment[]>(initialCache?.segments ?? []);
  const [tariffs, setTariffs] = useState<Tariff[]>(initialCache?.tariffs ?? []);
  const [loading, setLoading] = useState(enabled && !initialCache);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(!!initialCache);

  const fetchData = useCallback(async (silent = false) => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
      setError(null);
    }
    
    // Si no hay internet, no intentamos siquiera para no bloquear con timeouts largos
    if (!navigator.onLine && initialCache) {
      if (!silent) setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), DATA_TIMEOUT_MS);

    try {
      const { data: segData, error: segError } = await supabase
          .from('segments')
          .select('*')
          .order('id')
          .abortSignal(controller.signal);

      const { data: tarData, error: tarError } = await supabase
          .from('tariffs')
          .select('*')
          .eq('is_active', true)
          .order('segment_id')
          .order('name')
          .abortSignal(controller.signal);

      if (segError || tarError) {
        console.error('Error fetching data:', segError ?? tarError);
        if (!silent) setError('Error al cargar los datos. Comprueba tu conexión e inténtalo de nuevo.');
      } else {
        const nextSegments = segData ?? [];
        const nextTariffs = tarData ?? [];
        setSegments(nextSegments);
        setTariffs(nextTariffs);
        saveCache(nextSegments, nextTariffs);
        setError(null);
        setStale(false);
      }
    } catch (err) {
      console.error('Exception fetching data:', err);
      if (!silent) {
        const message = err instanceof DOMException && err.name === 'AbortError'
          ? 'La base de datos está tardando demasiado en responder. Puedes reintentarlo en unos segundos.'
          : 'Error de conexión al cargar los datos.';
        setError(message);
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (!silent) setLoading(false);
    }
  }, [enabled, initialCache]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (initialCache) {
      // Tenemos caché: mostrar datos inmediatamente
      setSegments(initialCache.segments);
      setTariffs(initialCache.tariffs);
      setStale(true);
      // Intentar refrescar en background de forma silenciosa
      fetchData(true).finally(() => setStale(false));
    } else {
      fetchData(false);
    }
  }, [enabled, cacheScope, fetchData]); // Eliminada la dependencia circular indirecta

  return { segments, tariffs, loading, error, stale, refresh: () => fetchData(false) };
}
