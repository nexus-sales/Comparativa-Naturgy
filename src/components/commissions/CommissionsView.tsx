import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  calcularComisionPyme, planLabel, mesKey, mesLabel, mesCobro, parseNum, hoy,
  DEFAULT_RES_COMISIONES, DEFAULT_RAPPEL_TRAMOS, DEFAULT_ADOC_TRAMOS,
  type VentaPyme, type VentaRes, type ResComisiones, type RappelTramo, type AdocTramo,
  type PlanTipo, type PlanPlan,
} from "../../utils/commissionCalc";
import { fmtEur } from "../../utils/calculations";
import type { Profile } from "../../types";

const TARIFAS = [
  { value: "", label: "— Seleccionar plan —", tipo: "" },
  { value: "Plan Fijo Luz ONE",      label: "Plan Fijo Luz ONE",      tipo: "fijo" },
  { value: "Plan Fijo Luz",          label: "Plan Fijo Luz",          tipo: "fijo" },
  { value: "Plan Fijo Luz Supra",    label: "Plan Fijo Luz Supra",    tipo: "fijo" },
  { value: "Plan Variable Luz ONE",  label: "Plan Variable Luz ONE",  tipo: "variable" },
  { value: "Plan Variable Luz",      label: "Plan Variable Luz",      tipo: "variable" },
  { value: "Plan Variable Luz Supra",label: "Plan Variable Luz Supra",tipo: "variable" },
];

const RES_PRODUCTOS = [
  { value: "luz",       label: "Luz",       emoji: "🔆", color: "amber"  },
  { value: "gas",       label: "Gas",       emoji: "🔥", color: "red"    },
  { value: "dual",      label: "Dual",      emoji: "⚡", color: "violet" },
  { value: "servicios", label: "Servicios", emoji: "🛠", color: "cyan"   },
] as const;

function loadLS<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
function saveLS(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* silent */ }
}

interface Props { profile: Profile | null; }

