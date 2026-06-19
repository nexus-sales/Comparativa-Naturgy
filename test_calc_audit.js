// Copiar la función calc() del código TypeScript y ejecutarla directamente

function calc(taxModel, potP, c, t) {
  const dias = +c.dias || 1;
  let costPot = 0;
  for (let i = 0; i < potP; i++) {
    const r = +(t.rPot[i] || 0), kw = +(c.kw[i] || 0);
    if (!r || !kw) continue;
    costPot += t.potUnit === 'dia' ? r * kw * dias : (r / 365) * kw * dias;
  }

  let costEn = 0;
  const nEnMap = { uni: 1, tri: 3, tri6: 3, hex: 6 };
  if (t.tipo === 'uni') {
    costEn = (+(t.rEn[0]) || 0) * c.en.reduce((a, v) => a + (+v || 0), 0);
  } else {
    const n = nEnMap[t.tipo] || 1;
    for (let i = 0; i < n; i++) costEn += (+(t.rEn[i] || 0)) * (+(c.en[i] || 0));
  }

  const sva = +(t.sva || 0);
  const alq = +(c.alquiler || 0);
  const costExc = (+(c.enExc || 0)) * (+(c.excedenteRate || 0));
  const costReactiva = (c.reactiva || []).reduce((acc, v, i) => acc + (+(v) || 0) * (+(c.reactivaRate?.[i] ?? 0) || 0), 0);

  const subtotal = costPot + costEn + costReactiva + sva + alq - costExc;
  // Impuesto eléctrico: solo sobre potencia + energía (base energética)
  const impElec = (costPot + costEn) * (+(c.taxImpElec || 0) / 100);
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

  // IGIC Reducido 3%: sobre potencia + energía + impuesto eléctrico + bono social
  const baseIGICRed = costPot + costEn + impElec + bono;
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
    
    // Agregar datos internos para auditoría
    _baseIGICRed: +baseIGICRed.toFixed(4),
    _baseIGIC7: +baseIGIC7.toFixed(4),
    _costPot: +costPot.toFixed(4),
    _costEn: +costEn.toFixed(4),
    _costReactiva: +costReactiva.toFixed(4),
  };
}

// ============================================================
// DATOS DE PRUEBA
// ============================================================

const baseDays = 30;

// Cliente PYME 2.0TD: 2 potencias, 3 energías
const client_pyme20 = {
  nombre: "CLIENTE TEST 2.0TD",
  cups: "ES1234567890",
  dir: "Test St. 123",
  f1: "2026-05-01",
  f2: "2026-05-31",
  dias: baseDays,
  kw: [50, 30],                          // 2 periodos: P1=50kW, P2=30kW
  en: [1200, 800, 500],                  // 3 periodos: E1=1200kWh, E2=800kWh, E3=500kWh
  factura: 0,
  alquiler: 1.68,
  enExc: 50,                             // 50kWh excedentes
  excedenteRate: 0.06,
  bonoRate: 0.019121,
  taxImpElec: 5.1127,
  taxIGIC: 0,
  taxIGICRed: 3,
  taxIGIC7: 7,
};

// Cliente PYME 3.0TD/6.1TD: 6 potencias, 6 energías
const client_pyme30 = {
  nombre: "CLIENTE TEST 3.0TD",
  cups: "ES1234567891",
  dir: "Test St. 124",
  f1: "2026-05-01",
  f2: "2026-05-31",
  dias: baseDays,
  kw: [50, 40, 35, 30, 25, 20],          // 6 periodos
  en: [400, 450, 350, 300, 200, 100],    // 6 periodos
  factura: 0,
  alquiler: 1.68,
  enExc: 50,
  excedenteRate: 0.06,
  bonoRate: 0.019121,
  taxImpElec: 5.1127,
  taxIGIC: 0,
  taxIGICRed: 3,
  taxIGIC7: 7,
  reactiva: [80, 80, 80, 80, 80, 80],    // 6 periodos @ 0.03€/kVArh
  reactivaRate: [0.03, 0.03, 0.03, 0.03, 0.03, 0.03],
};

