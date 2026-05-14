import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { fmtEur } from "../../utils/calculations";
import { exportPDF } from "../../utils/pdfExport";
import { Trash2, Clock, FileText, Users, RefreshCw } from "lucide-react";
import { KPICard } from "../KPICard";
import type { User } from "@supabase/supabase-js";
import type { ClientComparison } from "../../types";

interface UserHistoryViewProps {
  user: User;
  isAdmin: boolean;
}

export function UserHistoryView({ user, isAdmin }: UserHistoryViewProps) {
  const [history, setHistory] = useState<ClientComparison[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterTariff, setFilterTariff] = useState("");
  const [filterSegment, setFilterSegment] = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_comparisons")
        .select("*, profiles(email, full_name, phone)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      if (data) setHistory(data as ClientComparison[]);
    } catch {
      const { data: simpleData } = await supabase
        .from("client_comparisons")
        .select("*")
        .order("created_at", { ascending: false });
      if (simpleData) setHistory(simpleData as ClientComparison[]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, user.id, isAdmin]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredHistory = history.filter(item => {
    const cd = item.calculation_data as Record<string, unknown>;
    const tariffMatch = !filterTariff || item.target_tariff === filterTariff || cd?.best_tariff === filterTariff;
    const segmentMatch = !filterSegment || item.target_segment === filterSegment || cd?.segment === filterSegment;
    return tariffMatch && segmentMatch;
  });

  const totalSavings = filteredHistory.reduce((acc, curr) => {
    const cd = curr.calculation_data as Record<string, unknown>;
    return acc + ((cd?.saving as number) || 0);
  }, 0);
  const avgSaving = filteredHistory.length ? totalSavings / filteredHistory.length : 0;

  const countBySegment = filteredHistory.reduce<Record<string, number>>((acc, curr) => {
    const cd = curr.calculation_data as Record<string, unknown>;
    const seg = curr.target_segment || (cd?.segment as string) || "Otro";
    acc[seg] = (acc[seg] || 0) + 1;
    return acc;
  }, {});

  const uniqueTariffs = Array.from(new Set(history.map(item => {
    const cd = item.calculation_data as Record<string, unknown>;
    return item.target_tariff || (cd?.best_tariff as string);
  }).filter(Boolean)));

  const uniqueSegments = Array.from(new Set(history.map(item => {
    const cd = item.calculation_data as Record<string, unknown>;
    return item.target_segment || (cd?.segment as string);
  }).filter(Boolean)));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <div className="bg-orange-100 p-3 rounded-2xl text-orange-600">
            <Clock size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-[#002855]">
              {isAdmin ? "Panel de Control" : "Mis Comparativas"}
            </h2>
            <p className="text-slate-500">
              {isAdmin
                ? "Estadísticas y registro global de ofertas"
                : "Consulta y recupera tus comparativas guardadas anteriormente"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Ofertas" value={filteredHistory.length} icon={<FileText className="text-blue-500" />} />
        <KPICard title="Ahorro Total" value={fmtEur(totalSavings)} icon={<div className="text-green-500 font-bold">€</div>} />
        <KPICard title="Ahorro Medio" value={fmtEur(avgSaving)} icon={<div className="text-emerald-500 font-bold">⌀</div>} />
        <KPICard title="Top Segmento" value={Object.entries(countBySegment).sort((a, b) => b[1] - a[1])[0]?.[0] || "-"} icon={<Users className="text-orange-500" />} />
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Tarifa:</span>
          <select
            title="Filtrar por Tarifa"
            value={filterTariff}
            onChange={(e) => setFilterTariff(e.target.value)}
            className="text-sm border-none bg-slate-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
          >
            <option value="">Todas</option>
            {uniqueTariffs.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Sector:</span>
          <select
            title="Filtrar por Sector"
            value={filterSegment}
            onChange={(e) => setFilterSegment(e.target.value)}
            className="text-sm border-none bg-slate-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
          >
            <option value="">Todos</option>
            {uniqueSegments.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {(filterTariff || filterSegment) && (
          <button
            type="button"
            onClick={() => { setFilterTariff(""); setFilterSegment(""); }}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 underline"
          >
            Limpiar Filtros
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse">Cargando historial...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  {isAdmin && <th className="px-6 py-4">Comercial</th>}
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Sector</th>
                  <th className="px-6 py-4 text-right">Ahorro</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map(item => {
                  const cd = item.calculation_data as Record<string, unknown>;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 font-medium text-blue-700">
                          {item.profiles?.email?.split('@')[0] || 'Desconocido'}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{item.client_name}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{item.client_address || 'Sin dirección'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                          {item.target_segment || (cd?.segment as string)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-black text-green-600 text-base">
                          {fmtEur((cd?.saving as number) || 0)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Tarifa: {item.target_tariff || (cd?.best_tariff as string)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!cd) return alert("No hay datos de cálculo disponibles.");

                              const segLabel = (cd.segment as string) || "Residencial";
                              const taxModel = (cd.tax_model as string) || "Canarias";
                              const potP = (cd.pot_prices as unknown[]) || [];
                              const c = (cd.client_data as Record<string, unknown>) || {};

                              const segTariffs = ((cd.available_tariffs as unknown[]) || []).map((t: unknown) => {
                                const tariff = t as Record<string, unknown>;
                                const isBest = String(tariff.name).trim() === String(cd.best_tariff).trim();
                                return { ...tariff, selected: isBest };
                              });

                              if (segTariffs.length > 0 && !segTariffs.some(t => t.selected)) {
                                segTariffs[0].selected = true;
                              }

                              if (segTariffs.length === 0) {
                                return alert("Error: No hay tarifas guardadas en esta comparativa.");
                              }

                              const comercial = {
                                nombre: item.profiles?.full_name || "Comercial Naturgy",
                                telefono: item.profiles?.phone || "",
                                email: item.profiles?.email || ""
                              };

                              exportPDF(segLabel, taxModel, potP, c, segTariffs, comercial);
                            }}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                            title="Re-generar PDF"
                          >
                            <FileText size={18} />
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("¿Seguro que quieres borrar esta comparativa de tu historial?")) return;

                              const { error } = await supabase
                                .from("client_comparisons")
                                .update({ deleted_by_user: true })
                                .eq("id", item.id);

                              if (error) {
                                alert("Error al borrar: " + error.message);
                              } else {
                                setHistory(prev => prev.filter(h => h.id !== item.id));
                              }
                            }}
                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                            title="Borrar comparativa"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredHistory.length && (
              <div className="p-12 text-center text-slate-400 italic bg-slate-50/30">
                {history.length ? "No hay resultados para los filtros seleccionados." : "Aún no hay comparativas registradas."}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