export function CommissionsView({ profile }: Props) {
  const [tab, setTab] = useState<"pyme" | "res" | "ventas">("pyme");

  // ── VENTAS ──
  const [ventas,    setVentas]    = useState<VentaPyme[]>(() => loadLS("naturgy_ventas", []));
  const [ventasRes, setVentasRes] = useState<VentaRes[]>(() => loadLS("naturgy_ventas_res", []));

  // ── PYME STATE ──
  const [inputAnual,     setInputAnual]     = useState("");
  const [modoCalc,       setModoCalc]       = useState<"anual" | "mensual">("anual");
  const [mesesInput,     setMesesInput]     = useState<string[]>(Array(12).fill(""));
  const [resultado,      setResultado]      = useState<{ kwh: number; data: ReturnType<typeof calcularComisionPyme> } | null>(null);
  const [errorCalc,      setErrorCalc]      = useState("");
  const [planSel,        setPlanSel]        = useState<{ tipo: PlanTipo; plan: PlanPlan } | null>(null);
  const [tarifaCliente,  setTarifaCliente]  = useState("");
  const [nombreCliente,  setNombreCliente]  = useState("");
  const [cupsPyme,       setCupsPyme]       = useState("");
  const [fechaVentaPyme, setFechaVentaPyme] = useState(hoy());
  const [msgAdded,       setMsgAdded]       = useState(false);

  // ── RESIDENCIAL STATE ──
  const [resNombre,      setResNombre]      = useState("");
  const [resCups,        setResCups]        = useState("");
  const [resFechaVenta,  setResFechaVenta]  = useState(hoy());
  const [resProducto,    setResProducto]    = useState<"luz"|"gas"|"dual"|"servicios">("luz");
  const [resComisiones,  setResComisiones]  = useState<ResComisiones>(() => loadLS("naturgy_res_com", DEFAULT_RES_COMISIONES));
  const [resRappelTramos,setResRappelTramos]= useState<RappelTramo[]>(() => loadLS("naturgy_res_rappel", DEFAULT_RAPPEL_TRAMOS));
  const [resAdocTramos,  setResAdocTramos]  = useState<AdocTramo[]>(() => {
    const saved = loadLS<AdocTramo[] | null>("naturgy_res_adoc2", null);
    if (saved && Array.isArray(saved)) {
      return saved.map((s, i) => ({ ...s, label: DEFAULT_ADOC_TRAMOS[i]?.label ?? s.label, ref: s.ref ?? DEFAULT_ADOC_TRAMOS[i]?.ref ?? "" }));
    }
    return DEFAULT_ADOC_TRAMOS;
  });
  const [resExtraTab,    setResExtraTab]    = useState<"rappel" | "adoc">("rappel");
  const [resMsgAdded,    setResMsgAdded]    = useState(false);

  // ── VENTAS VIEW STATE ──
  const [tabVentas,      setTabVentas]      = useState<"pyme" | "res">("pyme");
  const [mesVentaFiltro, setMesVentaFiltro] = useState<string>(() => mesKey(hoy()));
  const importRef = useRef<HTMLInputElement>(null);

  // ── PERSISTENCIA ──
  useEffect(() => saveLS("naturgy_ventas",     ventas),        [ventas]);
  useEffect(() => saveLS("naturgy_ventas_res", ventasRes),     [ventasRes]);
  useEffect(() => saveLS("naturgy_res_com",    resComisiones), [resComisiones]);
  useEffect(() => saveLS("naturgy_res_rappel", resRappelTramos),[resRappelTramos]);
  useEffect(() => saveLS("naturgy_res_adoc2",  resAdocTramos), [resAdocTramos]);

  // ── DERIVED ──
  const totalMensual = mesesInput.reduce((a, v) => a + parseNum(v), 0);

  const tarifaToPlanSel = (tarifa: string) => {
    if (!tarifa) return null;
    const tipo: PlanTipo = tarifa.toLowerCase().includes("variable") ? "variable" : "fijo";
    const plan: PlanPlan = tarifa.toLowerCase().includes("supra") ? "supra" : tarifa.toLowerCase().includes("one") ? "one" : "luz";
    return { tipo, plan };
  };

  const comisionSeleccionada = useMemo(() => {
    if (!resultado || resultado.data === "NC" || !resultado.data || !planSel) return null;
    return resultado.data[planSel.tipo][planSel.plan];
  }, [resultado, planSel]);

  const resRappel = useMemo(() =>
    [...resRappelTramos, ...resAdocTramos].filter(t => t.activo).reduce((s, t) => s + t.valor, 0),
    [resRappelTramos, resAdocTramos]
  );

  const resActiveLabels = useMemo(() =>
    [...resRappelTramos, ...resAdocTramos].filter(t => t.activo).map(t => "ref" in t && t.ref ? `${t.label} [${t.ref}]` : t.label).join(", "),
    [resRappelTramos, resAdocTramos]
  );

  const resComisionTotal = resComisiones[resProducto] + resRappel;

  const mesesDisponibles = useMemo(() => {
    const keys = [...new Set([...ventas.map(v => v.mesCobro), ...ventasRes.map(v => v.mesCobro)].filter(Boolean))] as string[];
    const k = mesKey(hoy());
    if (!keys.includes(k)) keys.push(k);
    if (ventas.some(v => !v.mesCobro) || ventasRes.some(v => !v.mesCobro)) keys.push("pendientes");
    return keys.sort();
  }, [ventas, ventasRes]);

  const ventasFiltradas    = useMemo(() => ventas.filter(v => mesVentaFiltro === "pendientes" ? !v.mesCobro : v.mesCobro === mesVentaFiltro), [ventas, mesVentaFiltro]);
  const ventasResFiltradas = useMemo(() => ventasRes.filter(v => mesVentaFiltro === "pendientes" ? !v.mesCobro : v.mesCobro === mesVentaFiltro), [ventasRes, mesVentaFiltro]);
  const totalComisiones    = ventasFiltradas.reduce((a, v) => a + v.comision, 0);
  const totalComisionesRes = useMemo(() => {
    const base = ventasResFiltradas.reduce((acc, v) => acc + v.comisionBase, 0);
    return base + ventasResFiltradas.length * resRappel;
  }, [ventasResFiltradas, resRappel]);

  // ── HANDLERS PYME ──
  const handleCalc = useCallback(() => {
    const kwh = modoCalc === "anual" ? parseNum(inputAnual) : totalMensual;
    if (!kwh || kwh <= 0) { setErrorCalc("Introduce un consumo válido."); setResultado(null); return; }
    setErrorCalc("");
    setPlanSel(tarifaToPlanSel(tarifaCliente));
    setResultado({ kwh, data: calcularComisionPyme(kwh) });
  }, [modoCalc, inputAnual, totalMensual, tarifaCliente]);

  const handleTarifaChange = (val: string) => { setTarifaCliente(val); setPlanSel(tarifaToPlanSel(val)); };

  const limpiarCalc = () => { setMesesInput(Array(12).fill("")); setInputAnual(""); setResultado(null); setErrorCalc(""); setPlanSel(null); };

  const añadirVenta = () => {
    if (!nombreCliente.trim() || !planSel || comisionSeleccionada === null || !resultado) return;
    const nueva: VentaPyme = {
      id: Date.now(), nombre: nombreCliente.trim(), cups: cupsPyme.trim(),
      tarifa: tarifaCliente, kwh: resultado.kwh,
      planTipo: planSel.tipo, planPlan: planSel.plan,
      planLabel: planLabel(planSel.tipo, planSel.plan),
      comision: comisionSeleccionada, fechaVenta: fechaVentaPyme,
      fechaActivacion: "", mesCobro: null,
      metodo: (resultado.data as { metodo: string })?.metodo ?? "",
    };
    setVentas(prev => [...prev, nueva]);
    setMesVentaFiltro("pendientes");
    setMsgAdded(true); setTimeout(() => setMsgAdded(false), 2500);
    setNombreCliente(""); setCupsPyme(""); setTarifaCliente(""); setPlanSel(null); setResultado(null); setInputAnual(""); setMesesInput(Array(12).fill(""));
  };

  const añadirVentaRes = () => {
    if (!resNombre.trim()) return;
    const nueva: VentaRes = {
      id: Date.now(), nombre: resNombre.trim(), cups: resCups.trim(),
      producto: resProducto, comisionBase: resComisiones[resProducto],
      rappel: resRappel, comision: resComisionTotal,
      fechaVenta: resFechaVenta, fechaActivacion: "", mesCobro: null,
    };
    setVentasRes(prev => [...prev, nueva]);
    setMesVentaFiltro("pendientes");
    setResMsgAdded(true); setTimeout(() => setResMsgAdded(false), 2500);
    setResNombre(""); setResCups("");
  };

  const updateFechaActivacion    = (id: number, fecha: string) => setVentas(prev => prev.map(v => v.id === id ? { ...v, fechaActivacion: fecha, mesCobro: mesCobro(fecha) } : v));
  const updateFechaActivacionRes = (id: number, fecha: string) => setVentasRes(prev => prev.map(v => v.id === id ? { ...v, fechaActivacion: fecha, mesCobro: mesCobro(fecha) } : v));

  // ── EXPORT ──
  const exportarExcel = () => {
    const colaborador = profile?.full_name || profile?.email || "";
    const header = [
      ["Naturgy · Comisiones Pymes"],
      [`Mes: ${mesLabel(mesVentaFiltro)}${colaborador ? `   |   Colaborador: ${colaborador}` : ""}`],
      [`Generado: ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`],
      [],
    ];
    const rows = ventasFiltradas.map((v, i) => ({
      "#": i + 1, "Cliente": v.nombre, "CUPS": v.cups || "—", "Tarifa": v.tarifa || "—",
      "Consumo (kWh/año)": v.kwh, "Plan": v.planLabel, "Comisión (€)": v.comision,
      "F. Venta": v.fechaVenta, "F. Activación": v.fechaActivacion, "Mes Cobro": mesLabel(v.mesCobro),
    }));
    rows.push({ "#": "", "Cliente": "TOTAL", "CUPS": "", "Tarifa": "", "Consumo (kWh/año)": "", "Plan": "", "Comisión (€)": totalComisiones, "F. Venta": "", "F. Activación": "", "Mes Cobro": "" } as never);
    const ws = XLSX.utils.aoa_to_sheet(header);
    XLSX.utils.sheet_add_json(ws, rows, { origin: header.length });
    ws["!cols"] = [4,28,22,16,18,24,14,14,16,16].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas Pyme");
    const backup = [{ json: JSON.stringify({ ventas, ventasRes, resComisiones, resRappelTramos, resAdocTramos, version: "3.0" }) }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(backup), "DATOS_SISTEMA");
    XLSX.writeFile(wb, `Naturgy_Comisiones_${mesLabel(mesVentaFiltro).replace(" ", "_")}.xlsx`);
  };

  const exportarExcelRes = () => {
    const colaborador = profile?.full_name || profile?.email || "";
    const header = [
      ["Naturgy · Comisiones Residencial"],
      [`Mes: ${mesLabel(mesVentaFiltro)}${colaborador ? `   |   Colaborador: ${colaborador}` : ""}`],
      [`Generado: ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`],
      [],
    ];
    const rows = ventasResFiltradas.map((v, i) => ({
      "#": i + 1, "Cliente": v.nombre, "Producto": v.producto.toUpperCase(),
      "Comisión Base (€)": v.comisionBase, "Rappel (€)": resRappel, "Total (€)": v.comisionBase + resRappel,
      "F. Venta": v.fechaVenta, "F. Activación": v.fechaActivacion, "Mes Cobro": mesLabel(v.mesCobro),
    }));
    rows.push({ "#": "", "Cliente": "TOTAL", "Producto": "", "Comisión Base (€)": "", "Rappel (€)": "", "Total (€)": totalComisionesRes, "F. Venta": "", "F. Activación": "", "Mes Cobro": "" } as never);
    const ws = XLSX.utils.aoa_to_sheet(header);
    XLSX.utils.sheet_add_json(ws, rows, { origin: header.length });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas Residencial");
    const backup = [{ json: JSON.stringify({ ventas, ventasRes, resComisiones, resRappelTramos, resAdocTramos, version: "3.0" }) }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(backup), "DATOS_SISTEMA");
    XLSX.writeFile(wb, `Naturgy_Residencial_${mesLabel(mesVentaFiltro).replace(" ", "_")}.xlsx`);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets["DATOS_SISTEMA"];
        if (!ws) throw new Error("No es un archivo de backup válido");
        const jsonStr = (XLSX.utils.sheet_to_json(ws) as Array<{ json: string }>)[0].json;
        const data = JSON.parse(jsonStr);
        if (data.ventas)          setVentas(data.ventas);
        if (data.ventasRes)       setVentasRes(data.ventasRes);
        if (data.resComisiones)   setResComisiones(data.resComisiones);
        if (data.resRappelTramos) setResRappelTramos(data.resRappelTramos);
        if (data.resAdocTramos)   setResAdocTramos(data.resAdocTramos);
      } catch { /* silent — archivo inválido */ }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const limpiarTodo = () => {
    if (!window.confirm("¿Borrar todas las ventas registradas?")) return;
    setVentas([]); setVentasRes([]);
  };

  const exportarPDF = () => {
    const colaborador = profile?.full_name || profile?.email || "";
    const html = buildPymePdfHtml(ventasFiltradas, totalComisiones, mesVentaFiltro, colaborador);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close();
  };

  const exportarPDFRes = () => {
    const colaborador = profile?.full_name || profile?.email || "";
    const html = buildResPdfHtml(ventasResFiltradas, totalComisionesRes, mesVentaFiltro, colaborador, resRappel);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close();
  };

  // ── RENDER ──
  const res = resultado?.data;
  const isNC = res === "NC";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-lg font-black text-[#002855]">Calculadora de Comisiones</h2>
          <p className="text-xs text-slate-400 mt-0.5">Tabla vigente desde 01/02/2026</p>
        </div>
        {profile?.full_name && (
          <span className="text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg">
            {profile.full_name}
          </span>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-sm">
        {([["pyme","🏢","Pyme"],["res","🏠","Residencial"],["ventas","📋","Mis Ventas"]] as const).map(([key, emoji, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${tab === key ? "bg-[#002855] text-white shadow" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
            <span>{emoji}</span> {label}
            {key === "ventas" && (ventas.length + ventasRes.length) > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                {ventas.length + ventasRes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ TAB PYME ══ */}
      {tab === "pyme" && (
        <div className="space-y-4">
          {/* Datos cliente */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <p className="text-[11px] font-black text-[#002855] tracking-widest uppercase">👤 Datos del cliente</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre / Razón Social</label>
                <input type="text" placeholder="Empresa S.L." value={nombreCliente} onChange={e => setNombreCliente(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CUPS</label>
                <input type="text" placeholder="ES0021..." value={cupsPyme} onChange={e => setCupsPyme(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tarifa Eléctrica Contratada</label>
              <select value={tarifaCliente} onChange={e => handleTarifaChange(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white">
                {TARIFAS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="max-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Venta</label>
              <input type="date" value={fechaVentaPyme} onChange={e => setFechaVentaPyme(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
            </div>
          </div>

          {/* Consumo */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <p className="text-[11px] font-black text-[#002855] tracking-widest uppercase">⚡ Consumo Anual</p>
            <div className="flex bg-slate-50 rounded-xl p-1 gap-1">
              {([["anual","📅 Total anual"],["mensual","📆 Mes a mes"]] as const).map(([m, lbl]) => (
                <button key={m} type="button" onClick={() => { setModoCalc(m); setResultado(null); }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${modoCalc === m ? "bg-white shadow text-slate-800" : "text-slate-400"}`}>{lbl}</button>
              ))}
            </div>

            {modoCalc === "anual" && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">kWh/Año</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type="text" inputMode="decimal" placeholder="Ej: 85.000" value={inputAnual}
                      onChange={e => { setInputAnual(e.target.value); setResultado(null); setErrorCalc(""); }}
                      onKeyDown={e => e.key === "Enter" && handleCalc()}
                      className={`w-full border rounded-xl px-3 py-3 text-lg font-black text-slate-800 pr-12 focus:outline-none focus:ring-2 focus:ring-orange-100 ${errorCalc ? "border-red-400" : "border-slate-200 focus:border-orange-400"}`} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">kWh</span>
                  </div>
                  <button type="button" onClick={handleCalc}
                    className="px-5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl shadow transition-colors">
                    Calcular
                  </button>
                </div>
                {errorCalc && <p className="text-red-500 text-xs">⚠ {errorCalc}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {[5000,25000,75000,150000,500000,900000].map(v => (
                    <button key={v} type="button" onClick={() => { setInputAnual(v.toLocaleString("es-ES")); setErrorCalc(""); setResultado(null); }}
                      className="px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors">
                      {v.toLocaleString("es-ES")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modoCalc === "mensual" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">kWh por mes</label>
                  <button type="button" onClick={limpiarCalc} className="text-[10px] text-slate-400 hover:text-red-500 font-bold transition-colors">🗑 Limpiar</button>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m, i) => (
                    <div key={m} className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 text-center">{m}</span>
                      <input type="number" min="0" placeholder="0" value={mesesInput[i]}
                        onChange={e => { const n = [...mesesInput]; n[i] = e.target.value; setMesesInput(n); setResultado(null); }}
                        className={`w-full text-right text-xs font-bold rounded-lg px-1.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 border ${parseNum(mesesInput[i]) > 0 ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-slate-50 border-slate-200 text-slate-600"}`} />
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between items-center">
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total acumulado</div>
                    <div className="text-xl font-black text-slate-800">{totalMensual.toLocaleString("es-ES")} <span className="text-xs font-normal text-slate-400">kWh/año</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Meses</div>
                    <div className="text-base font-black text-slate-600">{mesesInput.filter(v => parseNum(v) > 0).length}<span className="text-xs text-slate-400">/12</span></div>
                  </div>
                </div>
                <button type="button" onClick={handleCalc} disabled={totalMensual <= 0}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${totalMensual > 0 ? "bg-orange-500 hover:bg-orange-600 text-white shadow" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                  {totalMensual > 0 ? `⚡ Calcular — ${totalMensual.toLocaleString("es-ES")} kWh/año` : "Introduce los consumos mensuales"}
                </button>
              </div>
            )}
          </div>

          {/* Resultado */}
          {resultado && (
            <div className="space-y-3">
              <div className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${isNC ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
                <span className="text-2xl">{isNC ? "🚫" : "📊"}</span>
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Consumo calculado</div>
                  <div className="text-xl font-black text-slate-800">{resultado.kwh.toLocaleString("es-ES")} <span className="text-xs font-normal text-slate-400">kWh/año</span></div>
                  {isNC && <p className="text-red-500 text-xs font-bold">No comercializable — máx. 1.000.000 kWh</p>}
                  {!isNC && res && "metodo" in res && (
                    <p className="text-green-600 text-[10px] font-bold">
                      {res.metodo === "plana" && "Tramo ≤10.000 kWh · Comisión fija"}
                      {res.metodo === "formula_fijo" && `Tramo 10.001–400.000 kWh · Precio Fijo por MWh (${res.mwh?.toFixed(3)} MWh)`}
                      {res.metodo === "tabla_alta" && "Tramo >400.000 kWh · Tabla fija"}
                    </p>
                  )}
                </div>
              </div>

              {!isNC && res && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  {/* Fijo */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider">Precio Fijo</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["one","luz","supra"] as PlanPlan[]).map(k => (
                        <button key={k} type="button" onClick={() => { setPlanSel({ tipo: "fijo", plan: k }); setTarifaCliente(`Plan Fijo Luz ${k === "one" ? "ONE" : k === "supra" ? "Supra" : ""}`.trim().replace(/\s+/, " ")); }}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${planSel?.tipo === "fijo" && planSel?.plan === k ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">{k === "one" ? "Fijo Luz ONE" : k === "luz" ? "Fijo Luz" : "Fijo Luz Supra"}</div>
                          <div className="text-lg font-black text-slate-800">{fmtEur(res.fijo[k])}</div>
                          {planSel?.tipo === "fijo" && planSel?.plan === k && <div className="text-[9px] text-orange-500 font-bold mt-0.5">✓ Seleccionado</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Variable */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Precio Variable</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["one","luz","supra"] as PlanPlan[]).map(k => (
                        <button key={k} type="button" onClick={() => { setPlanSel({ tipo: "variable", plan: k }); setTarifaCliente(`Plan Variable Luz ${k === "one" ? "ONE" : k === "supra" ? "Supra" : ""}`.trim().replace(/\s+/, " ")); }}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${planSel?.tipo === "variable" && planSel?.plan === k ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">{k === "one" ? "Variable Luz ONE" : k === "luz" ? "Variable Luz" : "Variable Luz Supra"}</div>
                          <div className="text-lg font-black text-slate-800">{fmtEur(res.variable[k])}</div>
                          {planSel?.tipo === "variable" && planSel?.plan === k && <div className="text-[9px] text-blue-600 font-bold mt-0.5">✓ Seleccionado</div>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {planSel && comisionSeleccionada !== null && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex justify-between items-center bg-slate-50 rounded-xl px-4 py-3">
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">Plan seleccionado</div>
                          <div className="text-sm font-black text-slate-800">{planLabel(planSel.tipo, planSel.plan)}</div>
                          {nombreCliente && <div className="text-xs text-slate-500">{nombreCliente}{cupsPyme && ` · ${cupsPyme}`}</div>}
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-bold text-slate-400 uppercase">Comisión</div>
                          <div className="text-2xl font-black text-orange-500">{fmtEur(comisionSeleccionada)}</div>
                        </div>
                      </div>
                      <button type="button" onClick={añadirVenta} disabled={!nombreCliente.trim()}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${nombreCliente.trim() ? "bg-green-600 hover:bg-green-700 text-white shadow" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                        {nombreCliente.trim() ? `➕ Añadir a Mis Ventas — ${fmtEur(comisionSeleccionada)}` : "⚠ Introduce el nombre del cliente primero"}
                      </button>
                      {msgAdded && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-green-700 text-xs font-bold text-center">✅ Cliente añadido a Mis Ventas</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB RESIDENCIAL ══ */}
      {tab === "res" && (
        <div className="space-y-4">
          {/* Datos cliente */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <p className="text-[11px] font-black text-violet-700 tracking-widest uppercase">👤 Datos del cliente</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                <input type="text" placeholder="Apellidos, Nombre" value={resNombre} onChange={e => setResNombre(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CUPS</label>
                <input type="text" placeholder="ES0021..." value={resCups} onChange={e => setResCups(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </div>
            </div>
            <div className="max-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Venta</label>
              <input type="date" value={resFechaVenta} onChange={e => setResFechaVenta(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            </div>
          </div>

          {/* Producto */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <p className="text-[11px] font-black text-violet-700 tracking-widest uppercase">🛒 Producto contratado</p>
            <div className="grid grid-cols-2 gap-2">
              {RES_PRODUCTOS.map(p => (
                <button key={p.value} type="button" onClick={() => setResProducto(p.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${resProducto === p.value ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-slate-300"}`}>
                  <div className="text-xl mb-1">{p.emoji}</div>
                  <div className="text-xs font-black text-slate-800">{p.label}</div>
                  <div className="text-lg font-black text-violet-600">{fmtEur(resComisiones[p.value])}</div>
                  {resProducto === p.value && <div className="text-[9px] text-violet-500 font-bold">✓ Seleccionado</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Comisiones base editables */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <p className="text-[11px] font-black text-violet-700 tracking-widest uppercase">💶 Comisiones base (editables)</p>
            <div className="grid grid-cols-2 gap-3">
              {RES_PRODUCTOS.map(p => (
                <div key={p.value} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{p.emoji} {p.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" value={resComisiones[p.value]}
                      onChange={e => setResComisiones(prev => ({ ...prev, [p.value]: +e.target.value }))}
                      className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-lg font-black text-slate-800 focus:outline-none focus:border-violet-400" />
                    <span className="text-sm font-bold text-slate-400">€</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rappel / Adoc */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <p className="text-[11px] font-black text-violet-700 tracking-widest uppercase">📈 Rappel / Adoc</p>
            <div className="flex bg-slate-50 rounded-xl p-1 gap-1">
              {([["rappel","📊 Rappel"],["adoc","🤝 Adoc"]] as const).map(([k, lbl]) => (
                <button key={k} type="button" onClick={() => setResExtraTab(k)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${resExtraTab === k ? "bg-violet-600 text-white shadow" : "text-slate-400 hover:text-slate-600"}`}>{lbl}</button>
              ))}
            </div>
            <div className="space-y-2">
              {resExtraTab === "rappel" && resRappelTramos.map(t => (
                <div key={t.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${t.activo ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex-1">
                    <div className={`text-xs font-bold ${t.activo ? "text-violet-700" : "text-slate-600"}`}>{t.label}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs font-bold text-green-600">+</span>
                      <input type="number" value={t.valor}
                        onChange={e => setResRappelTramos(prev => prev.map(x => x.id === t.id ? { ...x, valor: +e.target.value } : x))}
                        className="w-14 border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-black focus:outline-none focus:border-violet-400" />
                      <span className="text-xs text-slate-400">€/contrato</span>
                    </div>
                  </div>
                  <label className="cursor-pointer ml-3">
                    <input type="checkbox" className="sr-only" checked={t.activo}
                      onChange={e => setResRappelTramos(prev => prev.map(x => x.id === t.id ? { ...x, activo: e.target.checked } : x))} />
                    <div className={`w-11 h-6 rounded-full relative transition-colors ${t.activo ? "bg-violet-600" : "bg-slate-300"}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${t.activo ? "left-6" : "left-1"}`} />
                    </div>
                  </label>
                </div>
              ))}
              {resExtraTab === "adoc" && resAdocTramos.map(t => (
                <div key={t.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${t.activo ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${t.activo ? "text-cyan-700" : "text-slate-600"}`}>{t.label}</span>
                      <input type="text" placeholder="Ref: 1-5" value={t.ref}
                        onChange={e => setResAdocTramos(prev => prev.map(x => x.id === t.id ? { ...x, ref: e.target.value } : x))}
                        className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-500 focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs font-bold text-green-600">+</span>
                      <input type="number" value={t.valor}
                        onChange={e => setResAdocTramos(prev => prev.map(x => x.id === t.id ? { ...x, valor: +e.target.value } : x))}
                        className="w-14 border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-black focus:outline-none focus:border-cyan-400" />
                      <span className="text-xs text-slate-400">€/contrato</span>
                    </div>
                  </div>
                  <label className="cursor-pointer ml-3">
                    <input type="checkbox" className="sr-only" checked={t.activo}
                      onChange={e => setResAdocTramos(prev => prev.map(x => x.id === t.id ? { ...x, activo: e.target.checked } : x))} />
                    <div className={`w-11 h-6 rounded-full relative transition-colors ${t.activo ? "bg-cyan-600" : "bg-slate-300"}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${t.activo ? "left-6" : "left-1"}`} />
                    </div>
                  </label>
                </div>
              ))}
            </div>
            {resRappel > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs font-bold text-green-700">
                Bonus activo: +{fmtEur(resRappel)} por contrato
              </div>
            )}
          </div>

          {/* Resultado y añadir */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Comisión Total</div>
                <div className="text-xs text-slate-500">{fmtEur(resComisiones[resProducto])} base{resRappel > 0 ? ` + ${fmtEur(resRappel)} rappel` : ""}</div>
              </div>
              <div className="text-3xl font-black text-violet-600">{fmtEur(resComisionTotal)}</div>
            </div>
            <button type="button" onClick={añadirVentaRes} disabled={!resNombre.trim()}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${resNombre.trim() ? "bg-violet-600 hover:bg-violet-700 text-white shadow" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
              {resNombre.trim() ? `➕ Añadir a Mis Ventas — ${fmtEur(resComisionTotal)}` : "⚠ Introduce el nombre del cliente primero"}
            </button>
            {resMsgAdded && <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 text-violet-700 text-xs font-bold text-center">✅ Cliente añadido a Mis Ventas Residencial</div>}
          </div>
        </div>
      )}

      {/* ══ TAB MIS VENTAS ══ */}
      {tab === "ventas" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-sm">
            <button type="button" onClick={() => setTabVentas("pyme")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tabVentas === "pyme" ? "bg-[#002855] text-white shadow" : "text-slate-500 hover:bg-slate-50"}`}>
              🏢 Pyme {ventas.length > 0 && <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{ventas.length}</span>}
            </button>
            <button type="button" onClick={() => setTabVentas("res")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${tabVentas === "res" ? "bg-violet-600 text-white shadow" : "text-slate-500 hover:bg-slate-50"}`}>
              🏠 Residencial {ventasRes.length > 0 && <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{ventasRes.length}</span>}
            </button>
          </div>

          {/* Acciones y backup */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="flex gap-2">
                <button type="button" onClick={exportarExcel}
                  className="text-[10px] font-bold border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors">💾 Guardar copia (Excel)</button>
                <label className="text-[10px] font-bold border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
                  📂 Abrir copia
                  <input ref={importRef} type="file" accept=".xlsx" onChange={importData} className="hidden" />
                </label>
              </div>
              <button type="button" onClick={limpiarTodo} className="text-[10px] font-bold border border-red-200 rounded-lg px-3 py-1.5 text-red-400 hover:bg-red-50 transition-colors">🗑 Limpiar todo</button>
            </div>
          </div>

          {/* Selector mes + KPIs + exportar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap gap-3 justify-between items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mes de cobro</label>
                <select value={mesVentaFiltro} onChange={e => setMesVentaFiltro(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-orange-400 bg-white">
                  {mesesDisponibles.map(k => (
                    <option key={k} value={k}>{k === "pendientes" ? "⌛ Ventas sin activar" : mesLabel(k)}{k === mesKey(hoy()) ? " (actual)" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                {tabVentas === "pyme" && <>
                  <button type="button" onClick={exportarExcel} disabled={ventasFiltradas.length === 0}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${ventasFiltradas.length > 0 ? "border-green-200 text-green-700 bg-green-50 hover:bg-green-100" : "border-slate-200 text-slate-300 cursor-not-allowed"}`}>📊 Excel</button>
                  <button type="button" onClick={exportarPDF} disabled={ventasFiltradas.length === 0}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${ventasFiltradas.length > 0 ? "border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100" : "border-slate-200 text-slate-300 cursor-not-allowed"}`}>🖨 PDF</button>
                </>}
                {tabVentas === "res" && <>
                  <button type="button" onClick={exportarExcelRes} disabled={ventasResFiltradas.length === 0}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${ventasResFiltradas.length > 0 ? "border-green-200 text-green-700 bg-green-50 hover:bg-green-100" : "border-slate-200 text-slate-300 cursor-not-allowed"}`}>📊 Excel</button>
                  <button type="button" onClick={exportarPDFRes} disabled={ventasResFiltradas.length === 0}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${ventasResFiltradas.length > 0 ? "border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100" : "border-slate-200 text-slate-300 cursor-not-allowed"}`}>🖨 PDF</button>
                </>}
              </div>
            </div>

            {/* KPIs */}
            {tabVentas === "pyme" && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  { label: "Clientes", val: ventasFiltradas.length, color: "text-[#002855]" },
                  { label: "Total comisiones", val: fmtEur(totalComisiones), color: "text-orange-500" },
                  { label: "Media/cliente", val: ventasFiltradas.length > 0 ? fmtEur(totalComisiones / ventasFiltradas.length) : "—", color: "text-violet-600" },
                ].map(k => (
                  <div key={k.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</div>
                    <div className={`text-base font-black mt-0.5 ${k.color}`}>{k.val}</div>
                  </div>
                ))}
              </div>
            )}
            {tabVentas === "res" && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  { label: "Clientes", val: ventasResFiltradas.length, color: "text-violet-600" },
                  { label: "Total comisiones", val: fmtEur(totalComisionesRes), color: "text-violet-700" },
                  { label: "Media/cliente", val: ventasResFiltradas.length > 0 ? fmtEur(totalComisionesRes / ventasResFiltradas.length) : "—", color: "text-violet-500" },
                ].map(k => (
                  <div key={k.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</div>
                    <div className={`text-base font-black mt-0.5 ${k.color}`}>{k.val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista ventas PYME */}
          {tabVentas === "pyme" && (
            ventasFiltradas.length === 0
              ? <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
                  <div className="text-4xl mb-3">🏢</div>
                  <div className="font-bold text-slate-400">Sin ventas Pyme en {mesLabel(mesVentaFiltro)}</div>
                  <div className="text-xs text-slate-300 mt-1">Usa la pestaña 🏢 Pyme para añadir ventas</div>
                </div>
              : <div className="space-y-2">
                  {ventasFiltradas.map((v, i) => (
                    <div key={v.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex justify-between items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400 shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-800 truncate">{v.nombre}</span>
                            {v.cups && <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{v.cups}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-lg">{v.planLabel}</span>
                            <span className="text-[10px] text-slate-400">{v.kwh.toLocaleString("es-ES")} kWh</span>
                            <span className="text-[9px] font-bold text-slate-400">F.ACT.</span>
                            <input type="date" value={v.fechaActivacion || ""} onChange={e => updateFechaActivacion(v.id, e.target.value)}
                              className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 text-slate-500 focus:outline-none focus:border-orange-400" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-lg font-black text-orange-500">{fmtEur(v.comision)}</div>
                          <div className="text-[9px] text-slate-400">Pago: {mesLabel(v.mesCobro)}</div>
                        </div>
                        <button type="button" onClick={() => setVentas(prev => prev.filter(x => x.id !== v.id))}
                          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 text-sm flex items-center justify-center transition-colors">×</button>
                      </div>
                    </div>
                  ))}
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] font-black text-orange-700 uppercase tracking-wider">Total Pyme · {mesLabel(mesVentaFiltro)}</div>
                      <div className="text-xs text-orange-600 font-semibold mt-0.5">{ventasFiltradas.length} cliente{ventasFiltradas.length !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="text-2xl font-black text-orange-500">{fmtEur(totalComisiones)}</div>
                  </div>
                </div>
          )}

          {/* Lista ventas Residencial */}
          {tabVentas === "res" && (
            ventasResFiltradas.length === 0
              ? <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
                  <div className="text-4xl mb-3">🏠</div>
                  <div className="font-bold text-slate-400">Sin ventas Residencial en {mesLabel(mesVentaFiltro)}</div>
                  <div className="text-xs text-slate-300 mt-1">Usa la pestaña 🏠 Residencial para añadir ventas</div>
                </div>
              : <div className="space-y-2">
                  {ventasResFiltradas.map((v, i) => {
                    const prod = RES_PRODUCTOS.find(p => p.value === v.producto);
                    const total = v.comisionBase + resRappel;
                    return (
                      <div key={v.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex justify-between items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400 shrink-0">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-800 truncate">{v.nombre}</span>
                              {v.cups && <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{v.cups}</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded-lg">{prod?.emoji} {prod?.label}</span>
                              {resRappel > 0 && <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-lg">+{fmtEur(resRappel)} {resActiveLabels}</span>}
                              <span className="text-[9px] font-bold text-slate-400">F.ACT.</span>
                              <input type="date" value={v.fechaActivacion || ""} onChange={e => updateFechaActivacionRes(v.id, e.target.value)}
                                className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 text-slate-500 focus:outline-none focus:border-violet-400" />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-lg font-black text-violet-600">{fmtEur(total)}</div>
                            <div className="text-[9px] text-slate-400">Pago: {mesLabel(v.mesCobro)}</div>
                          </div>
                          <button type="button" onClick={() => setVentasRes(prev => prev.filter(x => x.id !== v.id))}
                            className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 text-sm flex items-center justify-center transition-colors">×</button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="bg-gradient-to-r from-violet-50 to-purple-50 border-2 border-violet-300 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] font-black text-violet-700 uppercase tracking-wider">Total Residencial · {mesLabel(mesVentaFiltro)}</div>
                      <div className="text-xs text-violet-600 font-semibold mt-0.5">{ventasResFiltradas.length} cliente{ventasResFiltradas.length !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="text-2xl font-black text-violet-600">{fmtEur(totalComisionesRes)}</div>
                  </div>
                </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PDF helpers ───────────────────────────────────────────────────────────────
function buildPymePdfHtml(ventas: VentaPyme[], total: number, mes: string, colaborador: string): string {
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Comisiones Pyme – ${mesLabel(mes)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:32px;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;border-bottom:3px solid #ED7004;padding-bottom:16px}
.logo{font-size:22px;font-weight:800;color:#ED7004}.logo span{color:#1e293b}
.meta{text-align:right;font-size:12px;color:#64748b}.meta strong{display:block;font-size:14px;color:#1e293b;font-weight:700}
h2{font-size:16px;font-weight:700;color:#1e293b;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#f8fafc;color:#64748b;font-weight:700;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:10px;text-transform:uppercase}
td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
tr:nth-child(even) td{background:#fafafa}
.num{text-align:right;font-weight:600}
.total-row td{background:#0f172a!important;color:#fff;font-weight:800;font-size:13px}
.total-row .num{color:#ED7004}
.footer{margin-top:24px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px}
@media print{body{padding:16px}}
</style></head><body>
<div class="header">
<div><div class="logo">⚡ Naturgy <span>Colaboradores</span></div>
<div style="font-size:12px;color:#64748b;margin-top:4px">Comisiones Pymes · Vigente desde 01/02/2026</div></div>
<div class="meta"><strong>Comisiones ${mesLabel(mes)}</strong>
${colaborador ? `<span style="display:block;font-size:13px;color:#1e293b;font-weight:700;margin-top:2px">👤 ${colaborador}</span>` : ""}
Generado: ${fecha}</div>
</div>
<h2>Ventas del mes · ${ventas.length} cliente${ventas.length !== 1 ? "s" : ""}</h2>
<table><thead><tr>
<th>#</th><th>Cliente</th><th>CUPS</th><th>Tarifa</th><th>Consumo kWh/año</th><th>Plan</th>
<th class="num">Comisión</th><th>F. Venta</th><th>F. Activación</th><th>Mes Pago</th>
</tr></thead><tbody>
${ventas.map((v, i) => `<tr>
<td style="color:#94a3b8;font-size:11px">${i + 1}</td>
<td><strong>${v.nombre}</strong></td>
<td style="font-family:monospace;font-size:10px">${v.cups || "—"}</td>
<td><span style="background:#f1f5f9;color:#475569;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">${v.tarifa || "—"}</span></td>
<td class="num">${v.kwh.toLocaleString("es-ES")}</td>
<td><span style="background:#fff7ed;color:#ED7004;border:1px solid #fed7aa;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700">${v.planLabel}</span></td>
<td class="num" style="color:#ED7004;font-weight:700">${v.comision.toFixed(2).replace(".", ",")} €</td>
<td>${v.fechaVenta}</td><td>${v.fechaActivacion || "—"}</td><td>${mesLabel(v.mesCobro)}</td>
</tr>`).join("")}
</tbody><tfoot><tr class="total-row">
<td colspan="6" style="padding-left:10px">TOTAL COMISIONES</td>
<td class="num">${total.toFixed(2).replace(".", ",")} €</td>
<td colspan="3"></td>
</tr></tfoot></table>
<div class="footer">CRIS ENERGY SL B04990925 · N/C = No comercializable para consumos >1.000.000 kWh/año</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;
}

function buildResPdfHtml(ventas: VentaRes[], total: number, mes: string, colaborador: string, rappel: number): string {
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Comisiones Residencial – ${mesLabel(mes)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;color:#1e293b;padding:32px;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;border-bottom:3px solid #7c3aed;padding-bottom:16px}
.logo{font-size:22px;font-weight:800;color:#7c3aed}.logo span{color:#1e293b}
.meta{text-align:right;font-size:12px;color:#64748b}.meta strong{display:block;font-size:14px;color:#1e293b;font-weight:700}
h2{font-size:16px;font-weight:700;color:#1e293b;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#f8fafc;color:#64748b;font-weight:700;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:10px;text-transform:uppercase}
td{padding:9px 10px;border-bottom:1px solid #f1f5f9}
tr:nth-child(even) td{background:#fafafa}
.num{text-align:right;font-weight:600}
.total-row td{background:#0f172a!important;color:#fff;font-weight:800;font-size:13px}
.total-row .num{color:#7c3aed}
.footer{margin-top:24px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px}
@media print{body{padding:16px}}
</style></head><body>
<div class="header">
<div><div class="logo">🏠 Naturgy <span>Residencial</span></div>
<div style="font-size:12px;color:#64748b;margin-top:4px">Comisiones Residencial · ${mesLabel(mes)}</div></div>
<div class="meta"><strong>Comisiones ${mesLabel(mes)}</strong>
${colaborador ? `<span style="display:block;font-size:13px;color:#1e293b;font-weight:700;margin-top:2px">👤 ${colaborador}</span>` : ""}
Generado: ${fecha}</div>
</div>
<h2>Ventas del mes · ${ventas.length} cliente${ventas.length !== 1 ? "s" : ""}</h2>
<table><thead><tr>
<th>#</th><th>Cliente</th><th>CUPS</th><th>Producto</th><th class="num">Base</th><th class="num">Rappel</th><th class="num">Total</th><th>F. Venta</th><th>F. Activación</th><th>Mes Pago</th>
</tr></thead><tbody>
${ventas.map((v, i) => `<tr>
<td style="color:#94a3b8;font-size:11px">${i + 1}</td>
<td><strong>${v.nombre}</strong></td>
<td style="font-family:monospace;font-size:10px">${v.cups || "—"}</td>
<td style="font-weight:700;text-transform:uppercase">${v.producto}</td>
<td class="num">${v.comisionBase.toFixed(2).replace(".", ",")} €</td>
<td class="num" style="color:#16a34a">${rappel > 0 ? "+" + rappel.toFixed(2).replace(".", ",") + " €" : "—"}</td>
<td class="num" style="color:#7c3aed;font-weight:700">${(v.comisionBase + rappel).toFixed(2).replace(".", ",")} €</td>
<td>${v.fechaVenta}</td><td>${v.fechaActivacion || "—"}</td><td>${mesLabel(v.mesCobro)}</td>
</tr>`).join("")}
</tbody><tfoot><tr class="total-row">
<td colspan="6" style="padding-left:10px">TOTAL COMISIONES</td>
<td class="num">${total.toFixed(2).replace(".", ",")} €</td>
<td colspan="3"></td>
</tr></tfoot></table>
<div class="footer">CRIS ENERGY SL B04990925 · App creada por Grupo LMB ©2026</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;
}
