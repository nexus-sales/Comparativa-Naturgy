export interface SveService {
  id: string;
  name: string;
  priceYear: number;
}

export const SVE_CATALOG: SveService[] = [
  { id: 'sve_gc_xpress',     name: 'SVE GC Xpress',              priceYear: 89.16  },
  { id: 'sve_gc_xpress_dto', name: 'SVE GC Xpress (20% dto.)',   priceYear: 71.328 },
  { id: 'svs_gc_10kwp',      name: 'SVS GC <10kWp',              priceYear: 130.30 },
];

// Servicios SVE disponibles por segmento (array vacío = no aplica SVE)
export const SVE_SEGMENT_IDS: Record<string, string[]> = {
  res:       [],
  pyme20:    ['sve_gc_xpress', 'sve_gc_xpress_dto', 'svs_gc_10kwp'],
  pyme20one: ['sve_gc_xpress', 'sve_gc_xpress_dto', 'svs_gc_10kwp'],
  pyme30:    ['sve_gc_xpress', 'sve_gc_xpress_dto', 'svs_gc_10kwp'],
  pyme61:    [],
  pyme361:   ['sve_gc_xpress', 'sve_gc_xpress_dto', 'svs_gc_10kwp'],
};

export interface SegCliente {
  nombre: string;
  cups: string;
  dir: string;
  f1: string;
  f2: string;
  dias: number;
  kw: number[];
  en: number[];
  factura: number;
  alquiler: number;
  enExc?: number; // kWh excedentes
  excedenteRate: number; // Precio excedente Admin
  bonoRate: number;
  taxImpElec: number;
  taxIGIC: number;
  taxIGICRed: number;
  taxIGIC7: number;
  reactiva?: number[];     // kVArh exceso por periodo (6 posiciones)
  reactivaRate?: number[]; // €/kVArh por periodo (6 posiciones)
  sveServiceId?: string | null;  // ID del servicio SVE activo (null = sin SVE)
  sveAnioRate?: number;          // Precio anual del SVE activo (€/año, prorrateado por días en calc)
}

export interface TarifaLocal {
  id: string;
  nombre: string;
  tipo: 'uni' | 'uni6' | 'tri' | 'tri6' | 'hex';
  potUnit: 'dia' | 'anio';
  rPot: number[];
  rEn: number[];
  sva: number;
  open: boolean;
  selected: boolean;
  requires_auth?: boolean;
  segment_id?: string;
}

export interface CalcResult {
  potencia: number;
  energia: number;
  excedentes?: number; // Valor negativo (ej: -5.40)
  reactiva?: number;   // Coste total energía reactiva (positivo)
  sva: number;
  alquiler: number;
  subtotal: number;
  impElec: number;
  igic?: number;
  igicRed?: number;
  igic7?: number;
  bonoSocial: number;
  total: number;
}

export function calc(taxModel: string, potP: number, c: SegCliente, t: TarifaLocal): CalcResult {
  const dias = +c.dias || 1;
  let costPot = 0;
  for (let i = 0; i < potP; i++) {
    const r = +(t.rPot[i] || 0), kw = +(c.kw[i] || 0);
    if (!r || !kw) continue;
    costPot += t.potUnit === 'dia' ? r * kw * dias : (r / 365) * kw * dias;
  }

  let costEn = 0;
  const nEnMap: Record<string, number> = { uni: 1, uni6: 1, tri: 3, tri6: 3, hex: 6 };
  if (t.tipo === 'uni' || t.tipo === 'uni6') {
    // Precio único × consumo total (suma de todos los periodos)
    costEn = (+(t.rEn[0]) || 0) * c.en.reduce((a, v) => a + (+v || 0), 0);
  } else {
    const n = nEnMap[t.tipo] || 1;
    for (let i = 0; i < n; i++) costEn += (+(t.rEn[i] || 0)) * (+(c.en[i] || 0));
  }

  // SVE: servicio opcional del cliente, prorrateado por días (t.sva siempre 0)
  const sva = ((c.sveAnioRate || 0) / 365) * dias;
  const alq = +(c.alquiler || 0);
  const costExcRaw = (+(c.enExc || 0)) * (+(c.excedenteRate || 0));
  // Tope: la compensación por excedentes nunca supera el coste de la energía (DGT V1146-24)
  const costExc = Math.min(costExcRaw, costEn);
  const costReactiva = (c.reactiva || []).reduce((acc, v, i) => acc + (+(v) || 0) * (+(c.reactivaRate?.[i] ?? 0) || 0), 0);

  const subtotal = costPot + costEn + costReactiva + sva + alq - costExc;
  const costEnNet = costEn - costExc;
  // Impuesto eléctrico: base = potencia + energía NETA de excedentes (DGT V1146-24)
  const impElec = (costPot + costEnNet) * (+(c.taxImpElec || 0) / 100);
  const bono = (+(c.bonoRate || 0)) * dias;

  if (taxModel === 'res') {
    const igic = alq * (+(c.taxIGIC || 0) / 100);
    return {
      potencia: +costPot.toFixed(4),
      energia: +costEn.toFixed(4),
      excedentes: - +costExc.toFixed(4),
      reactiva: +costReactiva.toFixed(4),
      sva, alquiler: alq,
      subtotal: +subtotal.toFixed(4),
      impElec: +impElec.toFixed(4),
      igic: +igic.toFixed(4),
      bonoSocial: +bono.toFixed(4),
      total: +(subtotal + impElec + igic + bono).toFixed(4),
    };
  }

  // IGIC Reducido 3%: base = potencia + energía NETA de excedentes + IE + bono (DGT V1146-24)
  const baseIGICRed = costPot + costEnNet + impElec + bono;
  const igicRed = baseIGICRed * (+(c.taxIGICRed || 0) / 100);
  // IGIC General 7%: sobre alquiler + SVE (servicios)
  const baseIGIC7 = alq + sva;
  const igic7 = baseIGIC7 * (+(c.taxIGIC7 || 0) / 100);
  return {
    potencia: +costPot.toFixed(4),
    energia: +costEn.toFixed(4),
    excedentes: - +costExc.toFixed(4),
    reactiva: +costReactiva.toFixed(4),
    sva, alquiler: alq,
    subtotal: +subtotal.toFixed(4),
    impElec: +impElec.toFixed(4),
    igicRed: +igicRed.toFixed(4),
    igic7: +igic7.toFixed(4),
    bonoSocial: +bono.toFixed(4),
    total: +(subtotal + impElec + igicRed + igic7 + bono).toFixed(4),
  };
}

