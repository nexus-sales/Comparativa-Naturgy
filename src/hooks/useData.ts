import { useEffect, useState } from 'react';
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

export function useData() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    const [segRes, tarRes] = await Promise.all([
      supabase.from('segments').select('*'),
      supabase.from('tariffs').select('*').eq('is_active', true)
    ]);

    if (segRes.error || tarRes.error) {
      setError('Error al cargar los datos. Comprueba tu conexión e inténtalo de nuevo.');
    } else {
      setSegments(segRes.data);
      setTariffs(tarRes.data);
    }
    setLoading(false);
  }

  return { segments, tariffs, loading, error, refresh: fetchData };
}
