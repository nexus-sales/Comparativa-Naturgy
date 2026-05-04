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
  bonoRate: number;
  taxImpElec: number;
  taxIGIC: number;
  taxIGICRed: number;
  taxIGIC7: number;
}

export interface TarifaLocal {
  id: string;
  nombre: string;
  tipo: 'uni' | 'tri' | 'hex';
  potUnit: 'dia' | 'anio';
  rPot: number[];
  rEn: number[];
  sva: number;
  open: boolean;
  selected: boolean;
  requires_auth?: boolean;
}

export interface CalcResult {
  potencia: number;
  energia: number;
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
  const nEnMap: Record<string, number> = { uni: 1, tri: 3, hex: 6 };
  if (t.tipo === 'uni') {
    costEn = (+(t.rEn[0]) || 0) * c.en.reduce((a, v) => a + (+v || 0), 0);
  } else {
    const n = nEnMap[t.tipo] || 1;
    for (let i = 0; i < n; i++) costEn += (+(t.rEn[i] || 0)) * (+(c.en[i] || 0));
  }

  const sva = +(t.sva || 0);
  const alq = +(c.alquiler || 0);
  const subtotal = costPot + costEn + sva + alq;
  const impElec = (subtotal - alq) * (+(c.taxImpElec || 0) / 100);
  const bono = (+(c.bonoRate || 0)) * dias;

  if (taxModel === 'res') {
    const igic = alq * (+(c.taxIGIC || 0) / 100);
    return {
      potencia: +costPot.toFixed(4),
      energia: +costEn.toFixed(4),
      sva, alquiler: alq,
      subtotal: +subtotal.toFixed(4),
      impElec: +impElec.toFixed(4),
      igic: +igic.toFixed(4),
      bonoSocial: +bono.toFixed(4),
      total: +(subtotal + impElec + igic + bono).toFixed(4),
    };
  }

  const igicRed = (subtotal + impElec + bono) * (+(c.taxIGICRed || 0) / 100);
  const igic7 = alq * (+(c.taxIGIC7 || 0) / 100);
  return {
    potencia: +costPot.toFixed(4),
    energia: +costEn.toFixed(4),
    sva, alquiler: alq,
    subtotal: +subtotal.toFixed(4),
    impElec: +impElec.toFixed(4),
    igicRed: +igicRed.toFixed(4),
    igic7: +igic7.toFixed(4),
    bonoSocial: +bono.toFixed(4),
    total: +(subtotal + impElec + igicRed + igic7).toFixed(4),
  };
}

export function fmtEur(v: number | null | undefined, d = 2): string {
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  const val = (+v).toFixed(d).replace('.', ',');
  const parts = val.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(',') + ' €';
}

export function fmtRaw(v: number | null | undefined, d = 2): string {
  if (v === null || v === undefined || isNaN(Number(v))) return '';
  const val = (+v).toFixed(d).replace('.', ',');
  const parts = val.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(',');
}

export const SEG_COLORS: Record<string, string> = {
  res: '#185FA5',
  pyme20: '#0F6E56',
  pyme20one: '#B45309',
  pyme361: '#6D28D9',
};

export const SEG_DEFAULTS: Record<string, Partial<SegCliente>> = {
  res:       { alquiler: 0.86, bonoRate: 0.019121, taxImpElec: 5.1127, taxIGIC: 7, taxIGICRed: 0, taxIGIC7: 0 },
  pyme20:    { alquiler: 1.68, bonoRate: 0.019121, taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7 },
  pyme20one: { alquiler: 0.75, bonoRate: 0.019121, taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7 },
  pyme361:   { alquiler: 1.68, bonoRate: 0.019121, taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7 },
};

export function makeDefaultClient(segId: string): SegCliente {
  const d = SEG_DEFAULTS[segId] || SEG_DEFAULTS['pyme20'];
  return {
    nombre: '', cups: '', dir: '', f1: '', f2: '',
    dias: 30, kw: [0, 0, 0, 0, 0, 0], en: [0, 0, 0, 0, 0, 0],
    factura: 0,
    alquiler: d.alquiler ?? 0.86,
    bonoRate: d.bonoRate ?? 0.019121,
    taxImpElec: d.taxImpElec ?? 5.1127,
    taxIGIC: d.taxIGIC ?? 7,
    taxIGICRed: d.taxIGICRed ?? 0,
    taxIGIC7: d.taxIGIC7 ?? 0,
  };
}

export const CHART_COLS = ['#002855', '#0F6E56', '#B45309', '#6D28D9', '#be185d', '#0e7490'];
