import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { calc, fmtEur, fmtRaw, makeDefaultClient, CHART_COLS, SEG_DEFS, SVE_CATALOG, SVE_SEGMENT_IDS } from "../../utils/calculations";
import type { SegCliente, TarifaLocal } from "../../utils/calculations";
import type { ComercialData } from "../../utils/pdfExport";
import { CompPane } from "./CompPane";
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
  const [requestedActiveSeg, setActiveSeg] = useState("res");
  const [lastPymeSeg, setLastPymeSeg] = useState("pyme20");
  const [subTabs, setSubTabs] = useState<Record<string, string>>({ res: "cli", pyme20: "cli", pyme20one: "cli", pyme30: "cli", pyme61: "cli" });
  const [tariffMeta, setTariffMeta] = useState<Record<string, { selected: boolean; open: boolean }>>({});
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const chartInstances = useRef<Record<string, ChartInstance>>({});
  const segmentDefs = useMemo(() => {
    const fallbackById = Object.fromEntries(SEG_DEFS.map(seg => [seg.id, seg]));
    const palette = ["#185FA5", "#0F6E56", "#B45309", "#6D28D9", "#7C3AED", "#be185d", "#0e7490"];
    const source = segments.length ? segments : SEG_DEFS.map(seg => ({ id: seg.id, label: seg.label } as Segment));
    return source.map((seg, index) => ({
      id: seg.id,
      label: seg.label,
      color: fallbackById[seg.id]?.color ?? palette[index % palette.length],
    }));
  }, [segments]);
  const activeSeg = segmentDefs.some(seg => seg.id === requestedActiveSeg)
    ? requestedActiveSeg
    : segmentDefs[0]?.id ?? requestedActiveSeg;
  const activeSector = activeSeg === "res" ? "res" : "pyme";

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

  const segDef = segmentDefs.find(s => s.id === activeSeg) ?? segmentDefs[0] ?? SEG_DEFS[0];

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

  const upClientArr = (segId: string, field: "kw" | "en" | "reactiva" | "reactivaRate", idx: number, val: number) =>
    setClients(prev => {
      const arr = [...((prev[segId][field] as number[] | undefined) ?? [0,0,0,0,0,0])];
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

  const copyClientData = (fromSegId: string, toSegId: string) => {
    const sourceClient = clients[fromSegId];
    if (!sourceClient) return;
    
    // Copiamos datos básicos del cliente pero mantenemos la configuración fiscal del segmento destino
    const targetKeep = (({ bonoRate, excedenteRate, taxImpElec, taxIGIC, taxIGICRed, taxIGIC7 }) =>
      ({ bonoRate, excedenteRate, taxImpElec, taxIGIC, taxIGICRed, taxIGIC7 }))(clients[toSegId]);
    
    setClients(prev => ({
      ...prev,
      [toSegId]: {
        ...prev[toSegId],
        ...targetKeep, // Mantener configuración fiscal del destino
        nombre: sourceClient.nombre,
        cups: sourceClient.cups,
        dir: sourceClient.dir,
        f1: sourceClient.f1,
        f2: sourceClient.f2,
        dias: sourceClient.dias,
        kw: [...sourceClient.kw],
        en: [...sourceClient.en],
        alquiler: sourceClient.alquiler,
        enExc: sourceClient.enExc,
        factura: sourceClient.factura,
        reactiva: sourceClient.reactiva ? [...sourceClient.reactiva] : undefined,
        reactivaRate: sourceClient.reactivaRate ? [...sourceClient.reactivaRate] : undefined
      }
    }));
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

  const renderAuthWarning = () => activeSeg !== "pyme20one" ? null : (
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

    const allSelected = segTariffs.every(t => tariffMeta[t.id]?.selected ?? true);
    const someSelected = segTariffs.some(t => tariffMeta[t.id]?.selected ?? true);
    
    const toggleAllTariffs = () => {
      const newState = !allSelected;
      const updates: Record<string, { selected: boolean; open: boolean }> = {};
      segTariffs.forEach(t => {
        updates[t.id] = {
          selected: newState,
          open: tariffMeta[t.id]?.open ?? false
        };
      });
      setTariffMeta(prev => ({ ...prev, ...updates }));
    };

    return (
      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {renderAuthWarning()}
        
        {/* Botón para seleccionar/deseleccionar todas */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allSelected}
              ref={input => {
                if (input) {
                  input.indeterminate = !allSelected && someSelected;
                }
              }}
              onChange={toggleAllTariffs}
              className="w-4 h-4"
              aria-label="Seleccionar todas las tarifas"
            />
            <span className="text-sm font-bold text-slate-700">
              {allSelected ? 'Deseleccionar todas' : someSelected ? 'Seleccionar todas' : 'Seleccionar todas'}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            {segTariffs.filter(t => tariffMeta[t.id]?.selected ?? true).length} de {segTariffs.length} seleccionadas
          </span>
        </div>

        {(() => {
          const renderTariff = (t: TarifaLocal) => {
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
                    <div className="font-black text-[#002855]">{fmtEur(r.total, 2)}</div>
                    {c.factura>0 && <div className={`text-[10px] font-bold ${ah>0.005?"text-green-600":"text-red-500"}`}>{ah>0?"-":"+"}{fmtEur(Math.abs(ah), 2)}</div>}
                  </div>
                </div>
                {isOpen && (
                  <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-[11px] text-slate-600">
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="font-bold opacity-50 uppercase text-[9px] mb-1 text-orange-600">Potencia (€/kW)</p>{t.rPot.map((v,i)=>v>0?(<div key={i} className="flex justify-between"><span>P{i+1}</span><span>{v.toFixed(6)}</span></div>):null)}</div>
                      <div><p className="font-bold opacity-50 uppercase text-[9px] mb-1 text-blue-600">Energía (€/kWh)</p>{t.rEn.map((v,i)=>v>0?(<div key={i} className="flex justify-between"><span>P{i+1}</span><span>{v.toFixed(6)}</span></div>):null)}</div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-x-8 gap-y-1">
                      <div className="flex justify-between"><span>Potencia bruta</span><span>{fmtEur(r.potencia, 2)}</span></div>
                      <div className="flex justify-between"><span>Energía bruta</span><span>{fmtEur(r.energia, 2)}</span></div>
                      <div className="flex justify-between"><span>Alquiler</span><span>{fmtEur(r.alquiler, 2)}</span></div>
                      {(r.reactiva ?? 0) > 0 && <div className="flex justify-between text-purple-700"><span>Reactiva (penalización)</span><span>{fmtEur(r.reactiva, 2)}</span></div>}
                      <div className="flex justify-between font-bold text-slate-900"><span>TOTAL</span><span>{fmtEur(r.total, 2)}</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          };

          if (segId === 'res') return segTariffs.map(renderTariff);

          const GROUPS = [
            { key: 'variable',   label: 'Variable',   tipos: ['hex'] },
            { key: 'trihoraria', label: 'Trihoraria',  tipos: ['tri', 'tri6'] },
            { key: 'planfijo',   label: 'Plan Fijo',   tipos: ['uni', 'uni6'] },
          ];

          return GROUPS.map(group => {
            const gTariffs = segTariffs.filter(t => group.tipos.includes(t.tipo));
            if (!gTariffs.length) return null;
            const gKey = `${segId}-${group.key}`;
            const isGOpen = groupOpen[gKey] ?? true;
            return (
              <div key={group.key} className="space-y-2">
                <button
                  onClick={() => setGroupOpen(prev => ({ ...prev, [gKey]: !isGOpen }))}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-left"
                >
                  <span className={`text-slate-500 text-sm font-bold transition-transform duration-200 inline-block ${isGOpen ? "rotate-90" : ""}`}>›</span>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600">{group.label}</span>
                  <span className="text-xs text-slate-400 font-normal ml-1">({gTariffs.length})</span>
                </button>
                {isGOpen && <div className="space-y-2">{gTariffs.map(renderTariff)}</div>}
              </div>
            );
          });
        })()}
      </div>
    );
  };


  const sub = subTabs[activeSeg];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Sector Selection Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-4">
        <button
          onClick={() => setActiveSeg("res")}
          className={`px-6 py-3 rounded-xl text-xs font-black tracking-widest transition-all flex-1 text-center ${
            activeSector === "res"
              ? "bg-[#185FA5] text-white shadow-md"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          }`}
        >
          RESIDENCIAL
        </button>
        <button
          onClick={() => setActiveSeg(lastPymeSeg)}
          className={`px-6 py-3 rounded-xl text-xs font-black tracking-widest transition-all flex-1 text-center ${
            activeSector === "pyme"
              ? "bg-[#002855] text-white shadow-md"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          }`}
        >
          PYME
        </button>
      </div>

      {/* Sub-tabs for PYME varieties */}
      {activeSector === "pyme" && (
        <div className="flex gap-1 bg-slate-100/60 border border-slate-200/60 p-1 rounded-xl mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {segmentDefs
            .filter((seg) => seg.id !== "res" && seg.id !== "pyme361")
            .map((seg) => {
              const cleanLabel = seg.label.replace(/^Pyme\s+/i, "");
              return (
                <button
                  key={seg.id}
                  onClick={() => {
                    setActiveSeg(seg.id);
                    setLastPymeSeg(seg.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all flex-1 whitespace-nowrap ${
                    activeSeg === seg.id
                      ? "text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  style={activeSeg === seg.id ? { backgroundColor: seg.color } : undefined}
                >
                  {cleanLabel.toUpperCase()}
                </button>
              );
            })}
        </div>
      )}

      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar whitespace-nowrap">
        {[["cli","DATOS CLIENTE"],["tar","TARIFAS"],["comp","COMPARATIVA"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setSubTab(id)} className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 text-[10px] sm:text-[11px] font-black tracking-widest transition-all border-b-2 ${sub===id?(activeSeg==="res"?"text-orange-500 border-orange-500":"text-blue-600 border-blue-600"):"text-slate-400 border-transparent"}`}>{lbl}</button>
        ))}
      </div>
      <div className="min-h-[400px]">
        {sub === "cli" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            {renderAuthWarning()}
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[#002855]">Datos del cliente</h3>
              <div className="flex items-center gap-2">
                {/* Mostrar botones de copia solo para segmentos pyme */}
                {activeSector === "pyme" && (
                  <div className="relative group">
                    <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copiar datos de
                    </button>
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 hidden group-hover:block z-10">
                      <div className="py-1">
                        {segmentDefs
                          .filter(seg => seg.id !== "res" && seg.id !== "pyme361" && seg.id !== activeSeg)
                          .map(seg => (
                            <button
                              key={seg.id}
                              onClick={() => {
                                if (clients[seg.id]?.nombre || clients[seg.id]?.cups) {
                                  copyClientData(seg.id, activeSeg);
                                  alert(`Datos copiados de ${seg.label} a ${segDef.label}`);
                                } else {
                                  alert(`No hay datos en ${seg.label} para copiar`);
                                }
                              }}
                              className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 flex items-center justify-between"
                            >
                              <span>{seg.label.replace(/^Pyme\s+/i, "")}</span>
                              {(clients[seg.id]?.nombre || clients[seg.id]?.cups) && (
                                <span className="text-green-600">✓</span>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
                <button onClick={() => clearClient(activeSeg)} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={12}/> Limpiar</button>
              </div>
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
              <div><label htmlFor={`${activeSeg}-exc`} className="block text-xs font-bold text-green-600 mb-1">Excedentes kWh</label><input id={`${activeSeg}-exc`} placeholder="0" type="text" className="w-full p-2.5 bg-green-50 border-green-200 rounded-lg text-sm font-bold" value={inputValues[`${activeSeg}-exc`] ?? fmtRaw(clients[activeSeg]?.enExc,3)} onChange={e=>{const v=e.target.value; setInputValues(p=>({...p,[`${activeSeg}-exc`]:v})); const n=parseFloat(v.replace(/\./g,"").replace(",",".")); if(!isNaN(n)) upClient(activeSeg,"enExc",n);}} onBlur={()=>setInputValues(p=>{const n={...p}; delete n[`${activeSeg}-exc`]; return n;})}/></div>
            </div>
            {getSegMeta(activeSeg).potP === 6 && (
              <>
                <div className="border-t border-slate-100 my-4"></div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3 border-l-4 border-purple-500 pl-2">Reactiva — kVArh exceso</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-2">
                  {Array.from({length:6},(_,i)=>(
                    <div key={i}><label htmlFor={`${activeSeg}-react-${i}`} className="block text-xs text-slate-400 mb-1">P{i+1} kVArh</label>
                    <input id={`${activeSeg}-react-${i}`} placeholder="0,000" type="text" className="w-full p-2 bg-slate-50 border rounded-lg text-sm font-bold" value={inputValues[`${activeSeg}-react-${i}`] ?? fmtRaw(clients[activeSeg]?.reactiva?.[i] ?? 0, 2)} onChange={e=>{const v=e.target.value; setInputValues(p=>({...p,[`${activeSeg}-react-${i}`]:v})); const n=parseFloat(v.replace(/./g,"").replace(",",".")); if(!isNaN(n)) upClientArr(activeSeg,"reactiva",i,n);}} onBlur={()=>setInputValues(p=>{const n={...p}; delete n[`${activeSeg}-react-${i}`]; return n;})}/></div>
                  ))}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
                  {Array.from({length:6},(_,i)=>(
                    <div key={i}><label htmlFor={`${activeSeg}-reactRate-${i}`} className="block text-xs text-slate-400 mb-1">P{i+1} €/kVArh</label>
                    <input id={`${activeSeg}-reactRate-${i}`} placeholder="0,000000" type="text" className="w-full p-2 bg-purple-50 border border-purple-100 rounded-lg text-sm" value={inputValues[`${activeSeg}-reactRate-${i}`] ?? fmtRaw(clients[activeSeg]?.reactivaRate?.[i] ?? 0, 6)} onChange={e=>{const v=e.target.value; setInputValues(p=>({...p,[`${activeSeg}-reactRate-${i}`]:v})); const n=parseFloat(v.replace(/./g,"").replace(",",".")); if(!isNaN(n)) upClientArr(activeSeg,"reactivaRate",i,n);}} onBlur={()=>setInputValues(p=>{const n={...p}; delete n[`${activeSeg}-reactRate-${i}`]; return n;})}/></div>
                  ))}
                </div>
              </>
            )}
            {(SVE_SEGMENT_IDS[activeSeg]?.length ?? 0) > 0 && (
              <div className="mb-4">
                <label htmlFor={`${activeSeg}-sve`} className="block text-xs font-bold text-slate-500 mb-1">Servicio de Valor Añadido (SVE)</label>
                <select
                  id={`${activeSeg}-sve`}
                  className="w-full p-2.5 bg-slate-50 border rounded-lg text-sm text-slate-900"
                  value={clients[activeSeg]?.sveServiceId || ""}
                  onChange={e => {
                    const id = e.target.value;
                    const svc = SVE_CATALOG.find(s => s.id === id);
                    upClient(activeSeg, "sveServiceId", id || null);
                    upClient(activeSeg, "sveAnioRate", svc ? svc.priceYear : 0);
                  }}
                >
                  <option value="">Sin SVE</option>
                  {(SVE_SEGMENT_IDS[activeSeg] || []).map(id => {
                    const svc = SVE_CATALOG.find(s => s.id === id);
                    return svc ? <option key={id} value={id}>{svc.name} — {fmtEur(svc.priceYear, 2)}/año</option> : null;
                  })}
                </select>
              </div>
            )}
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
        {sub === "tar" && TariffPane({ segId: activeSeg })}
        {sub === "comp" && <CompPane segId={activeSeg} activeSeg={activeSeg} c={clients[activeSeg]} taxModel={getSegMeta(activeSeg).taxModel} potP={getSegMeta(activeSeg).potP} segTariffs={getSegTariffs(activeSeg).filter(t => t.selected)} segDef={segDef} segLabel={segDef.label} user={user} comercialData={comercialData} />}
      </div>
    </div>
  );
}
