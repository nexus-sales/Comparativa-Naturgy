import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { calc, fmtEur, fmtRaw, makeDefaultClient, CHART_COLS, SEG_DEFS } from "../../utils/calculations";
import type { SegCliente, TarifaLocal } from "../../utils/calculations";
import type { ComercialData } from "../../utils/pdfExport";
import { Trash2, AlertTriangle, Shield } from "lucide-react";
import type { Chart as ChartInstance } from "chart.js";
import type { Segment, Tariff, Profile } from "../../types";
import type { User } from "@supabase/supabase-js";

interface ComparatorViewProps {
  segments: Segment[];
  tariffs: Tariff[];
  isAdmin: boolean;
  profile: Profile | null;
  user: User;
}

export function ComparatorView({ segments, tariffs, isAdmin, profile, user }: ComparatorViewProps) {
  const [clients, setClients] = useState<Record<string, SegCliente>>({});
  const hasInitializedClients = useRef(false);
  const [activeSeg, setActiveSeg] = useState("res");
  const [subTabs, setSubTabs] = useState<Record<string, string>>({ res: "cli", pyme20: "cli", pyme20one: "cli", pyme361: "cli" });
  const [tariffMeta, setTariffMeta] = useState<Record<string, { selected: boolean; open: boolean }>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const chartInstances = useRef<Record<string, ChartInstance>>({});

  const [comercialData, setComercialData] = useState<ComercialData>({
    nombre: profile?.full_name || "Comercial",
    telefono: profile?.phone || "",
    email: profile?.email || user?.email || ""
  });

  useEffect(() => {
    if (segments.length > 0 && !hasInitializedClients.current) {
      const init: Record<string, SegCliente> = {};
      segments.forEach(s => {
        init[s.id] = {
          ...makeDefaultClient(s.id),
          bonoRate: s.bono_rate,
          excedenteRate: s.excedente_rate,
          taxImpElec: s.tax_imp_elec,
          taxIGIC: s.tax_igic,
          taxIGICRed: s.tax_igic_red,
          taxIGIC7: s.tax_igic_7
        };
      });
      setClients(init);
      hasInitializedClients.current = true;
    }
  }, [segments]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (profile) {
      setComercialData({
        nombre: profile.full_name || "Comercial",
        telefono: profile.phone || "",
        email: profile.email || user?.email || ""
      });
    }
  }, [profile, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const segDef = SEG_DEFS.find(s => s.id === activeSeg) ?? SEG_DEFS[0];

  const getSegMeta = useCallback((segId: string) => {
    const seg = segments.find(s => s.id === segId);
    return { taxModel: seg?.tax_model ?? (segId === "res" ? "res" : "pyme"), potP: seg?.pot_p ?? 2 };
  }, [segments]);

  const getSegTariffs = useCallback((segId: string): TarifaLocal[] =>
    tariffs
      .filter(t => t.segment_id === segId)
      .map(t => ({
        id: t.id,
        nombre: t.name,
        tipo: t.type as "uni" | "tri" | "hex",
        potUnit: t.pot_unit as "dia" | "anio",
        rPot: t.r_pot,
        rEn: t.r_en,
        sva: t.sva,
        open: tariffMeta[t.id]?.open ?? false,
        selected: tariffMeta[t.id]?.selected ?? true,
        requires_auth: t.requires_auth,
      })), [tariffs, tariffMeta]);

  const upClient = (segId: string, field: keyof SegCliente, val: unknown) =>
    setClients(prev => ({ ...prev, [segId]: { ...prev[segId], [field]: val } }));

  const upClientArr = (segId: string, field: "kw" | "en", idx: number, val: number) =>
    setClients(prev => {
      const arr = [...prev[segId][field]] as number[];
      arr[idx] = val;
      return { ...prev, [segId]: { ...prev[segId], [field]: arr } };
    });

  const upDate = (segId: string, field: "f1" | "f2", val: string) =>
    setClients(prev => {
      const updated = { ...prev[segId], [field]: val };
      const f1 = field === "f1" ? val : updated.f1;
      const f2 = field === "f2" ? val : updated.f2;
      if (f1 && f2) {
        const d = Math.round((new Date(f2).getTime() - new Date(f1).getTime()) / 86400000);
        if (d > 0) updated.dias = d;
      }
      return { ...prev, [segId]: updated };
    });

  const clearClient = (segId: string) => {
    if (!confirm("¿Limpiar todos los datos del cliente? Esta acción no se puede deshacer.")) return;
    const keep = (({ bonoRate, excedenteRate, taxImpElec, taxIGIC, taxIGICRed, taxIGIC7, alquiler }) =>
      ({ bonoRate, excedenteRate, taxImpElec, taxIGIC, taxIGICRed, taxIGIC7, alquiler }))(clients[segId]);
    setClients(prev => ({ ...prev, [segId]: { ...makeDefaultClient(segId), ...keep, nombre: "", cups: "", dir: "", f1: "", f2: "", dias: 0, kw: [0,0,0,0,0,0], en: [0,0,0,0,0,0], enExc: 0, factura: 0 } }));
  };

  const toggleSelected = (id: string) =>
    setTariffMeta(prev => ({ ...prev, [id]: { open: prev[id]?.open ?? false, selected: !(prev[id]?.selected ?? true) } }));

  const toggleOpen = (id: string) =>
    setTariffMeta(prev => ({ ...prev, [id]: { selected: prev[id]?.selected ?? true, open: !(prev[id]?.open ?? false) } }));

  const setSubTab = (tab: string) => setSubTabs(prev => ({ ...prev, [activeSeg]: tab }));

  const saveFiscalConfig = async (segId: string) => {
    const c = clients[segId];
    const { error } = await supabase.from("segments").update({
      bono_rate: c.bonoRate,
      excedente_rate: c.excedenteRate,
      tax_imp_elec: c.taxImpElec,
      tax_igic: c.taxIGIC,
      tax_igic_red: c.taxIGICRed,
      tax_igic_7: c.taxIGIC7
    }).eq("id", segId);
    if (error) alert("Error: " + error.message);
    else alert("Configuración fiscal guardada.");
  };

  useEffect(() => {
    const sub = subTabs[activeSeg];
    if (sub !== "comp") return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const {
        Chart,
        BarController,
        BarElement,
        CategoryScale,
        LinearScale,
        Tooltip,
      } = await import("chart.js");

      if (cancelled) return;
      Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

      const segId = activeSeg;
      const canvas = document.getElementById(`compChart_${segId}`) as HTMLCanvasElement | null;
      if (!canvas) return;
      if (chartInstances.current[segId]) { chartInstances.current[segId].destroy(); delete chartInstances.current[segId]; }

      const c = clients[segId];
      if (!c) return;

      const { taxModel, potP } = getSegMeta(segId);
      const segTariffs = getSegTariffs(segId);
      const selected = segTariffs.filter(t => t.selected);
      if (!selected.length) return;
      const results = selected.map((t, i) => ({ t, r: calc(taxModel, potP, c, t), color: CHART_COLS[i % CHART_COLS.length] }));
      const best = results.reduce((a, b) => b.r.total < a.r.total ? b : a, results[0]);

      /* eslint-disable @typescript-eslint/no-explicit-any */
      chartInstances.current[segId] = new Chart(canvas, {
        type: "bar",
        data: {
          labels: ["Factura actual", ...results.map(x => x.t.nombre)],
          datasets: [{
            data: [+c.factura, ...results.map(x => +x.r.total.toFixed(2))],
            backgroundColor: ["#94a3b8", ...results.map(x => x.t.id === best.t.id ? "#F5821F" : x.color)],
          }] as any,
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        }
      } as any);
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSeg, subTabs, clients, tariffMeta, segments, tariffs, getSegMeta, getSegTariffs]);

  const AuthWarning = () => activeSeg !== "pyme20one" ? null : (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
      <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
      <div className="text-sm">
        <strong className="text-amber-800">Autorización previa requerida</strong>
        <p className="text-amber-700 mt-0.5">Consulta con tu responsable antes de ofertar este segmento.</p>
      </div>
    </div>
  );

  const TariffPane = ({ segId }: { segId: string }) => {
    const { taxModel, potP } = getSegMeta(segId);
    const segTariffs = getSegTariffs(segId);
    const c = clients[segId];
    if (!segTariffs.length) return <div className="p-12 text-center text-slate-400">No hay tarifas disponibles.</div>;

    return (
      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <AuthWarning />
        {segTariffs.map(t => {
          const r = calc(taxModel, potP, c, t);
          const ah = +(c.factura - r.total).toFixed(2);
          const isOpen = tariffMeta[t.id]?.open;
          const isSelected = tariffMeta[t.id]?.selected ?? true;
          return (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50" onClick={()=>toggleOpen(t.id)}>
                <input aria-label={`Seleccionar tarifa ${t.nombre}`} type="checkbox" checked={isSelected} className="w-4 h-4" onClick={e=>{e.stopPropagation(); toggleSelected(t.id);}} onChange={()=>{}}/>
                <span className={`text-slate-400 text-[10px] transition-transform ${isOpen?"rotate-90":""}`}>›</span>
                <div className="flex-1 font-bold text-slate-800 text-sm">{t.nombre}</div>
                <div className="text-right">
                  <div className="font-black text-[#002855]">{fmtEur(r.total)}</div>
                  {c.factura>0 && <div className={`text-[10px] font-bold ${ah>0.005?"text-green-600":"text-red-500"}`}>{ah>0?"-":"+"}{fmtEur(Math.abs(ah))}</div>}
                </div>
              </div>
              {isOpen && (
                <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-[11px] text-slate-600">
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="font-bold opacity-50 uppercase text-[9px] mb-1 text-orange-600">Potencia (€/kW)</p>{t.rPot.map((v,i)=>v>0?(<div key={i} className="flex justify-between"><span>P{i+1}</span><span>{v.toFixed(6)}</span></div>):null)}</div>
                    <div><p className="font-bold opacity-50 uppercase text-[9px] mb-1 text-blue-600">Energía (€/kWh)</p>{t.rEn.map((v,i)=>v>0?(<div key={i} className="flex justify-between"><span>P{i+1}</span><span>{v.toFixed(6)}</span></div>):null)}</div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-x-8 gap-y-1">
                    <div className="flex justify-between"><span>Potencia bruta</span><span>{fmtEur(r.potencia)}</span></div>
                    <div className="flex justify-between"><span>Energía bruta</span><span>{fmtEur(r.energia)}</span></div>
                    <div className="flex justify-between"><span>Alquiler</span><span>{fmtEur(r.alquiler)}</span></div>
                    <div className="flex justify-between font-bold text-slate-900"><span>TOTAL</span><span>{fmtEur(r.total)}</span></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const CompPane = ({ segId }: { segId: string }) => {
    const c = clients[segId];
    if (!c || (!+c.factura && c.en.every(v=>!+v))) return <div className="p-12 text-center text-slate-400">Introduce datos del cliente para comparar.</div>;
    const { taxModel, potP } = getSegMeta(segId);
    const segTariffs = getSegTariffs(segId).filter(t=>t.selected);
    if (!segTariffs.length) return <div className="p-12 text-center text-slate-400">Selecciona al menos una tarifa.</div>;

    const results = segTariffs.map((t,i)=>({t, r:calc(taxModel,potP,c,t), color: CHART_COLS[i%CHART_COLS.length]}));
    const best = results.reduce((a,b)=>b.r.total<a.r.total?b:a,results[0]);
    const bestAh = +(c.factura - best.r.total).toFixed(2);

    const saveComp = async (act: "SAVE" | "PDF") => {
      if (isSaving || !user) return;
      try {
        setIsSaving(true);
        const sEsc = (s: unknown): string => typeof s === "string" ? s.replace(/[<>"{}$%]/g,"").trim() : "";
        const { error } = await supabase.from("client_comparisons").insert({
          user_id: user.id,
          client_name: sEsc(c.nombre) || "S/N",
          client_address: sEsc(c.dir),
          target_tariff: best.t.nombre,
          target_segment: segDef.label,
          calculation_data: {
            segment: segDef.label,
            tax_model: taxModel,
            pot_prices: potP,
            best_tariff: best.t.nombre,
            total_cost: best.r.total,
            saving: bestAh,
            current_invoice: c.factura,
            client_data: {...c, nombre: sEsc(c.nombre), cups: sEsc(c.cups), dir: sEsc(c.dir)},
            available_tariffs: segTariffs.map(t => ({ ...t, selected: t.id === best.t.id }))
          }
        });
        if (error) {
          console.warn("Error al registrar comparación en DB:", error.message);
        }
        if (act === "SAVE") alert("✓ Guardado correctamente.");
      } catch (err: unknown) {
        console.error("Error silencioso en saveComp:", err);
      } finally {
        setIsSaving(false);
      }
    };

    const handlePDF = async () => {
      if (isSaving) return;
      const { exportPDF } = await import("../../utils/pdfExport");
      exportPDF(segDef.label, taxModel, potP, c, segTariffs, comercialData);
      await saveComp("PDF");
    };

    const handleExcel = async () => {
      const { exportExcel } = await import("../../utils/excelExport");
      exportExcel(segDef.label, taxModel, potP, c, segTariffs);
    };

    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex gap-2">
          <button onClick={handlePDF} disabled={isSaving} className="flex-1 bg-[#002855] text-white py-3 rounded-xl font-bold text-xs disabled:opacity-60">PDF INFORME</button>
          <button onClick={handleExcel} className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold text-xs">EXCEL</button>
          <button onClick={() => saveComp("SAVE")} disabled={isSaving} className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold text-xs shadow-lg disabled:opacity-60">{isSaving?"...":"GUARDAR"}</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase">FACTURA ACTUAL</p>
            <p className="text-xl font-black text-slate-700">{fmtEur(c.factura)}</p>
          </div>
          <div className={`bg-white p-4 rounded-2xl border-2 ${activeSeg==="res"?"border-orange-500":"border-blue-600"}`}>
            <p className="text-[10px] font-black text-slate-400 uppercase">MEJOR OPCIÓN</p>
            <p className={`text-xl font-black ${activeSeg==="res"?"text-orange-500":"text-blue-600"}`}>{fmtEur(best.r.total)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 border-b">
              <tr><th className="p-3 text-left">Periodo</th><th className="p-3 text-right">Actual</th><th className="p-3 text-right text-orange-500">{best.t.nombre}</th></tr>
            </thead>
            <tbody>
              <tr className="border-b"><td className="p-3">Potencia</td><td className="text-right p-3">—</td><td className="text-right p-3 font-bold">{fmtEur(best.r.potencia)}</td></tr>
              <tr className="border-b"><td className="p-3">Energía</td><td className="text-right p-3">—</td><td className="text-right p-3 font-bold">{fmtEur(best.r.energia)}</td></tr>
              <tr className="border-b"><td className="p-3">Impuestos</td><td className="text-right p-3">—</td><td className="text-right p-3 font-bold">{fmtEur((best.r.igic??0)+(best.r.igicRed??0)+(best.r.igic7??0)+best.r.impElec)}</td></tr>
              <tr className="bg-orange-50/30 font-black text-sm"><td className="p-3">TOTAL</td><td className="text-right p-3">{fmtEur(c.factura)}</td><td className="text-right p-3 text-orange-500">{fmtEur(best.r.total)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-4">GRÁFICO COMPARATIVO</p>
          <div className="h-[240px] relative"><canvas id={`compChart_${segId}`} title={`Gráfico comparativo para ${segDef.label}`}></canvas></div>
        </div>
      </div>
    );
  };

  const sub = subTabs[activeSeg];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto mb-4 no-scrollbar">
        {SEG_DEFS.map(seg => (
          <button key={seg.id} onClick={() => setActiveSeg(seg.id)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex-1 whitespace-nowrap ${activeSeg === seg.id ? (seg.id === 'res' ? 'bg-orange-500 text-white shadow-md' : (seg.id === 'pyme361' ? 'bg-purple-600 text-white shadow-md' : 'bg-blue-600 text-white shadow-md')) : 'text-slate-400 hover:text-slate-600'}`}>{seg.label.toUpperCase()}</button>
        ))}
      </div>
        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar whitespace-nowrap">
        {[["cli","DATOS CLIENTE"],["tar","TARIFAS"],["comp","COMPARATIVA"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setSubTab(id)} className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-[10px] sm:text-[11px] font-black tracking-widest transition-all border-b-2 ${sub===id?(activeSeg==="res"?"text-orange-500 border-orange-500":"text-blue-600 border-blue-600"):"text-slate-400 border-transparent"}`}>{lbl}</button>
        ))}
      </div>
      <div className="min-h-[400px]">
        {sub === "cli" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            <AuthWarning />
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[#002855]">Datos del cliente</h3>
              <button onClick={() => clearClient(activeSeg)} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={12}/> Limpiar</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div><label htmlFor={`${activeSeg}-nombre`} className="block text-xs font-bold text-slate-500 mb-1">Nombre</label><input id={`${activeSeg}-nombre`} placeholder="Ej: Juan Pérez" className="w-full p-2.5 bg-slate-50 border rounded-lg text-sm text-slate-900" value={clients[activeSeg]?.nombre || ""} onChange={e => upClient(activeSeg,"nombre",e.target.value)} /></div>
              <div><label htmlFor={`${activeSeg}-cups`} className="block text-xs font-bold text-slate-500 mb-1">CUPS</label><input id={`${activeSeg}-cups`} placeholder="ES0000..." className="w-full p-2.5 bg-slate-50 border rounded-lg text-sm font-mono text-slate-900" value={clients[activeSeg]?.cups || ""} onChange={e => upClient(activeSeg,"cups",e.target.value.toUpperCase())} /></div>
            </div>
            <div className="mb-4"><label htmlFor={`${activeSeg}-dir`} className="block text-xs font-bold text-slate-500 mb-1">Dirección</label><input id={`${activeSeg}-dir`} placeholder="Calle, Número, Ciudad" className="w-full p-2.5 bg-slate-50 border rounded-lg text-sm text-slate-900" value={clients[activeSeg]?.dir || ""} onChange={e => upClient(activeSeg, "dir", e.target.value)} /></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <div><label htmlFor={`${activeSeg}-f1`} className="block text-xs font-bold text-slate-500 mb-1">Inicio</label><input id={`${activeSeg}-f1`} type="date" className="w-full p-2.5 bg-slate-50 border rounded-lg text-sm" value={clients[activeSeg]?.f1 || ""} onChange={e => upDate(activeSeg,"f1",e.target.value)} /></div>
              <div><label htmlFor={`${activeSeg}-f2`} className="block text-xs font-bold text-slate-500 mb-1">Fin</label><input id={`${activeSeg}-f2`} type="date" className="w-full p-2.5 bg-slate-50 border rounded-lg text-sm" value={clients[activeSeg]?.f2 || ""} onChange={e => upDate(activeSeg,"f2",e.target.value)} /></div>
              <div className="col-span-2 sm:col-span-1"><label htmlFor={`${activeSeg}-dias`} className="block text-xs font-bold text-slate-500 mb-1">Días</label><input id={`${activeSeg}-dias`} placeholder="0" type="text" className="w-full p-2.5 bg-orange-50 border-orange-200 rounded-lg text-sm font-bold text-orange-700" value={inputValues[`${activeSeg}-dias`] ?? (clients[activeSeg]?.dias || 0)} onChange={e => { const v = e.target.value; setInputValues(p=>({...p,[`${activeSeg}-dias`]:v})); const n = parseInt(v.replace(/\D/g,"")); if(!isNaN(n)) upClient(activeSeg,"dias",n); }} onBlur={()=>setInputValues(p=>{const n={...p}; delete n[`${activeSeg}-dias`]; return n;})}/></div>
            </div>
            <div className="border-t border-slate-100 my-4"></div>
            <p className="text-xs font-black text-slate-400 uppercase mb-3 border-l-4 border-orange-500 pl-2">Potencia (kW)</p>
            <div className={`grid gap-3 mb-4 ${getSegMeta(activeSeg).potP === 6 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2"}`}>
              {Array.from({length:getSegMeta(activeSeg).potP},(_,i)=>(
                <div key={i}><label htmlFor={`${activeSeg}-kw-${i}`} className="block text-xs text-slate-400 mb-1">P{i+1}</label>
                <input id={`${activeSeg}-kw-${i}`} placeholder="0,000" type="text" className="w-full p-2 bg-slate-50 border rounded-lg text-sm font-bold" value={inputValues[`${activeSeg}-kw-${i}`] ?? fmtRaw(clients[activeSeg]?.kw[i],3)} onChange={e=>{const v=e.target.value; setInputValues(p=>({...p,[`${activeSeg}-kw-${i}`]:v})); const n=parseFloat(v.replace(/\./g,"").replace(",",".")); if(!isNaN(n)) upClientArr(activeSeg,"kw",i,n);}} onBlur={()=>setInputValues(p=>{const n={...p}; delete n[`${activeSeg}-kw-${i}`]; return n;})}/></div>
              ))}
            </div>
            <p className="text-xs font-black text-slate-400 uppercase mb-3 border-l-4 border-blue-500 pl-2">Energía (kWh)</p>
            <div className={`grid gap-3 mb-4 ${getSegMeta(activeSeg).potP === 6 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-3"}`}>
              {Array.from({length: (getSegMeta(activeSeg).potP===6?6:3)},(_,i)=>(
                <div key={i}><label htmlFor={`${activeSeg}-en-${i}`} className="block text-xs text-slate-400 mb-1">P{i+1}</label>
                <input id={`${activeSeg}-en-${i}`} placeholder="0" type="text" className="w-full p-2 bg-slate-50 border rounded-lg text-sm font-bold" value={inputValues[`${activeSeg}-en-${i}`] ?? fmtRaw(clients[activeSeg]?.en[i],2)} onChange={e=>{const v=e.target.value; setInputValues(p=>({...p,[`${activeSeg}-en-${i}`]:v})); const n=parseFloat(v.replace(/\./g,"").replace(",",".")); if(!isNaN(n)) upClientArr(activeSeg,"en",i,n);}} onBlur={()=>setInputValues(p=>{const n={...p}; delete n[`${activeSeg}-en-${i}`]; return n;})}/></div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div><label htmlFor={`${activeSeg}-alq`} className="block text-xs font-bold text-slate-500 mb-1">Alquiler (€)</label><input id={`${activeSeg}-alq`} placeholder="0,00" type="text" className="w-full p-2.5 bg-slate-50 border rounded-lg text-sm" value={inputValues[`${activeSeg}-alq`] ?? fmtRaw(clients[activeSeg]?.alquiler,2)} onChange={e=>{const v=e.target.value; setInputValues(p=>({...p,[`${activeSeg}-alq`]:v})); const n=parseFloat(v.replace(/\./g,"").replace(",",".")); if(!isNaN(n)) upClient(activeSeg,"alquiler",n);}} onBlur={()=>setInputValues(p=>{const n={...p}; delete n[`${activeSeg}-alq`]; return n;})}/></div>
              <div><label htmlFor={`${activeSeg}-exc`} className="block text-xs font-bold text-green-600 mb-1">Excedentes kWh</label><input id={`${activeSeg}-exc`} placeholder="0" type="text" className="w-full p-2.5 bg-green-50 border-green-200 rounded-lg text-sm font-bold" value={inputValues[`${activeSeg}-exc`] ?? fmtRaw(clients[activeSeg]?.enExc,0)} onChange={e=>{const v=e.target.value; setInputValues(p=>({...p,[`${activeSeg}-exc`]:v})); const n=parseFloat(v.replace(/\./g,"").replace(",",".")); if(!isNaN(n)) upClient(activeSeg,"enExc",n);}} onBlur={()=>setInputValues(p=>{const n={...p}; delete n[`${activeSeg}-exc`]; return n;})}/></div>
            </div>
            <div className="mb-4"><label htmlFor={`${activeSeg}-fac`} className="block text-xs font-bold text-blue-700 mb-1">Factura Actual (€)</label><input id={`${activeSeg}-fac`} placeholder="0,00" type="text" className="w-full p-2.5 bg-blue-50 border-blue-200 rounded-lg text-sm font-bold text-blue-700" value={inputValues[`${activeSeg}-fac`] ?? fmtRaw(clients[activeSeg]?.factura,2)} onChange={e=>{const v=e.target.value; setInputValues(p=>({...p,[`${activeSeg}-fac`]:v})); const n=parseFloat(v.replace(/\./g,"").replace(",",".")); if(!isNaN(n)) upClient(activeSeg,"factura",n);}} onBlur={()=>setInputValues(p=>{const n={...p}; delete n[`${activeSeg}-fac`]; return n;})}/></div>
            {isAdmin && (
              <div className="mt-6 pt-4 border-t border-red-100 bg-red-50/50 p-4 rounded-xl">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Shield size={12}/> Configuración Fiscal (Admin)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div><label htmlFor={`${activeSeg}-tax-imp`} className="text-[10px] text-slate-500">Imp. Elec %</label><input id={`${activeSeg}-tax-imp`} type="number" step="0.001" className="w-full p-2 text-xs border rounded" value={clients[activeSeg]?.taxImpElec || 0} onChange={e=>upClient(activeSeg,"taxImpElec",+e.target.value)}/></div>
                  <div><label htmlFor={`${activeSeg}-tax-bono`} className="text-[10px] text-slate-500">Bono Social €/d</label><input id={`${activeSeg}-tax-bono`} type="number" step="0.000001" className="w-full p-2 text-xs border rounded" value={clients[activeSeg]?.bonoRate || 0} onChange={e=>upClient(activeSeg,"bonoRate",+e.target.value)}/></div>
                  {getSegMeta(activeSeg).taxModel !== "res" ? <>
                    <div><label htmlFor={`${activeSeg}-tax-igic-red`} className="text-[10px] text-slate-500">IGIC Red %</label><input id={`${activeSeg}-tax-igic-red`} type="number" step="0.01" className="w-full p-2 text-xs border rounded" value={clients[activeSeg]?.taxIGICRed || 0} onChange={e=>upClient(activeSeg,"taxIGICRed",+e.target.value)}/></div>
                    <div><label htmlFor={`${activeSeg}-tax-igic-7`} className="text-[10px] text-slate-500">IGIC Alq %</label><input id={`${activeSeg}-tax-igic-7`} type="number" step="0.01" className="w-full p-2 text-xs border rounded" value={clients[activeSeg]?.taxIGIC7 || 0} onChange={e=>upClient(activeSeg,"taxIGIC7",+e.target.value)}/></div>
                  </> : <div><label htmlFor={`${activeSeg}-tax-igic`} className="text-[10px] text-slate-500">IGIC Alq %</label><input id={`${activeSeg}-tax-igic`} type="number" step="0.01" className="w-full p-2 text-xs border rounded" value={clients[activeSeg]?.taxIGIC || 0} onChange={e=>upClient(activeSeg,"taxIGIC",+e.target.value)}/></div>}
                </div>
                <button onClick={()=>saveFiscalConfig(activeSeg)} className="w-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold py-2 rounded shadow-sm transition-colors">GUARDAR FISCALIDAD PARA ESTE SEGMENTO</button>
              </div>
            )}
          </div>
        )}
        {sub === "tar" && <TariffPane segId={activeSeg} />}
        {sub === "comp" && <CompPane segId={activeSeg} />}
      </div>
    </div>
  );
}