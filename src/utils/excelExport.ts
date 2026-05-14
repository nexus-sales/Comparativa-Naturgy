import type { CalcResult, SegCliente, TarifaLocal } from './calculations';
import { calc, fmtRaw } from './calculations';

export function exportExcel(
  segLabel: string,
  taxModel: string,
  potP: number,
  cliente: SegCliente,
  tariffs: TarifaLocal[]
): void {
  void exportExcelAsync(segLabel, taxModel, potP, cliente, tariffs);
}

async function exportExcelAsync(
  segLabel: string,
  taxModel: string,
  potP: number,
  cliente: SegCliente,
  tariffs: TarifaLocal[]
): Promise<void> {
  const selected = tariffs.filter(t => t.selected);
  if (!selected.length) return;

  const results = selected.map(t => ({ t, r: calc(taxModel, potP, cliente, t) }));
  const best = results.reduce((a, b) => b.r.total < a.r.total ? b : a, results[0]);
  const isPyme = taxModel !== 'res';

  const rowDefs: [string, keyof CalcResult][] = isPyme ? [
    ['Coste potencia', 'potencia'],
    ['Coste energia', 'energia'],
    ['SVA', 'sva'],
    ['Alquiler', 'alquiler'],
    ['Subtotal', 'subtotal'],
    ['Imp. electricidad', 'impElec'],
    ['IGIC Reducido 3%', 'igicRed'],
    ['IGIC 7% alquiler', 'igic7'],
    ['Bono Social (ref.)', 'bonoSocial'],
  ] : [
    ['Coste potencia', 'potencia'],
    ['Coste energia', 'energia'],
    ['SVA', 'sva'],
    ['Alquiler', 'alquiler'],
    ['Subtotal', 'subtotal'],
    ['Imp. electricidad', 'impElec'],
    ['IGIC alquiler', 'igic'],
    ['Bono Social', 'bonoSocial'],
  ];

  const c = cliente;
  const rows: (string | number | null)[][] = [
    [`Comparativa Tarifas Naturgy - ${segLabel}`],
    [],
    ['Cliente:', c.nombre, 'CUPS:', c.cups],
    ['Direccion:', c.dir],
    ['Periodo:', `${c.f1} -> ${c.f2}`, 'Dias:', c.dias],
    [],
    ['Componente', 'Factura actual', ...results.map(x => x.t.nombre)],
    ...rowDefs.map(([lbl, key]) => [
      lbl,
      key === 'alquiler' ? +c.alquiler : null,
      ...results.map(x => {
        const val = x.r[key];
        return val !== undefined ? +val : null;
      }),
    ]),
    ['TOTAL ESTIMADO', +c.factura, ...results.map(x => +x.r.total)],
    [],
    ['Mejor opcion:', best.t.nombre, `Total: ${fmtRaw(best.r.total)} EUR`],
  ];

  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Naturgy Comparativa';
  wb.created = new Date();

  const ws = wb.addWorksheet('Comparativa');
  ws.addRows(rows);
  ws.columns = [{ width: 28 }, { width: 16 }, ...results.map(() => ({ width: 20 }))];

  const kwRows = c.kw.map((v, i) => v ? [`P${i + 1}`, v] : null).filter(Boolean) as [string, number][];
  const enRows = c.en.map((v, i) => v ? [`P${i + 1}`, v] : null).filter(Boolean) as [string, number][];

  const wsC = wb.addWorksheet('Datos cliente');
  wsC.addRows([
    ['Datos del cliente'], [],
    ['Nombre', c.nombre], ['CUPS', c.cups], ['Direccion', c.dir],
    ['Lectura anterior', c.f1], ['Lectura actual', c.f2], ['Dias', c.dias],
    [], ['POTENCIA (kW)'],
    ...kwRows,
    [], ['CONSUMO (kWh)'],
    ...enRows,
    [], ['Factura actual (EUR)', c.factura], ['Alquiler (EUR)', c.alquiler],
  ]);
  wsC.columns = [{ width: 24 }, { width: 30 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Comparativa_Naturgy_${segLabel.replace(/\s/g, '_')}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