// Tarifas
const tariff_pyme20_uni = {
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

const tariff_pyme30_uni = {
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

const tariff_pyme30_hex = {
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
// FUNCIÓN DE FORMATO
// ============================================================

function formatResult(label, client, tariff, result) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label}`);
  console.log(`${'='.repeat(80)}`);
  
  console.log(`\n📊 ENTRADA:`);
  console.log(`  Cliente: ${client.nombre}`);
  console.log(`  Tarifa: ${tariff.nombre}`);
  console.log(`  Período: ${client.dias} días`);
  console.log(`  Potencia: ${client.kw.length} períodos`);
  console.log(`  Energía: ${client.en.length} períodos`);
  
  console.log(`\n💡 POTENCIA (€/kW/período × kW × días):`);
  let totalPot = 0;
  for (let i = 0; i < client.kw.length; i++) {
    const kw = client.kw[i] || 0;
    const rate = tariff.rPot[i] || 0;
    const cost = tariff.potUnit === 'dia' 
      ? rate * kw * client.dias
      : (rate / 365) * kw * client.dias;
    totalPot += cost;
    console.log(`  P${i+1}: ${kw}kW × ${rate}€ × ${client.dias} = ${cost.toFixed(4)}€`);
  }
  console.log(`  ✓ TOTAL POTENCIA: ${result._costPot}€ (validado: ${totalPot.toFixed(4)}€)`);
  
  console.log(`\n⚡ ENERGÍA BRUTA (€/kWh × kWh):`);
  let totalEn = 0;
  for (let i = 0; i < client.en.length; i++) {
    const en = client.en[i] || 0;
    const rate = tariff.rEn[i] || tariff.rEn[0] || 0;
    const cost = rate * en;
    totalEn += cost;
    console.log(`  E${i+1}: ${en}kWh × ${rate}€ = ${cost.toFixed(4)}€`);
  }
  console.log(`  ✓ TOTAL ENERGÍA (BRUTA): ${result._costEn}€ (validado: ${totalEn.toFixed(4)}€)`);
  
  console.log(`\n♻️ REACTIVA (kVArh × €/kVArh):`);
  if (client.reactiva && client.reactiva.length > 0) {
    let totalReact = 0;
    for (let i = 0; i < client.reactiva.length; i++) {
      const react = client.reactiva[i] || 0;
      const rate = client.reactivaRate?.[i] ?? 0;
      const cost = react * rate;
      totalReact += cost;
      console.log(`  R${i+1}: ${react}kVArh × ${rate}€ = ${cost.toFixed(4)}€`);
    }
    console.log(`  ✓ TOTAL REACTIVA: ${result._costReactiva}€ (validado: ${totalReact.toFixed(4)}€)`);
  } else {
    console.log(`  (No aplica)`);
  }
  
  console.log(`\n📋 COMPONENTES VARIOS:`);
  console.log(`  Alquiler contador: ${result.alquiler}€`);
  console.log(`  SVE GC Xpress: ${result.sva}€`);
  console.log(`  Excedentes: ${result.excedentes}€`);
  console.log(`  Bono Social: ${result.bonoSocial}€`);
  
  console.log(`\n📊 SUBTOTAL (antes impuestos):`);
  console.log(`  P + E + Reactiva + SVE + Alquiler - Excedentes`);
  console.log(`  ${result._costPot} + ${result._costEn} + ${result.reactiva} + ${result.sva} + ${result.alquiler} ${result.excedentes}`);
  console.log(`  = ${result.subtotal}€`);
  
  console.log(`\n🔴 IMPUESTO ELÉCTRICO 5.11127%:`);
  console.log(`  Base: Potencia + Energía (BRUTA)`);
  console.log(`  Base: ${result._costPot} + ${result._costEn} = ${(result._costPot + result._costEn).toFixed(4)}€`);
  console.log(`  Cuota: ${result.impElec}€`);
  
  console.log(`\n🟡 IGIC REDUCIDO 3% (ENERGÉTICA):`);
  console.log(`  Base IGIC 3%: Potencia + Energía (BRUTA) + Imp.Eléctrico + Bono`);
  console.log(`  Base IGIC 3%: ${result._costPot} + ${result._costEn} + ${result.impElec} + ${result.bonoSocial}`);
  console.log(`              = ${result._baseIGICRed}€`);
  console.log(`  Cuota IGIC 3%: ${result.igicRed}€`);
  
  console.log(`\n⚠️  CRITERIO: ¿Energía BRUTA o NETA de excedentes en base IGIC 3%?`);
  console.log(`  Valor actual: ${result._costEn}€ (BRUTA, excedentes restados solo en subtotal)`);
  console.log(`  Alternativa: ${(result._costEn + result.excedentes).toFixed(4)}€ (NETA)`);
  console.log(`  Diferencia en IGIC 3%: ${(Math.abs(result.excedentes) * 0.03).toFixed(4)}€`);
  
  console.log(`\n🟢 IGIC GENERAL 7% (SERVICIOS):`);
  console.log(`  Base IGIC 7%: Alquiler + SVE`);
  console.log(`  Base IGIC 7%: ${result.alquiler} + ${result.sva} = ${result._baseIGIC7}€`);
  console.log(`  Cuota IGIC 7%: ${result.igic7}€`);
  
  console.log(`\n✅ TOTAL ESTIMADO:`);
  console.log(`  Subtotal............. ${result.subtotal}€`);
  console.log(`  + Imp.Eléctrico...... ${result.impElec}€`);
  console.log(`  + IGIC 3%............ ${result.igicRed}€`);
  console.log(`  + IGIC 7%............ ${result.igic7}€`);
  console.log(`  + Bono Social........ ${result.bonoSocial}€`);
  console.log(`  ─────────────────────────`);
  console.log(`  TOTAL = ${result.total}€`);
}

// ============================================================
// EJECUTAR TESTS
// ============================================================

console.log('\n\n');
console.log('█'.repeat(80));
console.log('█ AUDITORÍA: EJECUCIÓN REAL DE calc()');
console.log('█'.repeat(80));

const result1 = calc('pyme', 2, client_pyme20, tariff_pyme20_uni);
formatResult('TEST 1: PYME 2.0TD (2 potencias, 3 energías)', client_pyme20, tariff_pyme20_uni, result1);

const result2 = calc('pyme', 6, client_pyme30, tariff_pyme30_uni);
formatResult('TEST 2: PYME 3.0TD UNI (6 potencias, 1 energía)', client_pyme30, tariff_pyme30_uni, result2);

const result3 = calc('pyme', 6, client_pyme30, tariff_pyme30_hex);
formatResult('TEST 3: PYME 3.0TD HEX (6 potencias, 6 energías)', client_pyme30, tariff_pyme30_hex, result3);

// Test 4: 6.1TD (igual a 3.0TD con misma estructura)
const result4 = calc('pyme', 6, client_pyme30, tariff_pyme30_hex);
formatResult('TEST 4: PYME 6.1TD (6 potencias, 6 energías)', client_pyme30, tariff_pyme30_hex, result4);

console.log('\n\n');
console.log('█'.repeat(80));
console.log('█ FIN DE AUDITORÍA');
console.log('█'.repeat(80));
console.log('\n');
