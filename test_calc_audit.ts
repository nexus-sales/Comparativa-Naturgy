import { calc, makeDefaultClient } from '/src/utils/calculations';
import type { SegCliente, TarifaLocal } from '/src/utils/calculations';

// ============================================================
// TEST: Ejecución real de calc() con datos de ejemplo
// ============================================================

// Datos comunes
const baseDays = 30;
const tariffMultiplier = 1; // para potencias por día

// Cliente base PYME (2.0TD)
const client_pyme20: SegCliente = {
  nombre: "CLIENTE TEST 2.0TD",
  cups: "ES1234567890",
  dir: "Test St. 123",
  f1: "2026-05-01",
  f2: "2026-05-31",
  dias: baseDays,
  
  // Potencia: 2 períodos
  // P1=50kW, P2=30kW
  kw: [50, 30],
  
  // Energía: 3 períodos  
  // E1=1200kWh, E2=800kWh, E3=500kWh
  en: [1200, 800, 500],
  
  factura: 0, // se calcula
  alquiler: 1.68,
  enExc: 50, // 50kWh excedentes
  excedenteRate: 0.06,
  bonoRate: 0.019121,
  taxImpElec: 5.1127,
  taxIGIC: 0,
  taxIGICRed: 3,
  taxIGIC7: 7,
};

// Cliente para 3.0TD/6.1TD (6 periodos)
const client_pyme30: SegCliente = {
  nombre: "CLIENTE TEST 3.0TD",
  cups: "ES1234567891",
  dir: "Test St. 124",
  f1: "2026-05-01",
  f2: "2026-05-31",
  dias: baseDays,
  
  // Potencia: 6 períodos
  // P1=50, P2=40, P3=35, P4=30, P5=25, P6=20 kW
  kw: [50, 40, 35, 30, 25, 20],
  
  // Energía: 6 períodos
  // E1=400, E2=450, E3=350, E4=300, E5=200, E6=100 kWh
  en: [400, 450, 350, 300, 200, 100],
  
  factura: 0,
  alquiler: 1.68,
  enExc: 50,
  excedenteRate: 0.06,
  bonoRate: 0.019121,
  taxImpElec: 5.1127,
  taxIGIC: 0,
  taxIGICRed: 3,
  taxIGIC7: 7,
  
  // Reactiva: 6 períodos @ 0.03€/kVArh
  reactiva: [80, 80, 80, 80, 80, 80],
  reactivaRate: [0.03, 0.03, 0.03, 0.03, 0.03, 0.03],
};

// Tarifas de ejemplo
const tariff_pyme20_uni: TarifaLocal = {
  id: "test_pyme20_uni",
  nombre: "PFL 24h (2.0TD)",
  tipo: "uni",
  potUnit: "dia",
  rPot: [0.122973, 0.043976],
  rEn: [0.1422],
  sva: 6.44,
  open: false,
  selected: true,
};

