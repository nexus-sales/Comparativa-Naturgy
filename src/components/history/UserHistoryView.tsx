import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { fmtEur } from "../../utils/calculations";
import type { SegCliente, TarifaLocal } from "../../utils/calculations";
import { exportPDF } from "../../utils/pdfExport";
import { toSectorFilter } from "../../utils/sectors";
import { Trash2, Clock, FileText, Users, RefreshCw, AlertCircle } from "lucide-react";
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [filterTariff, setFilterTariff] = useState("");
  const [filterSegment, setFilterSegment] = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      let query = supabase
        .from("client_comparisons")
        .select("*")
        .neq("deleted_by_user", true);

      if (!isAdmin) query = query.eq("user_id", user.id);

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(200)
        .abortSignal(controller.signal);

      if (error) throw error;

      const comparisons = (data ?? []) as ClientComparison[];

      if (isAdmin && comparisons.length > 0) {
        const userIds = [...new Set(comparisons.map(c => c.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email, full_name, phone")
          .in("id", userIds);

        if (profilesData) {
          const pm = Object.fromEntries(
            (profilesData as Array<{ id: string; email: string | null; full_name: string | null; phone: string | null }>)
              .map(p => [p.id, p])
          );
          setHistory(comparisons.map(c => ({
            ...c,
            profiles: pm[c.user_id]
              ? { email: pm[c.user_id].email, full_name: pm[c.user_id].full_name, phone: pm[c.user_id].phone }
              : null,
          })));
          return;
        }
      }

      setHistory(comparisons);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setFetchError('Tiempo de espera agotado. Pulsa "Actualizar" para reintentar.');
      } else {
        setFetchError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [isAdmin, user.id]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) void fetchHistory();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [fetchHistory, user.id]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchHistory(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchHistory]);

  const filteredHistory = history.filter(item => {
    const cd = item.calculation_data;
    const tariffMatch = !filterTariff || item.target_tariff === filterTariff || cd.best_tariff === filterTariff;
    const sector = toSectorFilter(item.target_segment || cd.segment);
    const segmentMatch = !filterSegment || sector === filterSegment;
    return tariffMatch && segmentMatch;
  });

  const totalSavings = filteredHistory.reduce(
    (acc, curr) => acc + (curr.calculation_data.saving ?? 0),
    0
  );
  const avgSaving = filteredHistory.length ? totalSavings / filteredHistory.length : 0;

  const countBySegment = filteredHistory.reduce<Record<string, number>>((acc, curr) => {
    const seg = toSectorFilter(curr.target_segment || curr.calculation_data.segment) || "Otro";
    acc[seg] = (acc[seg] || 0) + 1;
    return acc;
  }, {});

  const uniqueTariffs = Array.from(new Set(
    history.map(item => item.target_tariff || item.calculation_data.best_tariff).filter(Boolean)
  ));

  const uniqueSegments = Array.from(new Set(
    history.map(item => toSectorFilter(item.target_segment || item.calculation_data.segment)).filter(Boolean)
  ));

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {fetchError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span><strong>Error al cargar historial:</strong> {fetchError}</span>
          <button type="button" onClick={fetchHistory} className="ml-auto text-xs font-bold underline">Reintentar</button>
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="ml-auto text-xs font-bold underline">Cerrar</button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse">Cargando historial...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th scope="col" className="px-6 py-4">Fecha</th>
                  {isAdmin && <th scope="col" className="px-6 py-4">Comercial</th>}
                  <th scope="col" className="px-6 py-4">Cliente</th>
                  <th scope="col" className="px-6 py-4">Sector</th>
                  <th scope="col" className="px-6 py-4 text-right">Ahorro</th>
                  <th scope="col" className="px-4 py-4 text-center sticky right-0 bg-slate-50 border-l border-slate-200 shadow-[-4px_0_6px_rgba(0,0,0,0.04)]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map(item => {
                  try {
                  const cd = item.calculation_data;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
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
                          {toSectorFilter(item.target_segment || cd.segment) || "Otro"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`font-black text-base ${(cd.saving ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {fmtEur(cd.saving ?? 0)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Tarifa: {item.target_tariff || cd.best_tariff}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center sticky right-0 bg-white border-l border-slate-100 shadow-[-4px_0_6px_rgba(0,0,0,0.04)] group-hover:bg-slate-50/50">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!cd.available_tariffs?.length) { setActionError("No hay datos de cálculo disponibles."); return; }
                              const segLabel = cd.segment ?? "Residencial";
                              const taxModel = cd.tax_model ?? "Canarias";
                              const potP = cd.pot_prices ?? 2;
                              const rawClient = cd.client_data as Partial<SegCliente> | undefined;
                              const c: SegCliente = {
                                nombre: rawClient?.nombre || "",
                                cups: rawClient?.cups || "",
                                dir: rawClient?.dir || "",
                                f1: rawClient?.f1 || "",
                                f2: rawClient?.f2 || "",
                                dias: rawClient?.dias || 30,
                                kw: Array.isArray(rawClient?.kw) ? rawClient.kw : [0, 0, 0, 0, 0, 0],
                                en: Array.isArray(rawClient?.en) ? rawClient.en : [0, 0, 0, 0, 0, 0],
                                factura: rawClient?.factura || 0,
                                alquiler: rawClient?.alquiler || 0,
                                enExc: rawClient?.enExc || 0,
                                excedenteRate: rawClient?.excedenteRate || 0,
                                bonoRate: rawClient?.bonoRate || 0,
                                taxImpElec: rawClient?.taxImpElec || 0,
                                taxIGIC: rawClient?.taxIGIC || 0,
                                taxIGICRed: rawClient?.taxIGICRed || 0,
                                taxIGIC7: rawClient?.taxIGIC7 || 0,
                                reactiva: Array.isArray(rawClient?.reactiva) ? rawClient.reactiva : [0, 0, 0, 0, 0, 0],
                                reactivaRate: Array.isArray(rawClient?.reactivaRate) ? rawClient.reactivaRate : [0, 0, 0, 0, 0, 0],
                              };
                              const segTariffs = (cd.available_tariffs ?? []).map((t: unknown) => {
                                const tariff = t as Record<string, unknown>;
                                const tariffName = tariff.nombre ?? tariff.name;
                                return { ...tariff, selected: String(tariffName).trim() === String(cd.best_tariff).trim() };
                              }) as TarifaLocal[];
                              if (segTariffs.length > 0 && !segTariffs.some(t => t.selected)) segTariffs[0].selected = true;
                              if (!segTariffs.length) { setActionError("No hay tarifas guardadas en esta comparativa."); return; }
                              try {
                                exportPDF(segLabel, taxModel, potP, c, segTariffs, {
                                  nombre: item.profiles?.full_name || "Comercial Naturgy",
                                  telefono: item.profiles?.phone || "",
                                  email: item.profiles?.email || "",
                                });
                              } catch (e) {
                                setActionError('Error al generar PDF: ' + (e instanceof Error ? e.message : String(e)));
                              }
                            }}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                            title="Re-generar PDF"
                          >
                            <FileText size={18} />
                          </button>

                          {pendingDeleteId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from("client_comparisons")
                                    .update({ deleted_by_user: true })
                                    .eq("id", item.id);
                                  if (error) {
                                    setActionError("Error al borrar: " + error.message);
                                    setTimeout(() => setActionError(null), 5000);
                                  } else {
                                    setHistory(prev => prev.filter(h => h.id !== item.id));
                                  }
                                  setPendingDeleteId(null);
                                }}
                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black transition-colors"
                              >
                                Borrar
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteId(null)}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg text-[10px] font-black transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(item.id)}
                              className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                              title="Borrar comparativa"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  } catch (e) {
                    console.error('Error rendering history row', item.id, e);
                    return null;
                  }
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
