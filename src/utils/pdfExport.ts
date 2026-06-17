/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-control-regex */
import { jsPDF } from 'jspdf';
import type { SegCliente, TarifaLocal, CalcResult } from './calculations';
import { calc } from './calculations';

const LOGO_B64 = 'data:image/png;base64,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';

export interface ComercialData {
  nombre: string;
  telefono: string;
  email: string;
}

const sanitize = (s: string | null | undefined): string =>
  String(s ?? '').trim().replace(/[\x00-\x1F\x7F]/g, '');

export function exportPDF(
  _segLabel: string,
  taxModel: string,
  potP: number,
  cliente: SegCliente,
  tariffs: TarifaLocal[],
  comercial: ComercialData,
  selectedTariffId?: string
) {
  const selectedTariff = selectedTariffId 
    ? tariffs.find(t => t.id === selectedTariffId)
    : tariffs.find(t => t.selected);
  
  if (!selectedTariff) { 
    alert('Selecciona una tarifa para exportar.'); 
    return; 
  }
  const isPyme = taxModel !== 'res';
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    if (idx > 0) doc.addPage();
  const r = calc(taxModel, potP, cliente, selectedTariff);
  pdfPage(doc, potP, cliente, selectedTariff, r, isPyme, comercial);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Propuesta_Naturgy_${(cliente.nombre || 'cliente').replace(/\s+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pdfPage(
  doc: jsPDF,
  potP: number,
  c: SegCliente,
  tar: TarifaLocal,
  r: CalcResult,
  isPyme: boolean,
  comercial: ComercialData
) {
  const L = 10, R = 200, CW = 190;
  const navy: [number, number, number] = [0, 40, 85];
  const or: [number, number, number] = [245, 130, 31];
  const wh: [number, number, number] = [255, 255, 255];
  const gr: [number, number, number] = [245, 245, 245];
  const bd: [number, number, number] = [190, 190, 190];
  const altGr: [number, number, number] = [250, 250, 250];
  const lbs = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
  const rh = 6.5;

  const fill = (col: [number, number, number]) => doc.setFillColor(...col);
  const stroke = (col: [number, number, number]) => doc.setDrawColor(...col);
  const color = (col: [number, number, number]) => doc.setTextColor(...col);
  const bold = (s?: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(s || 7.5); };
  const norm = (s?: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(s || 7); };
  const box = (x: number, y: number, w: number, h: number, fc?: [number, number, number], sc?: [number, number, number]) => {
    fill(fc || wh); stroke(sc || bd); doc.rect(x, y, w, h, 'FD');
  };
  const vl = (x: number, y: number, h: number) => doc.line(x, y, x, y + h);
  const tx = (t: string | number | null | undefined, x: number, y: number, opts?: object) =>
    doc.text(String(t === null || t === undefined ? '' : t), x, y, opts as any || {});
  const fmt = (v: number | null | undefined, d = 2) => {
    if (v == null || isNaN(+v)) return '-';
    const factor = 10 ** d;
    const truncated = Math.trunc((+v) * factor) / factor;
    const val = truncated.toFixed(d).replace('.', ',');
    const parts = val.split(',');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(',');
  };
  const fmtE = (v: number | null | undefined) => fmt(v) + ' €';

  let y = 15;

  // HEADER
  fill(wh); stroke(bd); doc.rect(L, y, 128, rh, 'FD');
  fill(navy); stroke(bd); doc.rect(L + 128, y, CW - 128, rh, 'FD');
  vl(L + 56, y, rh); vl(L + 128, y, rh);
  color(navy); bold(8); tx('PRESUPUESTO', L + 2, y + 4.5);
  color(or); bold(7.5); tx('CARGOS E IMPUESTOS  REDUCIDOS*', L + 58, y + 4.5);
  try { doc.addImage(LOGO_B64, 'PNG', L + 148, y + 0.5, 30, 6); } catch { color(wh); bold(10); tx('Naturgy', L + 148, y + 4.5); }
  y += rh;
  box(L, y, CW, rh); vl(L + 56, y, rh);
  color(navy); bold(8); tx(sanitize(tar.nombre), L + 2, y + 4.5);
  color([80, 80, 80] as any); norm(7); tx(sanitize(c.cups) || '—', L + 58, y + 4.5);
  y += rh;
  box(L, y, CW, rh);
  color(navy); bold(8); tx((sanitize(c.dir) || '—').substring(0, 72), L + 2, y + 4.5);
  y += rh;
  box(L, y, CW, rh); vl(L + 38, y, rh); vl(L + 68, y, rh);
  color([140, 140, 140] as any); norm(6.5); tx('Lectura anterior', L + 2, y + 4.5);
  color([30, 30, 30] as any); norm(7.5); tx(sanitize(c.f1) || '—', L + 40, y + 4.5);
  color(navy); bold(9); tx(sanitize(c.nombre) || '—', L + 70, y + 4.5);
  y += rh;
  box(L, y, CW, rh); vl(L + 38, y, rh); vl(L + 68, y, rh); vl(L + 132, y, rh);
  color([140, 140, 140] as any); norm(6.5); tx('Lectura actual', L + 2, y + 4.5);
  color([30, 30, 30] as any); norm(7.5); tx(c.f2 || '—', L + 40, y + 4.5);
  color([140, 140, 140] as any); norm(6.5); tx('FECHA OFERTA **', L + 70, y + 4.5);
  color(navy); bold(8); tx(new Date().toLocaleDateString('es-ES'), L + 134, y + 4.5);
  y += rh + 2;

  // POTENCIA
  fill(or); stroke(or); doc.rect(L, y, CW, 6, 'F');
  color(wh); bold(8.5); tx('POTENCIA', L + 2, y + 4.2);
  y += 6;
  box(L, y, CW, 6, gr); vl(L + 45, y, 6); vl(L + 65, y, 6); vl(L + 110, y, 6);
  color([80, 80, 80] as any); bold(6.5); tx(tar.potUnit === 'dia' ? '€/kW·día' : '€/kW·año', L + 2, y + 4);
  tx('Días', L + 47, y + 4);
  y += 6;

  const safeKw = Array.isArray(c.kw) ? c.kw : [0, 0, 0, 0, 0, 0];
  const safeEn = Array.isArray(c.en) ? c.en : [0, 0, 0, 0, 0, 0];

  for (let i = 0; i < potP; i++) {
    const rate = tar.rPot[i] || 0, kw = safeKw[i] || 0;
    if (!rate && !kw) continue;
    box(L, y, CW, rh, i % 2 ? altGr : wh); vl(L + 45, y, rh); vl(L + 65, y, rh); vl(L + 110, y, rh);
    color([30, 30, 30] as any); norm(7); tx(fmt(rate, 6), L + 2, y + 4.5); tx(fmt(c.dias || 0, 0), L + 47, y + 4.5);
    bold(8); tx(lbs[i], L + 67, y + 4.5);
    y += rh;
  }

  const dias = c.dias || 1;
  const periods: [string, number][] = potP === 2 ? [['PUNTA', 0], ['VALLE', 1]] : lbs.slice(0, potP).map((lb, i) => [lb, i] as [string, number]);
  periods.forEach(([lbl, i]) => {
    const rate = tar.rPot[i] || 0, kw = safeKw[i] || 0;
    if (!rate || !kw) return;
    const cost = tar.potUnit === 'dia' ? rate * kw * dias : (rate / 365) * kw * dias;
    const unitCost = tar.potUnit === 'dia' ? rate * kw : (rate / 365) * kw;
    box(L, y, CW, rh, i % 2 ? altGr : wh);
    vl(L + 22, y, rh); vl(L + 34, y, rh); vl(L + 110, y, rh); vl(L + 155, y, rh);
    color([30, 30, 30] as any); bold(7.5); tx(lbl, L + 2, y + 4.5);
    norm(7); tx(fmt(kw, 3).replace(/,000$/, ''), L + 28, y + 4.5, { align: 'center' });
    tx(fmt(unitCost, 9).replace(/,?0+$/, ''), L + 36, y + 4.5);
    bold(7.5); tx('COSTE ' + lbl, L + 112, y + 4.5);
    color(navy); tx(fmtE(cost), R - 2, y + 4.5, { align: 'right' });
    y += rh;
  });

  color([140, 140, 140] as any); norm(6);
  tx('Creado para Cris Energy. @ todos los derechos reservados', L, y + 5);
  y += 6;

  fill([255, 244, 230] as any); stroke(or); doc.rect(L, y, CW, 7, 'FD'); vl(L + 110, y, 7);
  color(navy); bold(8.5); tx('COSTE POTENCIA', L + 112, y + 5);
  color(or); bold(11); tx(fmtE(r.potencia), R - 2, y + 5.5, { align: 'right' });
  y += 7 + 2;

  // CONSUMO
  fill(or); stroke(or); doc.rect(L, y, CW, 6, 'F');
  color(wh); bold(8.5); tx('CONSUMO', L + 2, y + 4.2);
  y += 6;
  box(L, y, CW, 6, gr); vl(L + 40, y, 6); vl(L + 58, y, 6); vl(L + 110, y, 6); vl(L + 155, y, 6);
  color([80, 80, 80] as any); bold(6.5); tx('kWh', L + 2, y + 4); tx('€/kWh', L + 60, y + 4);
  y += 6;

  const nEn = { uni: 1, tri: 3, tri6: 3, hex: 6 }[tar.tipo] || 1;
  for (let i = 0; i < nEn; i++) {
    const kwh = tar.tipo === 'uni' ? safeEn.reduce((a, v) => a + (+v || 0), 0) : (safeEn[i] || 0);
    const rate = tar.rEn[i] || 0;
    if (!kwh && i > 0) continue;
    box(L, y, CW, rh, i % 2 ? altGr : wh);
    vl(L + 40, y, rh); vl(L + 58, y, rh); vl(L + 110, y, rh); vl(L + 155, y, rh);
    color([30, 30, 30] as any); norm(7);
    tx(fmt(kwh, 2), L + 2, y + 4.5);
    bold(8); tx(lbs[i], L + 42, y + 4.5);
    norm(7); tx(fmt(rate, 6).replace(/,?0+$/, '') + ' €', L + 60, y + 4.5);
    if (i === 0) { bold(7.5); color(navy); tx('COSTE ENERGÍA', L + 112, y + 4.5); tx(fmtE(r.energia), R - 2, y + 4.5, { align: 'right' }); }
    y += rh;
  }


  // ENERGÍA REACTIVA (solo hex/pyme361 cuando r.reactiva > 0)
  if (potP === 6 && r.reactiva && r.reactiva > 0) {
    fill(or); stroke(or); doc.rect(L, y, CW, 6, 'F');
    color(wh); bold(8.5); tx('ENERGÍA REACTIVA', L + 2, y + 4.2);
    y += 6;
    box(L, y, CW, 6, gr); vl(L + 40, y, 6); vl(L + 58, y, 6); vl(L + 110, y, 6); vl(L + 155, y, 6);
    color([80, 80, 80] as any); bold(6.5); tx('kVArh exceso', L + 2, y + 4); tx('€/kVArh', L + 60, y + 4);
    y += 6;
    const safeReactiva = c.reactiva || [];
    const safeReactivaRate = c.reactivaRate || [];
    let rvi = 0;
    for (let i = 0; i < 6; i++) {
      const kvarh = +(safeReactiva[i] || 0);
      const rate = +(safeReactivaRate[i] || 0);
      if (!kvarh && !rate) continue;
      const costI = kvarh * rate;
      box(L, y, CW, rh, rvi % 2 ? altGr : wh);
      vl(L + 40, y, rh); vl(L + 58, y, rh); vl(L + 110, y, rh); vl(L + 155, y, rh);
      color([30, 30, 30] as any); norm(7);
      tx(fmt(kvarh, 3), L + 2, y + 4.5);
      bold(8); tx(lbs[i], L + 42, y + 4.5);
      norm(7); tx(fmt(rate, 6).replace(/,?0+$/, '') + ' €', L + 60, y + 4.5);
      color(navy); bold(7.5); tx(fmtE(costI), R - 2, y + 4.5, { align: 'right' });
      rvi++; y += rh;
    }
    fill([255, 244, 230] as any); stroke(or); doc.rect(L, y, CW, 7, 'FD'); vl(L + 110, y, 7);
    color(navy); bold(8.5); tx('COSTE REACTIVA', L + 112, y + 5);
    color(or); bold(11); tx(fmtE(r.reactiva), R - 2, y + 5.5, { align: 'right' });
    y += 7 + 2;
  }

    // DESGLOSE
  const lineItems: [string | null, number | null, boolean][] = isPyme ? [
    ['SIN SVA', r.sva || 0, false], ['ALQUILER', r.alquiler, false], [null, null, false],
    ['SUBTOTAL', r.subtotal, true], ['IMPUESTO ELEC.', r.impElec, false],
    ['BASE IMPONIBLE', r.alquiler, false], ['IGIC Reducido', r.igicRed ?? null, false],
    ['IGIC 7% alquiler', r.igic7 ?? null, false], ['FINANCIACIÓN', null, false], ['BONO SOCIAL', r.bonoSocial, false],
  ] : [
    ['SIN SVA', r.sva || 0, false], ['ALQUILER', r.alquiler, false], [null, null, false],
    ['SUBTOTAL', r.subtotal, true], ['IMPUESTO ELEC.', r.impElec, false],
    ['BASE IMPONIBLE', r.alquiler, false], ['IGIC', r.igic ?? null, false],
    ['FINANCIACIÓN', null, false], ['BONO SOCIAL', r.bonoSocial, false],
  ];

  let ri = 0;
  lineItems.forEach(([lbl, val, isBold]) => {
    if (lbl === null) { y += 1.5; return; }
    box(L, y, CW, rh, ri % 2 ? altGr : wh); vl(L + 155, y, rh);
    if (isBold) { color(navy); bold(7.5); } else { color([50, 50, 50] as any); norm(7); }
    tx(lbl, L + 2, y + 4.5);
    if (val !== null && val !== undefined) { color(navy); bold(7.5); tx(fmtE(val), R - 2, y + 4.5, { align: 'right' }); }
    ri++; y += rh;
  });

  // Compensación excedentes
  box(L, y, CW, rh, ri % 2 ? altGr : wh); vl(L + 105, y, rh); vl(L + 130, y, rh); vl(L + 155, y, rh);
  color([10, 100, 10] as any); bold(6.5); tx('COMPENSACIÓN DE EXCEDENTES', L + 2, y + 4.5);
  norm(7); tx(fmt(c.enExc || 0, 0), L + 107, y + 4.5); tx(fmt(c.excedenteRate || 0, 3).replace(/,?0+$/, ''), L + 132, y + 4.5);
  color(navy); bold(7.5); tx(fmtE(r.excedentes || 0), R - 2, y + 4.5, { align: 'right' });
  y += rh;

  // TOTAL
  fill([255, 244, 230] as any); stroke(or); doc.rect(L, y, CW, 9, 'FD'); vl(L + 110, y, 9);
  color(navy); bold(10); tx('TOTAL', L + 2, y + 6);
  color(or); bold(14); tx(fmtE(r.total), R - 2, y + 6.5, { align: 'right' });
  y += 9 + 1;

  // ATENDIDO POR / AHORRO
  const ahorro = +(c.factura - r.total).toFixed(2);
  const pct = c.factura > 0 ? Math.abs(Math.round((ahorro / c.factura) * 100)) : 0;
  const ahCol: [number, number, number] = ahorro >= 0 ? [6, 95, 70] : [220, 38, 38];
  box(L, y, CW, 9); vl(L + 68, y, 9); vl(L + 132, y, 9);
  color([120, 120, 120] as any); norm(6); tx('ATENDIDO POR:', L + 2, y + 3.5);
  color([20, 20, 20] as any); bold(7.5); tx(sanitize(comercial.nombre) || '', L + 2, y + 7.5);
  if (comercial.telefono) { color([100, 100, 100] as any); norm(6); tx(sanitize(comercial.telefono), L + 36, y + 7.5); }
  color([120, 120, 120] as any); norm(6); tx('FACTURA CLIENTE', L + 70, y + 3.5);
  color(navy); bold(10); tx(fmtE(c.factura), L + 130, y + 8, { align: 'right' });
  color([120, 120, 120] as any); norm(6); tx('AHORRO', L + 134, y + 3.5);
  if (ahorro > 0.001) {
    color(ahCol); bold(10); tx('- ' + fmtE(Math.abs(ahorro)), R - 2, y + 8, { align: 'right' });
  } else if (ahorro < -0.001) {
    color(ahCol); bold(10); tx('+ ' + fmtE(Math.abs(ahorro)), R - 2, y + 8, { align: 'right' });
  } else {
    color([150, 150, 150] as any); bold(10); tx('SIN DIF.', R - 2, y + 8, { align: 'right' });
  }
  y += 9;
  fill([255, 244, 230] as any); stroke(or); doc.rect(L, y, CW, 7, 'FD'); vl(L + 68, y, 7);
  color(or); bold(7.5); tx(ahorro < -0.01 ? 'NATURGY PUEDE MEJORAR SU FACTURA' : '**OFERTA TIEMPO LIMITADO', L + 2, y + 4.5);
  color([100, 100, 100] as any); norm(7); tx('AHORRO ESTIMADO', L + 70, y + 4.5);
  if (ahorro > 0.001) {
    color(ahCol); bold(9); tx('-' + pct + '%', R - 2, y + 4.5, { align: 'right' });
  } else if (ahorro < -0.001) {
    color(ahCol); bold(9); tx('+' + pct + '%', R - 2, y + 4.5, { align: 'right' });
  } else {
    color([150, 150, 150] as any); bold(9); tx('0%', R - 2, y + 4.5, { align: 'right' });
  }
  y += 7 + 3;

  color([140, 140, 140] as any); norm(6);
  const gdpr = 'En cumplimiento del RGPD (Reglamento UE 2016/679) y la LOPDGDD 3/2018, le informamos que sus datos son tratados con la máxima confidencialidad y únicamente para la elaboración de esta comparativa eléctrica profesional.';
  const glines = doc.splitTextToSize(gdpr, CW);
  doc.text(glines, L, y);
  y += glines.length * 3;

  const disc = 'La presente comparativa es estimativa, sirve únicamente para dar una idea a nuestro cliente sobre cómo se le facturará con NATURGY S.A. este documento no es vinculante, puede variar según lecturas reales/estimadas del cliente. Nos basamos únicamente en la información de factura aportada por el cliente.';
  const dlines = doc.splitTextToSize(disc, CW);
  doc.text(dlines, L, y);
  y += dlines.length * 3.2 + 4;
  if (comercial.email) { color([100, 100, 100] as any); norm(6.5); tx(comercial.email, L + 70, y); y += 5; }

  color([140, 140, 140] as any); norm(6);
  tx('Creado para Cris Energy. @ todos los derechos reservados', L, y);
  y += 5;

  y = Math.max(y, 260); // Empujar el cuadro de firma hacia abajo si hay espacio

  box(L, y, CW, 18); vl(L + 95, y, 18);
  color([100, 100, 100] as any); norm(7); tx('RECIBIDO', L + 2, y + 6);
  doc.line(L + 5, y + 13, L + 93, y + 13);
  color([50, 50, 50] as any); bold(8); tx(new Date().toLocaleDateString('es-ES'), L + 20, y + 16.5);
}