const tariff_pyme30_uni: TarifaLocal = {
  id: "test_pyme30_uni",
  nombre: "PFL 24h (3.0TD)",
  tipo: "uni",
  potUnit: "anio",
  rPot: [0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
  rEn: [0.1422],
  sva: 6.44,
  open: false,
  selected: true,
};

const tariff_pyme30_hex: TarifaLocal = {
  id: "test_pyme30_hex",
  nombre: "PFL Trihorario (3.0TD)",
  tipo: "hex",
  potUnit: "anio",
  rPot: [0.122973, 0.043976, 0.097384, 0.05478, 0.087232, 0.046691],
  rEn: [0.1225, 0.1225, 0.1225, 0.1325, 0.1325, 0.0825],
  sva: 6.44,
  open: false,
  selected: true,
};

// ============================================================
// FUNCIÓN DE FORMATO PARA SALIDA CLARA
// ============================================================

function formatResult(label: string, client: SegCliente, tariff: TarifaLocal, result: any) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label}`);
  console.log(`${'='.repeat(80)}`);
  
  console.log(`\n📊 DATOS DE ENTRADA:`);
  console.log(`  Cliente: ${client.nombre}`);
  console.log(`  Tarifa: ${tariff.nombre} (tipo: ${tariff.tipo})`);
  console.log(`  Período: ${baseDays} días`);
  console.log(`  Periodos Potencia: ${client.kw.length}`);
  console.log(`  Periodos Energía: ${client.en.length}`);
  
  console.log(`\n💡 POTENCIA (€/kW/día × kW × ${baseDays} días):`);
  let totalPot = 0;
  for (let i = 0; i < client.kw.length; i++) {
    const kw = client.kw[i] || 0;
    const rate = tariff.rPot[i] || 0;
    const cost = tariff.potUnit === 'dia' 
      ? rate * kw * baseDays
      : (rate / 365) * kw * baseDays;
    totalPot += cost;
    console.log(`  P${i+1}: ${kw}kW × ${rate}€ × ${baseDays} = ${cost.toFixed(4)}€`);
  }
  console.log(`  ✓ TOTAL POTENCIA: ${totalPot.toFixed(4)}€`);
  
  console.log(`\n⚡ ENERGÍA (€/kWh × kWh):`);
  let totalEn = 0;
  for (let i = 0; i < client.en.length; i++) {
    const en = client.en[i] || 0;
    const rate = tariff.rEn[i] || tariff.rEn[0] || 0;
    const cost = rate * en;
    totalEn += cost;
    if (tariff.tipo === 'uni') {
      console.log(`  E${i+1}: ${en}kWh × ${rate}€ = ${cost.toFixed(4)}€`);
    } else {
      console.log(`  E${i+1}: ${en}kWh × ${rate}€ = ${cost.toFixed(4)}€`);
    }
  }
  console.log(`  ✓ TOTAL ENERGÍA (BRUTA): ${totalEn.toFixed(4)}€`);
  
  console.log(`\n♻️ ENERGÍA REACTIVA (kVArh × €/kVArh):`);
  if (client.reactiva && client.reactiva.length > 0) {
    let totalReact = 0;
    for (let i = 0; i < client.reactiva.length; i++) {
      const react = client.reactiva[i] || 0;
      const rate = client.reactivaRate?.[i] ?? 0;
      const cost = react * rate;
      totalReact += cost;
      console.log(`  R${i+1}: ${react}kVArh × ${rate}€ = ${cost.toFixed(4)}€`);
    }
    console.log(`  ✓ TOTAL REACTIVA: ${totalReact.toFixed(4)}€`);
  } else {
    console.log(`  (No aplica)`);
  }
  
  console.log(`\n📋 COMPONENTES VARIOS:`);
  console.log(`  Alquiler contador: ${client.alquiler}€`);
  console.log(`  SVE GC Xpress: ${tariff.sva}€`);
  console.log(`  Excedentes: -${(client.enExc || 0)} kWh × ${client.excedenteRate}€ = -${((client.enExc || 0) * client.excedenteRate).toFixed(4)}€`);
  console.log(`  Bono Social: ${client.bonoRate}€/día × ${baseDays} = ${(client.bonoRate * baseDays).toFixed(4)}€`);
  
  console.log(`\n📊 SUBTOTAL (sin impuestos):`);
  console.log(`  ${result.subtotal.toFixed(4)}€`);
  
  console.log(`\n🔴 IMPUESTO ELÉCTRICO 5.11127%:`);
  console.log(`  Base: Potencia + Energía = ${totalPot.toFixed(4)} + ${totalEn.toFixed(4)} = ${(totalPot + totalEn).toFixed(4)}€`);
  console.log(`  Cuota: ${result.impElec.toFixed(4)}€`);
  
  console.log(`\n🟡 IGIC REDUCIDO 3% (sobre potencia + energía + imp.elec + bono):`);
  const baseIGICRed = totalPot + totalEn + result.impElec + (client.bonoRate * baseDays);
  const igicRed = baseIGICRed * 0.03;
  console.log(`  Base IGIC 3%: ${totalPot.toFixed(4)} + ${totalEn.toFixed(4)} + ${result.impElec.toFixed(4)} + ${(client.bonoRate * baseDays).toFixed(4)}`);
  console.log(`               = ${baseIGICRed.toFixed(4)}€`);
  console.log(`  Cuota IGIC 3%: ${(result.igicRed || 0).toFixed(4)}€`);
  
  console.log(`\n🟢 IGIC GENERAL 7% (sobre alquiler + SVE):`);
  const baseIGIC7 = client.alquiler + tariff.sva;
  const igic7 = baseIGIC7 * 0.07;
  console.log(`  Base IGIC 7%: ${client.alquiler}€ + ${tariff.sva}€ = ${baseIGIC7.toFixed(4)}€`);
  console.log(`  Cuota IGIC 7%: ${(result.igic7 || 0).toFixed(4)}€`);
  
  console.log(`\n✅ TOTAL ESTIMADO:`);
  console.log(`  ${result.total.toFixed(4)}€`);
  
  console.log(`\n📋 DESGLOSE TOTAL:`);
  console.log(`  Subtotal...................... ${result.subtotal.toFixed(4)}€`);
  console.log(`  + Impuesto Eléctrico.......... ${result.impElec.toFixed(4)}€`);
  console.log(`  + IGIC 3%..................... ${(result.igicRed || 0).toFixed(4)}€`);
  console.log(`  + IGIC 7%..................... ${(result.igic7 || 0).toFixed(4)}€`);
  console.log(`  + Bono Social................. ${result.bonoSocial.toFixed(4)}€`);
  console.log(`  ────────────────────────────────`);
  console.log(`  TOTAL......................... ${result.total.toFixed(4)}€`);
  
  console.log('\n');
}

// ============================================================
// EJECUTAR TESTS
// ============================================================

console.log('\n\n');
console.log('█'.repeat(80));
console.log('█ AUDITORÍA DE CÁLCULOS REALES: Ejecución de calc() TypeScript');
console.log('█'.repeat(80));

// Test 1: 2.0TD
const result_pyme20 = calc('pyme', 2, client_pyme20, tariff_pyme20_uni);
formatResult('TEST 1: PYME 2.0TD (2 potencias, 3 energías)', client_pyme20, tariff_pyme20_uni, result_pyme20);

// Test 2: 3.0TD (uni)
const result_pyme30_uni = calc('pyme', 6, client_pyme30, tariff_pyme30_uni);
formatResult('TEST 2: PYME 3.0TD UNI (6 potencias, 1 energía)', client_pyme30, tariff_pyme30_uni, result_pyme30_uni);

// Test 3: 3.0TD (hex)
const result_pyme30_hex = calc('pyme', 6, client_pyme30, tariff_pyme30_hex);
formatResult('TEST 3: PYME 3.0TD HEX (6 potencias, 6 energías)', client_pyme30, tariff_pyme30_hex, result_pyme30_hex);

console.log('\n\n');
console.log('█'.repeat(80));
console.log('█ FIN DE TESTS');
console.log('█'.repeat(80));
console.log('\n');