export function fmtEur(v: number | null | undefined, d = 2): string {
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  const factor = 10 ** d;
  const truncated = Math.trunc(Number(v) * factor) / factor;
  const val = truncated.toFixed(d).replace('.', ',');
  const parts = val.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(',') + ' €';
}

export function fmtRaw(v: number | null | undefined, d = 2): string {
  if (v === null || v === undefined || isNaN(Number(v))) return '';
  const factor = 10 ** d;
  const truncated = Math.trunc(Number(v) * factor) / factor;
  const val = truncated.toFixed(d).replace('.', ',');
  if (d === 0) {
    return val.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  const parts = val.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(',');
}

export const SEG_COLORS: Record<string, string> = {
  res: '#185FA5',
  pyme20: '#0F6E56',
  pyme20one: '#B45309',
  pyme30: '#6D28D9',
  pyme61: '#7C3AED',
  pyme361: '#6D28D9',
};

export const SEG_DEFAULTS: Record<string, Partial<SegCliente>> = {
  res:       { alquiler: 0.86, bonoRate: 0.019121, excedenteRate: 0.06, taxImpElec: 5.1127, taxIGIC: 7, taxIGICRed: 0, taxIGIC7: 0 },
  pyme20:    { alquiler: 1.68, bonoRate: 0.019121, excedenteRate: 0.06, taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7 },
  pyme20one: { alquiler: 0.75, bonoRate: 0.019121, excedenteRate: 0.06, taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7 },
  pyme30:    { alquiler: 1.68, bonoRate: 0.019121, excedenteRate: 0.06, taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7 },
  pyme61:    { alquiler: 1.68, bonoRate: 0.019121, excedenteRate: 0.06, taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7 },
  pyme361:   { alquiler: 1.68, bonoRate: 0.019121, excedenteRate: 0.06, taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7 },
};

export const SEG_DEFS = [
  { id: "res",       label: "Residencial",    color: "#185FA5" },
  { id: "pyme20",    label: "Pyme 2.0TD",     color: "#0F6E56" },
  { id: "pyme20one", label: "Pyme ONE 2.0TD", color: "#B45309" },
  { id: "pyme30",    label: "Pyme 3.0TD",     color: "#6D28D9" },
  { id: "pyme61",    label: "Pyme 6.1TD",     color: "#7C3AED" },
  { id: "pyme361",   label: "Pyme 3.0/6.1TD", color: "#6D28D9" },
];

export function makeDefaultClient(segId: string): SegCliente {
  const d = SEG_DEFAULTS[segId] || SEG_DEFAULTS['pyme20'];
  return {
    nombre: '', cups: '', dir: '', f1: '', f2: '',
    dias: 30, kw: [0, 0, 0, 0, 0, 0], en: [0, 0, 0, 0, 0, 0],
    factura: 0,
    alquiler: d.alquiler ?? 0.86,
    enExc: 0,
    excedenteRate: d.excedenteRate ?? 0.06,
    bonoRate: d.bonoRate ?? 0.019121,
    taxImpElec: d.taxImpElec ?? 5.1127,
    taxIGIC: d.taxIGIC ?? 7,
    taxIGICRed: d.taxIGICRed ?? 0,
    taxIGIC7: d.taxIGIC7 ?? 0,
    reactiva: [0, 0, 0, 0, 0, 0],
    reactivaRate: [0, 0, 0, 0, 0, 0],
    sveServiceId: null,
    sveAnioRate: 0,
  };
}

export const CHART_COLS = ['#002855', '#0F6E56', '#B45309', '#6D28D9', '#be185d', '#0e7490'];
