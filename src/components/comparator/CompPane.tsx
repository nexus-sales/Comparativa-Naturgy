import { useState } from "react";
import { useComparatorActions, buildResults, fmtEur } from "../../hooks/useComparatorActions";
import type { ComercialData } from "../../utils/pdfExport";
import { makeDefaultClient, SVE_CATALOG } from "../../utils/calculations";
import type { SegCliente, TarifaLocal } from "../../utils/calculations";
import type { User } from "@supabase/supabase-js";

interface CompPaneProps {
  segId: string;
  activeSeg: string;
  c: SegCliente;
  taxModel: string;
  potP: number;
  segTariffs: TarifaLocal[];
  segDef: { id: string; label: string; color: string };
  segLabel: string;
  user: User;
  comercialData: ComercialData;
}

export function CompPane({ segId, activeSeg, c, taxModel, potP, segTariffs, segDef, segLabel, user, comercialData }: CompPaneProps) {
  const safeClient = c ?? makeDefaultClient(activeSeg);
  const fallbackTariff: TarifaLocal = {
    id: "__fallback__",
    nombre: "",
    tipo: "uni",
    potUnit: "dia",
    rPot: [0, 0],
    rEn: [0],
    sva: 0,
    open: false,
    selected: false,
  };
  const safeTariffs = segTariffs.length ? segTariffs : [fallbackTariff];
  
  const { results, best, bestAh } = buildResults(taxModel, potP, c, safeTariffs);
  
  // Estado para la tarifa seleccionada (por defecto la mejor opción)
  const [selectedTariffId, setSelectedTariffId] = useState<string>(best?.t?.id || "");

  const { saveStatus, saveMsg, isSaving, saveComp, handlePDF, handleExcel } = useComparatorActions({
    user, segLabel, taxModel, potP, c: safeClient, segTariffs: safeTariffs, comercialData, selectedTariffId
  });

  if (!c || (!+c.factura && c.en.every(v => !+v)))
    return <div className="p-12 text-center text-slate-400">Introduce datos del cliente para comparar.</div>;
  if (!segTariffs.length)
    return <div className="p-12 text-center text-slate-400">Selecciona al menos una tarifa.</div>;

  const accentRes = activeSeg === "res";

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex gap-2">
        <button type="button" onClick={handlePDF} disabled={isSaving} className="flex-1 bg-[#002855] text-white py-3 rounded-xl font-bold text-xs disabled:opacity-60">PDF INFORME</button>
        <button type="button" onClick={handleExcel} disabled={isSaving} className="flex-1 bg-green-700 text-white py-3 rounded-xl font-bold text-xs disabled:opacity-60">EXCEL</button>
        <button type="button" onClick={() => saveComp("SAVE")} disabled={isSaving} className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold text-xs shadow-lg disabled:opacity-60">
          {isSaving ? "Guardando..." : "GUARDAR"}
        </button>
      </div>

      {saveStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2 text-sm text-center font-bold animate-in fade-in duration-300">✓ {saveMsg}</div>
      )}
      {saveStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm text-center animate-in fade-in duration-300">✗ {saveMsg}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase">FACTURA ACTUAL</p>
          <p className="text-xl font-black text-slate-700">{fmtEur(c.factura, 2)}</p>
        </div>
        <div className={`bg-white p-4 rounded-2xl border-2 ${accentRes ? "border-orange-500" : "border-blue-600"}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase">MEJOR OPCIÓN</p>
          <p className={`text-xl font-black ${accentRes ? "text-orange-500" : "text-blue-600"}`}>{fmtEur(best.r.total, 2)}</p>
        </div>
        <div className={`bg-white p-4 rounded-2xl border-2 ${bestAh > 0 ? "border-green-500" : "border-slate-200"}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase">{c.dias > 0 ? `AHORRO PERÍODO (${c.dias}d)` : "AHORRO PERÍODO"}</p>
          <p className={`text-xl font-black ${bestAh > 0 ? "text-green-600" : "text-slate-400"}`}>{bestAh > 0 ? fmtEur(bestAh, 2) : "—"}</p>
        </div>
        <div className={`bg-white p-4 rounded-2xl border-2 ${bestAh > 0 ? "border-green-500" : "border-slate-200"}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase">AHORRO ANUAL EST.</p>
          <p className={`text-xl font-black ${bestAh > 0 ? "text-green-600" : "text-slate-400"}`}>{bestAh > 0 && c.dias > 0 ? fmtEur((bestAh / c.dias) * 365, 2) : "—"}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-[11px] min-w-max">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3 text-left">Componente</th>
              <th className="p-3 text-right text-slate-500">Actual</th>
              {results.map(({ t }) => (
                <th key={t.id} className={`p-3 text-right relative ${
                  t.id === selectedTariffId 
                    ? "bg-blue-50 border-x-2 border-t-2 border-blue-500" 
                    : ""
                } ${t.id === best.t.id ? (accentRes ? "text-orange-500" : "text-blue-600") : "text-slate-700"}`}>
                  <label className="flex flex-col items-center cursor-pointer">
                    <input 
                      type="radio" 
                      name="tariff-select"
                      value={t.id}
                      checked={t.id === selectedTariffId}
                      onChange={() => setSelectedTariffId(t.id)}
                      className="mb-1"
                    />
                    <span>{t.nombre}{t.id === best.t.id ? " ⭐" : ""}</span>
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="p-3">Potencia</td><td className="text-right p-3">—</td>
              {results.map(({ t, r }) => <td key={t.id} className={`text-right p-3 font-bold ${
                t.id === selectedTariffId ? "bg-blue-50 border-x-2 border-blue-500" : ""
              } ${t.id === best.t.id ? (accentRes ? "text-orange-600" : "text-blue-700") : ""}`}>{fmtEur(r.potencia, 2)}</td>)}
            </tr>
            <tr className="border-b">
              <td className="p-3">Energía</td><td className="text-right p-3">—</td>
              {results.map(({ t, r }) => <td key={t.id} className={`text-right p-3 font-bold ${
                t.id === selectedTariffId ? "bg-blue-50 border-x-2 border-blue-500" : ""
              } ${t.id === best.t.id ? (accentRes ? "text-orange-600" : "text-blue-700") : ""}`}>{fmtEur(r.energia, 2)}</td>)}
            </tr>
            {(c?.sveAnioRate || 0) > 0 && (
              <tr className="border-b">
                <td className="p-3">{SVE_CATALOG.find(s => s.id === c.sveServiceId)?.name ?? 'SVE'}</td>
                <td className="text-right p-3">—</td>
                {results.map(({ t, r }) => <td key={t.id} className={`text-right p-3 font-bold ${
                  t.id === selectedTariffId ? "bg-blue-50 border-x-2 border-blue-500" : ""
                }`}>{fmtEur(r.sva, 2)}</td>)}
              </tr>
            )}
            <tr className="border-b">
              <td className="p-3">Impuestos</td><td className="text-right p-3">—</td>
              {results.map(({ t, r }) => <td key={t.id} className={`text-right p-3 font-bold ${
                t.id === selectedTariffId ? "bg-blue-50 border-x-2 border-blue-500" : ""
              } ${t.id === best.t.id ? (accentRes ? "text-orange-600" : "text-blue-700") : ""}`}>{fmtEur((r.igic ?? 0) + (r.igicRed ?? 0) + (r.igic7 ?? 0) + r.impElec, 2)}</td>)}
            </tr>
            <tr className="bg-orange-50/30 font-black text-sm">
              <td className="p-3">TOTAL</td>
              <td className="text-right p-3">{fmtEur(c.factura, 2)}</td>
              {results.map(({ t, r }) => {
                const ah = c.factura - r.total;
                return (
                  <td key={t.id} className={`text-right p-3 ${
                    t.id === selectedTariffId ? "bg-blue-100 border-x-2 border-b-2 border-blue-500" : ""
                  } ${t.id === best.t.id ? (accentRes ? "text-orange-500" : "text-blue-600") : "text-slate-700"}`}>
                    {fmtEur(r.total, 2)}
                    {ah > 0.01 && <span className="block text-[9px] font-normal text-green-600">+{fmtEur(ah, 2)}</span>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase mb-4">GRÁFICO COMPARATIVO</p>
        <div className="h-[240px] relative">
          <canvas id={`compChart_${segId}`} title={`Gráfico comparativo para ${segDef.label}`}></canvas>
        </div>
      </div>
    </div>
  );
}
