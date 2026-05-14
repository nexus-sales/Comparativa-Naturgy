import * as XLSX from 'xlsx';
import type { SegCliente, TarifaLocal } from './calculations';
import { calc, fmtRaw } from './calculations';

export function exportExcel(
  segLabel: string,
  taxModel: string,
  potP: number,
  cliente: SegCliente,
  tariffs: TarifaLocal[]
): void {
  const selected = tariffs.filter(t => t.selected);
  if (!selected.length) return;

  const results = selected.map(t => ({ t, r: calc(taxModel, potP, cliente, t) }));
  const best = results.reduce((a, b) => b.r.total < a.r.total ? b : a, results[0]);
  const isPyme = taxModel !== 'res';

  const wb = XLSX.utils.book_new();

  const rowDefs: [string, string][] = isPyme ? [
    ['Coste potencia', 'potencia'],
    ['Coste energía', 'energia'],
    ['SVA', 'sva'],
    ['Alquiler', 'alquiler'],
    ['Subtotal', 'subtotal'],
    ['Imp. electricidad', 'impElec'],
    ['IGIC Reducido 3%', 'igicRed'],
    ['IGIC 7% alquiler', 'igic7'],
    ['Bono Social (ref.)', 'bonoSocial'],
  ] : [
    ['Coste potencia', 'potencia'],
    ['Coste energía', 'energia'],
    ['SVA', 'sva'],
    ['Alquiler', 'alquiler'],
    ['Subtotal', 'subtotal'],
    ['Imp. electricidad', 'impElec'],
    ['IGIC alquiler', 'igic'],
    ['Bono Social', 'bonoSocial'],
  ];

  const c = cliente;
  const rows: (string | number | null)[][] = [
    [`Comparativa Tarifas Naturgy — ${segLabel}`],
    [],
    ['Cliente:', c.nombre, 'CUPS:', c.cups],
    ['Dirección:', c.dir],
    ['Período:', `${c.f1} → ${c.f2}`, 'Días:', c.dias],
    [],
    ['Componente', 'Factura actual', ...results.map(x => x.t.nombre)],
    ...rowDefs.map(([lbl, key]) => [
      lbl,
      key === 'alquiler' ? +c.alquiler : null,
      ...results.map(x => {
        const val = (x.r as Record<string, unknown>)[key as string];
        return val !== undefined ? +(val as number) : null;
      }),
    ]),
    ['TOTAL ESTIMADO', +c.factura, ...results.map(x => +x.r.total)],
    [],
    ['Mejor opción:', best.t.nombre, `Total: ${fmtRaw(best.r.total)} €`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, ...results.map(() => ({ wch: 20 }))];
  XLSX.utils.book_append_sheet(wb, ws, 'Comparativa');

  const kwRows = c.kw.map((v, i) => v ? [`P${i + 1}`, v] : null).filter(Boolean) as [string, number][];
  const enRows = c.en.map((v, i) => v ? [`P${i + 1}`, v] : null).filter(Boolean) as [string, number][];

  const wsC = XLSX.utils.aoa_to_sheet([
    ['Datos del cliente'], [],
    ['Nombre', c.nombre], ['CUPS', c.cups], ['Dirección', c.dir],
    ['Lectura anterior', c.f1], ['Lectura actual', c.f2], ['Días', c.dias],
    [], ['POTENCIA (kW)'],
    ...kwRows,
    [], ['CONSUMO (kWh)'],
    ...enRows,
    [], ['Factura actual (€)', c.factura], ['Alquiler (€)', c.alquiler],
  ]);
  wsC['!cols'] = [{ wch: 24 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsC, 'Datos cliente');

  XLSX.writeFile(wb, `Comparativa_Naturgy_${segLabel.replace(/\s/g, '_')}.xlsx`);
}
