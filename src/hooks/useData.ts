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
}

export function useData() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [segRes, tarRes] = await Promise.all([
      supabase.from('segments').select('*'),
      supabase.from('tariffs').select('*').eq('is_active', true)
    ]);

    if (!segRes.error) setSegments(segRes.data);
    if (!tarRes.error) setTariffs(tarRes.data);
    setLoading(false);
  }

  return { segments, tariffs, loading, refresh: fetchData };
}
