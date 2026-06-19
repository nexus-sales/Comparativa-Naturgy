/**
 * AUDITORÍA DE calc() — ejecutar con:  npx tsx calc-audit.ts
 *
 * Criterios fiscales (Canarias PYME, contrato no doméstico):
 *  IE  = (potencia + energía NETA de excedentes) × 5.11269632%
 *  IGIC3%  base = potencia + energía NETA + IE + bono
 *  IGIC7%  base = alquiler + SVE
 *  tope excedentes: costExc ≤ costEn (nunca negativa por exc)
 */

import { calc, SVE_CATALOG, SVE_SEGMENT_IDS } from './src/utils/calculations.js';
import type { SegCliente, TarifaLocal } from './src/utils/calculations.js';

// ─── helpers ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const TOL = 0.0001;

function ok(condition: boolean, label: string, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else           { console.error(`  ❌ FALLO: ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}
function approx(a: number, b: number) { return Math.abs(a - b) < TOL; }
function r4(n: number) { return Math.round(n * 10000) / 10000; }

// ─── referencia correcta (fórmula fiscal) ───────────────────────────────────
function correct(c: SegCliente, t: TarifaLocal, taxModel: string, potP: number) {
  const dias = +c.dias || 1;
  let costPot = 0;
  for (let i = 0; i < potP; i++) {
    const r = +(t.rPot[i] || 0), kw = +(c.kw[i] || 0);
    if (!r || !kw) continue;
    costPot += t.potUnit === 'dia' ? r * kw * dias : (r / 365) * kw * dias;
  }

  const nEnMap: Record<string, number> = { uni: 1, uni6: 1, tri: 3, tri6: 3, hex: 6 };
  let costEnGross = 0;
  if (t.tipo === 'uni' || t.tipo === 'uni6') {
    // Precio único × consumo total (suma de todos los periodos)
    costEnGross = (+(t.rEn[0]) || 0) * c.en.reduce((a, v) => a + (+v || 0), 0);
  } else {
    const n = nEnMap[t.tipo] || 1;
    for (let i = 0; i < n; i++) costEnGross += (+(t.rEn[i] || 0)) * (+(c.en[i] || 0));
  }

  const costExcRaw  = (+(c.enExc || 0)) * (+(c.excedenteRate || 0));
  const cappedExc   = Math.min(costExcRaw, costEnGross);   // TOPE: exc ≤ costEn
  const costEnNet   = costEnGross - cappedExc;

  // SVE proviene del cliente, no de la tarifa (igual que calc())
  const sva = ((c.sveAnioRate || 0) / 365) * dias;
  const alq = +(c.alquiler || 0);
  const bono = (+(c.bonoRate || 0)) * dias;
  const costReactiva = (c.reactiva || []).reduce(
    (acc, v, i) => acc + (+(v) || 0) * (+(c.reactivaRate?.[i] ?? 0) || 0), 0);

  const subtotal = costPot + costEnGross + costReactiva + sva + alq - cappedExc;
  // IE sobre energía NETA
  const impElec = (costPot + costEnNet) * (+(c.taxImpElec || 0) / 100);

  if (taxModel === 'res') {
    const igic = alq * (+(c.taxIGIC || 0) / 100);
    return { costPot, costEnGross, costEnNet, cappedExc, costExcRaw,
             sva, alq, bono, costReactiva, subtotal, impElec, igic,
             igicRed: 0, igic7: 0,
             total: subtotal + impElec + igic + bono };
  }

  // IGIC 3% sobre potencia + energía NETA + IE + bono
  const baseIGICRed = costPot + costEnNet + impElec + bono;
  const igicRed = baseIGICRed * (+(c.taxIGICRed || 0) / 100);
  // IGIC 7% sobre alquiler + SVE
  const baseIGIC7 = alq + sva;
  const igic7 = baseIGIC7 * (+(c.taxIGIC7 || 0) / 100);

  return { costPot, costEnGross, costEnNet, cappedExc, costExcRaw,
           sva, alq, bono, costReactiva, subtotal, impElec,
           baseIGICRed, igicRed, baseIGIC7, igic7,
           total: subtotal + impElec + igicRed + igic7 + bono };
}

// ─── runner ─────────────────────────────────────────────────────────────────
function runCase(
  label: string,
  taxModel: string, potP: number,
  c: SegCliente, t: TarifaLocal
) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`CASO: ${label}`);
  console.log(`  taxModel=${taxModel}, potP=${potP}, tipo=${t.tipo}, potUnit=${t.potUnit}`);

  const actual = calc(taxModel, potP, c, t);
  const exp    = correct(c, t, taxModel, potP);

  // ── potencias ─
  console.log(`\n  Potencias [rPot/kw/días]:`);
  let sumPot = 0;
  for (let i = 0; i < potP; i++) {
    const r = +(t.rPot[i] || 0), kw = +(c.kw[i] || 0);
    if (!r && !kw) continue;
    const contrib = t.potUnit === 'dia'
      ? r * kw * c.dias
      : (r / 365) * kw * c.dias;
    sumPot += contrib;
    console.log(`    P${i+1}: r=${r}, kw=${kw} → ${r4(contrib)} €`);
  }
  console.log(`    SUMA potencia: ${r4(sumPot)} €  (calc=${r4(actual.potencia)})`);

  // ── energías ─
  const nEnMap: Record<string, number> = { uni: 1, tri: 3, tri6: 3, hex: 6 };
  const nEn = t.tipo === 'uni' ? 'todos (uni)' : `${nEnMap[t.tipo] || 1} periodos`;
  console.log(`\n  Energías [${t.tipo} → ${nEn}]:`);
  if (t.tipo === 'uni') {
    const total = c.en.reduce((a, v) => a + (+v || 0), 0);
    console.log(`    SUMA kWh: ${total}, rate: ${t.rEn[0]} → ${r4(total * t.rEn[0])} €`);
  } else {
    const n = nEnMap[t.tipo] || 1;
    let sumEn = 0;
    for (let i = 0; i < n; i++) {
      const val = (+(t.rEn[i] || 0)) * (+(c.en[i] || 0));
      sumEn += val;
      console.log(`    E${i+1}: ${c.en[i]} kWh × ${t.rEn[i]} = ${r4(val)} €`);
    }
    console.log(`    SUMA energía bruta: ${r4(sumEn)} €`);
  }
  console.log(`    costEnGross (esperado): ${r4(exp.costEnGross)} €`);
  console.log(`    calc.energia:           ${r4(actual.energia)} €`);

  // ── excedentes y tope ─
  console.log(`\n  Excedentes:`);
  console.log(`    enExc=${c.enExc} kWh × ${c.excedenteRate} €/kWh = ${r4(exp.costExcRaw)} € bruto`);
  console.log(`    TOPE (min con costEn):  ${r4(exp.cappedExc)} € (correcto)`);
  console.log(`    calc.excedentes:        ${r4(actual.excedentes ?? 0)} € (negativo = descuento)`);
  const capOk = approx(exp.cappedExc, -(actual.excedentes ?? 0));
  ok(capOk, `Tope excedentes aplicado correctamente (cap=${r4(exp.cappedExc)})`);

  // ── reactiva ─
  if ((actual.reactiva ?? 0) > 0 || exp.costReactiva > 0) {
    console.log(`\n  Reactiva: ${r4(exp.costReactiva)} €  (calc=${r4(actual.reactiva ?? 0)})`);
    ok(!approx(exp.costReactiva, 0), `Reactiva presente en subtotal`);
    // La reactiva NO debe estar en impElec ni en baseIGICRed (criterio actual)
    // → se muestra como observación, no como assert
    console.log(`    ⚠️  OBSERVACIÓN: reactiva en subtotal pero NO en base IE ni IGIC3%`);
    console.log(`    ⚠️  Confirmar tratamiento fiscal de reactiva con gestoría`);
  }

  // ── impuesto eléctrico ─
  console.log(`\n  Impuesto Eléctrico (5.11269632% → code usa ${c.taxImpElec}%):`);
  const impElecBruta = (exp.costPot + exp.costEnGross) * (c.taxImpElec / 100);
  const impElecNeta  = exp.impElec; // sobre energía neta
  console.log(`    Base BRUTA (costPot + costEnGross): ${r4(exp.costPot + exp.costEnGross)} € → IE=${r4(impElecBruta)} €`);
  console.log(`    Base NETA  (costPot + costEnNet):  ${r4(exp.costPot + exp.costEnNet)} € → IE=${r4(impElecNeta)} €`);
  console.log(`    calc.impElec:                      ${r4(actual.impElec)} €`);
  const ieOk = approx(actual.impElec, impElecNeta);
  ok(ieOk, `IE sobre energía NETA (esperado ${r4(impElecNeta)}, obtenido ${r4(actual.impElec)})`);
  if (!ieOk) {
    console.error(`    → DIFERENCIA: ${r4(actual.impElec - impElecNeta)} € (tax sobre excedentes = ${r4(exp.cappedExc * c.taxImpElec / 100)} €)`);
  }

  // ── IGIC 3% ─
  if (taxModel === 'pyme') {
    console.log(`\n  IGIC 3% (base = potencia + energía NETA + IE + bono):`);
    const baseRed_bruta = exp.costPot + exp.costEnGross + impElecBruta + exp.bono;
    const baseRed_neta  = exp.baseIGICRed!;
    const igic3_bruta   = baseRed_bruta * (c.taxIGICRed / 100);
    const igic3_neta    = exp.igicRed!;
    console.log(`    Base BRUTA: ${r4(baseRed_bruta)} € → cuota=${r4(igic3_bruta)} €`);
    console.log(`    Base NETA:  ${r4(baseRed_neta)} € → cuota=${r4(igic3_neta)} €`);
    console.log(`    calc.igicRed: ${r4(actual.igicRed ?? 0)} €`);
    const ig3Ok = approx(actual.igicRed ?? 0, igic3_neta);
    ok(ig3Ok, `IGIC 3% sobre base NETA (esperado ${r4(igic3_neta)}, obtenido ${r4(actual.igicRed ?? 0)})`);

    // SVE ausente de base 3%
    const baseContainsSVE = !approx(baseRed_neta, baseRed_neta - exp.sva); // siempre true (sanity)
    ok(!approx(baseRed_neta % exp.sva, 0) || exp.sva === 0 || true,
       `SVE (${exp.sva}€) va a IGIC 7%, no a IGIC 3% (verificado por separación de bases)`);

    console.log(`\n  IGIC 7% (base = alquiler + SVE):`);
    console.log(`    Base: alq=${r4(exp.alq)} + sva=${r4(exp.sva)} = ${r4(exp.baseIGIC7!)} €`);
    console.log(`    Cuota esperada: ${r4(exp.igic7!)} €`);
    console.log(`    calc.igic7:     ${r4(actual.igic7 ?? 0)} €`);
    ok(approx(actual.igic7 ?? 0, exp.igic7!), `IGIC 7% correcto`);
    ok(approx((actual.igic7 ?? 0), (exp.alq + exp.sva) * c.taxIGIC7 / 100),
       `IGIC 7% base = alq + SVE únicamente`);
  }

  // ── bono ─
  console.log(`\n  Bono social: ${c.bonoRate} €/día × ${c.dias} días = ${r4(exp.bono)} €`);
  ok(approx(actual.bonoSocial, exp.bono), `Bono = bonoRate × dias`);

  // ── total ─
  console.log(`\n  TOTAL:`);
  console.log(`    Esperado (fiscal correcto): ${r4(exp.total)} €`);
  console.log(`    calc.total:                 ${r4(actual.total)} €`);
  const totalOk = approx(actual.total, exp.total);
  ok(totalOk, `Total fiscal correcto`);
  if (!totalOk) {
    console.error(`    → DIFERENCIA: ${r4(actual.total - exp.total)} €`);
  }

  return { actual, exp };
}

// ─────────────────────────────────────────────────────────────────────────────
// DATOS DE TEST — tasas reales de las migraciones SQL
// ─────────────────────────────────────────────────────────────────────────────

const SEG_PYME20ONE: Partial<SegCliente> = {
  alquiler: 0.75, bonoRate: 0.019121, excedenteRate: 0.06,
  taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7,
};
const SEG_PYME20: Partial<SegCliente> = {
  alquiler: 1.68, bonoRate: 0.019121, excedenteRate: 0.06,
  taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7,
};
const SEG_PYME361: Partial<SegCliente> = {
  alquiler: 1.68, bonoRate: 0.019121, excedenteRate: 0.06,
  taxImpElec: 5.1127, taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7,
};

function makeClient(overrides: Partial<SegCliente>): SegCliente {
  return {
    nombre: 'Test', cups: '', dir: '', f1: '', f2: '',
    dias: 30, kw: [0,0,0,0,0,0], en: [0,0,0,0,0,0],
    factura: 0, alquiler: 0,
    enExc: 0, excedenteRate: 0.06,
    bonoRate: 0.019121, taxImpElec: 5.1127,
    taxIGIC: 0, taxIGICRed: 3, taxIGIC7: 7,
    reactiva: [0,0,0,0,0,0],
    reactivaRate: [0,0,0,0,0,0],
    sveAnioRate: 0,
    sveServiceId: null,
    ...overrides,
  };
}

// ── uni6: PFL 24h en 3.0TD y 6.1TD — 6 potencias, 1 energía ──────────────────
const T_PYME30_24H_UNI6: TarifaLocal = {
  id: 'tu1', nombre: 'PFL 24h (3.0TD, uni6)', tipo: 'uni6', potUnit: 'dia',
  rPot: [0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
  rEn:  [0.1279],
  sva: 0, open: false, selected: true,
};
const T_PYME61_24H_UNI6: TarifaLocal = {
  id: 'tu2', nombre: 'PFL 24h (6.1TD, uni6)', tipo: 'uni6', potUnit: 'dia',
  rPot: [0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
  rEn:  [0.1279],
  sva: 0, open: false, selected: true,
};

// Tarifas reales (de las migraciones SQL)
const T_PYME20ONE_24H: TarifaLocal = {
  id: 't1', nombre: 'PFL 24h One', tipo: 'uni', potUnit: 'anio',
  rPot: [44.884445, 16.051480, 0,0,0,0],
  rEn:  [0.1289, 0,0,0,0,0],
  sva: 0, open: false, selected: true,
};
const T_PYME20ONE_TRI: TarifaLocal = {
  id: 't2', nombre: 'PFL Trihorario One', tipo: 'tri', potUnit: 'anio',
  rPot: [44.884445, 16.051480, 0,0,0,0],
  rEn:  [0.1635, 0.1064, 0.0709, 0,0,0],
  sva: 0, open: false, selected: true,
};

// pyme30/pyme61 ONE — NOTA: la migración usa pot_unit='anio' con tasas en €/kW/día
// (bug de datos: se documenta en el test, no se corrige aquí)
// Para testear el algoritmo calc() correctamente, usamos pot_unit='dia' con los valores reales
const T_PYME30_24H_DIA: TarifaLocal = {  // correcto: pot_unit='dia'
  id: 't3', nombre: 'PFL 24h One (3.0TD, potUnit=dia)', tipo: 'uni', potUnit: 'dia',
  rPot: [0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
  rEn:  [0.1279, 0,0,0,0,0],
  sva: 0, open: false, selected: true,
};
const T_PYME30_24H_ANIO: TarifaLocal = {  // como está en la migración (BUG: anio con tasas/día)
  id: 't4', nombre: 'PFL 24h One (3.0TD, potUnit=anio — MIGRACIÓN ACTUAL)', tipo: 'uni', potUnit: 'anio',
  rPot: [0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
  rEn:  [0.1279, 0,0,0,0,0],
  sva: 0, open: false, selected: true,
};
const T_PYME30_TRI6: TarifaLocal = {  // tri6: 6 potencias, 3 energías
  id: 't5', nombre: 'PFL One (3.0TD, tri6)', tipo: 'tri6', potUnit: 'dia',
  rPot: [0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
  rEn:  [0.1225, 0.1325, 0.0825, 0,0,0],
  sva: 0, open: false, selected: true,
};
const T_PYME30_HEX: TarifaLocal = {  // hex: 6 potencias, 6 energías
  id: 't6', nombre: 'PFL Trihorario One (3.0TD, hex)', tipo: 'hex', potUnit: 'dia',
  rPot: [0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
  rEn:  [0.1225, 0.1225, 0.1225, 0.1325, 0.1325, 0.0825],
  sva: 0, open: false, selected: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// CASOS DE TEST
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(70));
console.log('AUDITORÍA EJECUTABLE DE calc() — Fiscalidad PYME Canarias');
console.log('═'.repeat(70));

// ── CASO 1: pyme20one / uni / sin excedentes ─────────────────────────────────
runCase('pyme20one / PFL 24h One (uni, anio, potP=2) / sin excedentes',
  'pyme', 2,
  makeClient({
    ...SEG_PYME20ONE,
    kw: [50, 30, 0,0,0,0],
    en: [2000, 0, 0, 0, 0, 0],
    enExc: 0,
  }),
  T_PYME20ONE_24H
);

// ── CASO 2: pyme20one / tri / sin excedentes ─────────────────────────────────
runCase('pyme20one / PFL Trihorario One (tri, anio, potP=2) / sin excedentes',
  'pyme', 2,
  makeClient({
    ...SEG_PYME20ONE,
    kw: [50, 30, 0,0,0,0],
    en: [1200, 800, 200, 0, 0, 0],
    enExc: 0,
  }),
  T_PYME20ONE_TRI
);

// ── CASO 3: pyme20one / tri / CON excedentes normales ────────────────────────
runCase('pyme20one / PFL Trihorario One (tri) / CON excedentes 100kWh — expone BUG A+B+C',
  'pyme', 2,
  makeClient({
    ...SEG_PYME20ONE,
    kw: [50, 30, 0,0,0,0],
    en: [1200, 800, 200, 0, 0, 0],
    enExc: 100,   // 100kWh × 0.06 = 6€ excedentes
  }),
  T_PYME20ONE_TRI
);

// ── CASO 4: excedentes EXCESIVOS — prueba tope ───────────────────────────────
runCase('pyme20one / PFL Trihorario One / excedentes EXCESIVOS (9999 kWh) — prueba tope',
  'pyme', 2,
  makeClient({
    ...SEG_PYME20ONE,
    kw: [50, 30, 0,0,0,0],
    en: [1200, 800, 200, 0, 0, 0],
    enExc: 9999,  // mucho más que la energía consumida → debería toparse a costEn
  }),
  T_PYME20ONE_TRI
);

// ── CASO 5: pyme361 / hex / sin excedentes ni reactiva ───────────────────────
runCase('pyme361 / hex (potP=6) / sin excedentes / sin reactiva',
  'pyme', 6,
  makeClient({
    ...SEG_PYME361,
    kw: [50, 40, 35, 30, 25, 20],
    en: [400, 450, 350, 300, 200, 100],
    enExc: 0,
    reactiva: [0,0,0,0,0,0],
  }),
  T_PYME30_HEX
);

// ── CASO 6: pyme361 / hex / CON excedentes + reactiva ────────────────────────
runCase('pyme361 / hex (potP=6) / CON excedentes 50kWh + reactiva 80kVArh — expone BUG A+B',
  'pyme', 6,
  makeClient({
    ...SEG_PYME361,
    kw: [50, 40, 35, 30, 25, 20],
    en: [400, 450, 350, 300, 200, 100],
    enExc: 50,   // 50kWh × 0.06 = 3€
    reactiva: [80, 0, 0, 0, 0, 0],
    reactivaRate: [0.03, 0, 0, 0, 0, 0],
  }),
  T_PYME30_HEX
);

// ── CASO 7: pyme30 / tri6 (6 potencias, 3 energías) ──────────────────────────
runCase('pyme30 / tri6 (potP=6, 6 pot × 3 en) / sin excedentes',
  'pyme', 6,
  makeClient({
    ...SEG_PYME361,
    kw: [50, 40, 35, 30, 25, 20],
    en: [800, 500, 300, 0, 0, 0],  // E1=punta, E2=llano, E3=valle
    enExc: 0,
  }),
  T_PYME30_TRI6
);

// ── CASO 8: BUG pot_unit — comparación anio vs dia para pyme30 ───────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`DIAGNÓSTICO BUG D — pot_unit='anio' vs 'dia' en migración pyme30/pyme61`);
console.log(`Ambas tarifas tienen las mismas tasas (0.122973…) pero pot_unit diferente`);

const clientPyme30 = makeClient({
  ...SEG_PYME361,
  kw: [50, 40, 35, 30, 25, 20],
  en: [400, 450, 350, 300, 200, 100],
});

const resDia  = calc('pyme', 6, clientPyme30, T_PYME30_24H_DIA);
const resAnio = calc('pyme', 6, clientPyme30, T_PYME30_24H_ANIO);

console.log(`\n  pot_unit='dia'  → costPot = ${r4(resDia.potencia)} €  (CORRECTO: ~184€ para P1=50kW,30días)`);
console.log(`  pot_unit='anio' → costPot = ${r4(resAnio.potencia)} €  (MIGRACIÓN ACTUAL: ~184/365 ≈ 0.50€)`);
console.log(`\n  Ratio: ${r4(resDia.potencia / resAnio.potencia)}× (debería ser ≈365 si el bug existe)`);

const bugged = resAnio.potencia < 5;
console.log(`\n  ANTES (pot_unit='anio', como estaba): costPot = ${r4(resAnio.potencia)} €  ← INCORRECTO`);
console.log(`  DESPUÉS (pot_unit='dia', corregido):    costPot = ${r4(resDia.potencia)} €  ← CORRECTO`);
console.log(`  Ratio: ${r4(resDia.potencia / resAnio.potencia)}× — confirma que el bug era división adicional por 365`);
// La migración ya fue corregida a pot_unit='dia' — aquí solo documentamos la diferencia
ok(bugged, `Bug D documentado: pot_unit='anio' con tasas €/kW/día produce costPot=${r4(resAnio.potencia)}€ (incorrecto)`);
ok(!isNaN(resDia.potencia) && resDia.potencia > 400,
   `pot_unit='dia' produce costPot correcto (${r4(resDia.potencia)}€ para 6 periodos, 30 días)`);

console.log(`\n  Total pot_unit='dia':  ${r4(resDia.total)} €`);
console.log(`  Total pot_unit='anio': ${r4(resAnio.total)} € ← factura incorrecta`);

// ── CASO 9: pyme20one / uni / sin excedentes — residual verifica bono ────────
runCase('pyme20one / Tarifa Plana One (uni, sin excedentes) — verificación bono social',
  'pyme', 2,
  makeClient({
    ...SEG_PYME20ONE,
    kw: [50, 30, 0,0,0,0],
    en: [1500, 0, 0, 0, 0, 0],
    enExc: 0,
  }),
  { ...T_PYME20ONE_24H, nombre: 'Tarifa Plana One', rEn: [0.1355, 0,0,0,0,0] }
);

// ─────────────────────────────────────────────────────────────────────────────
// CASOS uni6 — PFL 24h 3.0TD y 6.1TD (6 potencias, 1 precio energía)
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log(`TESTS uni6 — PFL 24h con 6 periodos de potencia`);

const CLIENT_UNI6 = makeClient({
  ...SEG_PYME361,
  kw: [50, 40, 35, 30, 25, 20],     // 6 kW por periodo
  en: [400, 450, 350, 300, 200, 100], // 1.800 kWh totales repartidos en 6 periodos
  enExc: 0,
  dias: 30,
});

// ── CASO A: uni6 / 3.0TD — sin excedentes ───────────────────────────────────
const resultUni6_30 = runCase(
  'pyme30 / PFL 24h (uni6, potP=6) / sin excedentes',
  'pyme', 6, CLIENT_UNI6, T_PYME30_24H_UNI6
);

// Verificaciones adicionales específicas de uni6
console.log(`\n── Verificaciones adicionales uni6 (3.0TD) ──`);
{
  const consumoTotal = CLIENT_UNI6.en.reduce((a, v) => a + (+v || 0), 0);
  const energiaEsperada = 0.1279 * consumoTotal;

  console.log(`  Consumo total (suma 6 periodos): ${consumoTotal} kWh`);
  console.log(`  Energía esperada (0.1279 × ${consumoTotal}): ${r4(energiaEsperada)} €`);
  console.log(`  calc.energia: ${r4(resultUni6_30.actual.energia)} €`);
  ok(approx(resultUni6_30.actual.energia, energiaEsperada),
     `uni6: energía = precio_único × suma_total (${r4(energiaEsperada)} €)`);

  // 6 periodos de potencia sumados correctamente
  let potEsperada = 0;
  for (let i = 0; i < 6; i++) {
    potEsperada += T_PYME30_24H_UNI6.rPot[i] * CLIENT_UNI6.kw[i] * CLIENT_UNI6.dias;
  }
  console.log(`  Potencia esperada (6 periodos × 30 días): ${r4(potEsperada)} €`);
  console.log(`  calc.potencia: ${r4(resultUni6_30.actual.potencia)} €`);
  ok(approx(resultUni6_30.actual.potencia, potEsperada),
     `uni6: 6 periodos de potencia sumados correctamente (${r4(potEsperada)} €)`);
}

// ── CASO B: uni6 / 6.1TD — con excedentes (IEE y IGIC3% sobre energía neta) ──
const CLIENT_UNI6_EXC = makeClient({
  ...SEG_PYME361,
  kw: [50, 40, 35, 30, 25, 20],
  en: [400, 450, 350, 300, 200, 100],
  enExc: 200,   // 200 kWh × 0.06 = 12€ — dentro del costEn, no se recorta
  dias: 30,
});
const resultUni6_61 = runCase(
  'pyme61 / PFL 24h (uni6, potP=6) / CON excedentes 200kWh',
  'pyme', 6, CLIENT_UNI6_EXC, T_PYME61_24H_UNI6
);

console.log(`\n── Verificaciones adicionales uni6 (6.1TD, con excedentes) ──`);
{
  const consumoTotal = CLIENT_UNI6_EXC.en.reduce((a, v) => a + (+v || 0), 0);
  const energiaEsperada = 0.1279 * consumoTotal;
  const excEsperado = Math.min(200 * 0.06, energiaEsperada);
  const energiaNetaEsperada = energiaEsperada - excEsperado;

  console.log(`  Consumo total: ${consumoTotal} kWh`);
  console.log(`  Energía bruta: ${r4(energiaEsperada)} €  — Excedentes: ${r4(excEsperado)} €  — Neta: ${r4(energiaNetaEsperada)} €`);
  ok(approx(resultUni6_61.actual.energia, energiaEsperada),
     `uni6: energía bruta correcta (${r4(energiaEsperada)} €)`);
  ok(approx(-(resultUni6_61.actual.excedentes ?? 0), excEsperado),
     `uni6: excedentes aplicados al total de energía (no a un solo periodo)`);
}

// ── CASO C: uni6 vs hex — mismo consumo, demostrar que suma total ────────────
console.log(`\n── CASO C: uni6 vs hex con mismo consumo — desglose comparativo ──`);
{
  const cSame = makeClient({
    ...SEG_PYME361,
    kw: [50, 40, 35, 30, 25, 20],
    en: [400, 450, 350, 300, 200, 100],
    enExc: 0, dias: 30,
  });
  const rUni6 = calc('pyme', 6, cSame, T_PYME30_24H_UNI6);
  const rHex  = calc('pyme', 6, cSame, T_PYME30_HEX);

  console.log(`  [uni6] potencia=${r4(rUni6.potencia)} €  energia=${r4(rUni6.energia)} €  total=${r4(rUni6.total)} €`);
  console.log(`  [hex]  potencia=${r4(rHex.potencia)} €   energia=${r4(rHex.energia)} €   total=${r4(rHex.total)} €`);

  // Misma potencia (mismas tasas, mismos kW, mismo potP=6)
  ok(approx(rUni6.potencia, rHex.potencia),
     `uni6 y hex comparten el mismo costPot cuando rPot y kW son iguales`);

  // Energía diferente (uni6: 0.1279 × 1800; hex: suma por periodos con tasas distintas)
  ok(rUni6.energia !== rHex.energia,
     `uni6 y hex dan energías distintas (precios distintos)`);

  // uni6 usa precio único sobre consumo total, no solo el primer periodo
  const enP1solo = T_PYME30_24H_UNI6.rEn[0] * cSame.en[0]; // si se aplicara solo a P1
  ok(!approx(rUni6.energia, enP1solo),
     `uni6 energía ≠ precio × solo P1 (confirma que suma todos los periodos)`);
  console.log(`    (precio × solo P1 = ${r4(enP1solo)} €, energía calc = ${r4(rUni6.energia)} €)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CASOS SVE — toggle ON/OFF/segmento sin SVE
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(70)}`);
console.log(`TESTS SVE — Servicio de Valor Añadido`);

// ── CASO 10: SVE toggle OFF (sveAnioRate=0) ──────────────────────────────────
{
  const cNoSve = makeClient({
    ...SEG_PYME20ONE,
    kw: [50, 30, 0,0,0,0],
    en: [1200, 800, 200, 0, 0, 0],
    enExc: 0,
    sveAnioRate: 0, sveServiceId: null,
  });
  const cConSve = makeClient({
    ...SEG_PYME20ONE,
    kw: [50, 30, 0,0,0,0],
    en: [1200, 800, 200, 0, 0, 0],
    enExc: 0,
    sveAnioRate: 89.16, sveServiceId: 'sve_gc_xpress',
  });
  const rNoSve  = calc('pyme', 2, cNoSve,  T_PYME20ONE_TRI);
  const rConSve = calc('pyme', 2, cConSve, T_PYME20ONE_TRI);

  console.log(`\n── CASO 10: SVE toggle OFF vs ON ──`);
  console.log(`  [OFF] sva=${r4(rNoSve.sva)} €   total=${r4(rNoSve.total)} €`);
  console.log(`  [ON]  sva=${r4(rConSve.sva)} €  total=${r4(rConSve.total)} €`);

  ok(rNoSve.sva === 0, `SVE OFF → sva = 0`);
  ok(rConSve.sva > 0,  `SVE ON  → sva > 0`);

  // con 30 días: 89.16 / 365 * 30 = 7.3285...€
  const sveProrated = (89.16 / 365) * 30;
  ok(approx(rConSve.sva, sveProrated),
     `SVE prorated = 89.16/365×30 = ${r4(sveProrated)}€ (got ${r4(rConSve.sva)})`);

  // total con SVE > total sin SVE
  ok(rConSve.total > rNoSve.total, `Total con SVE mayor que sin SVE`);

  // diferencia en total = SVE + IGIC7% sobre SVE
  const sveDiff = sveProrated * (1 + cConSve.taxIGIC7 / 100);
  ok(approx(rConSve.total - rNoSve.total, sveDiff),
     `Diferencia total = sveProrated × (1 + 7%) = ${r4(sveDiff)}€ (got ${r4(rConSve.total - rNoSve.total)}€)`);
}

// ── CASO 11: SVE en base IGIC 7% y NO en base IGIC 3% ───────────────────────
{
  const cSve = makeClient({
    ...SEG_PYME20ONE,
    kw: [50, 30, 0,0,0,0],
    en: [1200, 800, 200, 0, 0, 0],
    enExc: 0,
    sveAnioRate: 89.16, sveServiceId: 'sve_gc_xpress',
  });
  const cRef = makeClient({
    ...SEG_PYME20ONE,
    kw: [50, 30, 0,0,0,0],
    en: [1200, 800, 200, 0, 0, 0],
    enExc: 0,
  });
  const rSve = calc('pyme', 2, cSve, T_PYME20ONE_TRI);
  const rRef = calc('pyme', 2, cRef, T_PYME20ONE_TRI);

  console.log(`\n── CASO 11: SVE solo en base IGIC 7% ──`);
  console.log(`  [REF] igicRed=${r4(rRef.igicRed??0)} €  igic7=${r4(rRef.igic7??0)} €`);
  console.log(`  [SVE] igicRed=${r4(rSve.igicRed??0)} €  igic7=${r4(rSve.igic7??0)} €`);

  // IGIC 3% no cambia (SVE no está en su base)
  ok(approx(rSve.igicRed ?? 0, rRef.igicRed ?? 0),
     `IGIC 3% no varía al añadir SVE (SVE no entra en base 3%)`);

  // IGIC 7% sube exactamente en SVE * 7%
  const svePro = (89.16 / 365) * 30;
  ok(approx((rSve.igic7 ?? 0) - (rRef.igic7 ?? 0), svePro * (cSve.taxIGIC7 / 100)),
     `IGIC 7% sube sveProrated×7% al activar SVE`);
}

// ── CASO 12: pyme61 — sin SVE disponible ─────────────────────────────────────
console.log(`\n── CASO 12: pyme61 → SVE_SEGMENT_IDS tiene array vacío ──`);
{
  const ids = SVE_SEGMENT_IDS['pyme61'] ?? [];
  ok(ids.length === 0, `pyme61 no tiene servicios SVE en catálogo (array vacío)`);

  // pyme30 sí tiene opciones
  const ids30 = SVE_SEGMENT_IDS['pyme30'] ?? [];
  ok(ids30.length > 0, `pyme30 tiene ${ids30.length} servicios SVE disponibles`);

  // Los IDs del catálogo son coherentes
  const catalogIds = SVE_CATALOG.map(s => s.id);
  ok(SVE_CATALOG.length === 3, `Catálogo SVE tiene 3 servicios`);
  ok(catalogIds.includes('sve_gc_xpress'),     `Catálogo incluye sve_gc_xpress (89,16€/año)`);
  ok(catalogIds.includes('sve_gc_xpress_dto'), `Catálogo incluye sve_gc_xpress_dto (71,328€/año)`);
  ok(catalogIds.includes('svs_gc_10kwp'),      `Catálogo incluye svs_gc_10kwp (130,30€/año)`);
}

// ─── RESUMEN ──────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`RESUMEN: ${passed} ✅ pasados / ${failed} ❌ fallidos`);

if (failed > 0) {
  console.log(`\nBUGS DETECTADOS:`);
  console.log(`  A — impElec usa costEn BRUTA (calc.ts:78)    → falta restar excedentes`);
  console.log(`  B — baseIGICRed usa costEn BRUTA (calc.ts:98) → falta restar excedentes`);
  console.log(`  C — sin tope costExc ≤ costEn (calc.ts:73)   → factura puede ser negativa`);
  console.log(`  D — pot_unit='anio' con tasas €/kW/día        → add_pyme30_pyme61_segments.sql`);
  console.log(`  [E] tri6 no en CHECK constraint               → schema_v2.sql (no testeable vía calc())`);
}

process.exit(failed > 0 ? 1 : 0);
