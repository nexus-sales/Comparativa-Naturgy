// Tabla de comisiones PYME Naturgy — vigente desde 01/02/2026

export type PlanTipo = 'fijo' | 'variable';
export type PlanPlan = 'one' | 'luz' | 'supra';

export interface PlanComisiones {
  one: number;
  luz: number;
  supra: number;
}

export interface ComisionResult {
  fijo: PlanComisiones;
  variable: PlanComisiones;
  metodo: 'plana' | 'formula_fijo' | 'tabla_alta';
  mwh?: number;
}

const VARIABLE_TRAMOS = [
  { min: 10001, max: 15001, one: 61,   luz: 112,  supra: 150  },
  { min: 15001, max: 20001, one: 83,   luz: 153,  supra: 175  },
  { min: 20001, max: 30001, one: 125,  luz: 230,  supra: 338  },
  { min: 30001, max: 50001, one: 183,  luz: 337,  supra: 494  },
  { min: 50001, max: 100001, one: 333, luz: 611,  supra: 878  },
  { min: 100001, max: 150001, one: 386, luz: 710, supra: 1040 },
  { min: 150001, max: 200001, one: 552, luz: 1014, supra: 1495 },
  { min: 200001, max: 250001, one: 718, luz: 1319, supra: 1950 },
  { min: 250001, max: 350001, one: 821, luz: 1508, supra: 2210 },
  { min: 350001, max: 400001, one: 1650, luz: 1925, supra: 2795 },
];

const ALTO_CONSUMO_TRAMOS = [
  { min: 400001, max: 600001, fijo: { one: 2040, luz: 2550, supra: 5712 }, variable: { one: 2100, luz: 2400, supra: 3588 } },
  { min: 600001, max: 800001, fijo: { one: 2457, luz: 2975, supra: 6256 }, variable: { one: 2400, luz: 2700, supra: 3900 } },
  { min: 800001, max: 1000001, fijo: { one: 3060, luz: 3825, supra: 6375 }, variable: { one: 2700, luz: 3000, supra: 4290 } },
];

export function calcularComisionPyme(kwh: number): ComisionResult | 'NC' | null {
  if (!kwh || kwh <= 0) return null;
  if (kwh > 1000000) return 'NC';

  if (kwh <= 10000) {
    return {
      fijo:     { one: 65, luz: 65, supra: 65 },
      variable: { one: 60, luz: 60, supra: 60 },
      metodo: 'plana',
    };
  }

  if (kwh > 400000) {
    const t = ALTO_CONSUMO_TRAMOS.find(t => kwh >= t.min && kwh < t.max);
    if (!t) return 'NC';
    return { fijo: t.fijo, variable: t.variable, metodo: 'tabla_alta' };
  }

  const mwh = kwh / 1000;
  const tv = VARIABLE_TRAMOS.find(t => kwh >= t.min && kwh < t.max);
  if (!tv) return null;

  return {
    fijo: {
      one:   +(mwh * 5).toFixed(2),
      luz:   +(mwh * 10).toFixed(2),
      supra: +(mwh * 15).toFixed(2),
    },
    variable: { one: tv.one, luz: tv.luz, supra: tv.supra },
    metodo: 'formula_fijo',
    mwh,
  };
}

export function planLabel(tipo: PlanTipo, plan: PlanPlan): string {
  const t = tipo === 'fijo' ? 'Fijo' : 'Variable';
  const p = plan === 'one' ? 'Luz ONE' : plan === 'luz' ? 'Luz' : 'Luz Supra';
  return `Plan ${t} ${p}`;
}

export const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function mesKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function mesLabel(key: string | null): string {
  if (!key || key === 'pendientes') return 'Ventas sin activar';
  const [y, m] = key.split('-');
  return `${MESES_ES[+m - 1]} ${y}`;
}

export function mesCobro(fechaActivacion: string): string | null {
  if (!fechaActivacion) return null;
  const d = new Date(fechaActivacion + 'T12:00:00');
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseNum(s: string): number {
  return parseFloat((s || '').replace(/\./g, '').replace(',', '.')) || 0;
}

export function hoy(): string {
  return new Date().toISOString().split('T')[0];
}

// Tipos de ventas
export interface VentaPyme {
  id: number;
  nombre: string;
  cups: string;
  tarifa: string;
  kwh: number;
  planTipo: PlanTipo;
  planPlan: PlanPlan;
  planLabel: string;
  comision: number;
  fechaVenta: string;
  fechaActivacion: string;
  mesCobro: string | null;
  metodo: string;
}

export interface VentaRes {
  id: number;
  nombre: string;
  cups: string;
  producto: 'luz' | 'gas' | 'dual' | 'servicios';
  comisionBase: number;
  rappel: number;
  comision: number;
  fechaVenta: string;
  fechaActivacion: string;
  mesCobro: string | null;
}

export interface RappelTramo {
  id: number;
  label: string;
  valor: number;
  activo: boolean;
}

export interface AdocTramo {
  id: number;
  label: string;
  ref: string;
  valor: number;
  activo: boolean;
}

export interface ResComisiones {
  luz: number;
  gas: number;
  dual: number;
  servicios: number;
}

export const DEFAULT_RES_COMISIONES: ResComisiones = { luz: 40, gas: 40, dual: 80, servicios: 20 };

export const DEFAULT_RAPPEL_TRAMOS: RappelTramo[] = [
  { id: 1, label: '10 Contratos', valor: 0, activo: false },
  { id: 2, label: '20 Contratos', valor: 0, activo: false },
  { id: 3, label: '30 Contratos', valor: 0, activo: false },
  { id: 4, label: '40 Contratos', valor: 0, activo: false },
];

export const DEFAULT_ADOC_TRAMOS: AdocTramo[] = [
  { id: 1, label: 'Tramo A', ref: '1-5',  valor: 0, activo: false },
  { id: 2, label: 'Tramo B', ref: '6-10', valor: 0, activo: false },
  { id: 3, label: 'Tramo >C', ref: '>10', valor: 0, activo: false },
];
