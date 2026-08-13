import { useState, useCallback, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api, withTimeout } from "../../lib/api";
import { fmtEur } from "../../utils/calculations";
import { toSectorFilter } from "../../utils/sectors";
import { KPICard } from "../KPICard";
import type { ClientComparison, Notice } from "../../types";
import {
  TrendingUp,
  FileText,
  Bell,
  ChevronRight,
  RefreshCw,
  Activity,
  AlertCircle,
  Users,
  Home,
  Zap,
} from "lucide-react";

type ActiveTab = "dashboard" | "comparator" | "admin" | "profile" | "history" | "notices";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function segCategory(c: ClientComparison): "res" | "pyme20" | "pyme30" | "pyme61" | "" {
  const s = (
    c.target_segment ||
    c.calculation_data.segment ||
    ""
  ).toString().toLowerCase();
  if (s.includes("61")) return "pyme61";
  if (s.includes("30")) return "pyme30";
  if (s.includes("pyme")) return "pyme20";
  if (s.includes("res")) return "res";
  return "";
}

function topTariff(items: ClientComparison[]): string {
  const counts: Record<string, number> = {};
  items.forEach((c) => {
    const t = c.target_tariff || c.calculation_data.best_tariff || "";
    if (t) counts[t] = (counts[t] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
}

function sectorColor(label: string): string {
  if (label.includes("2.0")) return "#fdba74";
  if (label.includes("3.0")) return "#c4b5fd";
  if (label.includes("6.1")) return "#86efac";
  return "#93c5fd";
}

interface DashboardViewProps {
  onNavigate: (tab: ActiveTab) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [comparisons, setComparisons] = useState<ClientComparison[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: compData, error: compErr } = await withTimeout(api.comparisons.list(500));
      if (compErr) throw compErr;
      setComparisons(compData ?? []);

      const { data: noticesData } = await withTimeout(api.notices.list(true));
      setNotices((noticesData ?? []).slice(0, 3));
    } catch (err) {
      if (err instanceof Error && err.message.includes("Tiempo de espera")) {
        setError("Tiempo de espera agotado. Pulsa Actualizar para reintentar.");
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  // ─── Derived data ───────────────────────────────────────────────────────────
  const {
    today,
    thisMonth,
    totalSavingsMonth,
    avgSavingMonth,
    lineData,
    sectorData,
    segGroups,
    recentComparisons,
  } = useMemo(() => {
    const n = new Date();
    const monthStart = new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
    const today = n.toISOString().slice(0, 10);
    const thisMonth = comparisons.filter((c) => c.created_at >= monthStart);

    const totalSavingsMonth = thisMonth.reduce(
      (acc, c) => acc + (c.calculation_data.saving ?? 0),
      0
    );
    const avgSavingMonth = thisMonth.length ? totalSavingsMonth / thisMonth.length : 0;

    const lineData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(n.getFullYear(), n.getMonth() - (5 - i), 1);
      const label = d.toLocaleDateString("es-ES", { month: "short" });
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return {
        mes: label.charAt(0).toUpperCase() + label.slice(1),
        ofertas: comparisons.filter((c) => c.created_at.startsWith(ym)).length,
      };
    });

    const sectorMap = new Map<string, number>();
    thisMonth.forEach((c) => {
      const s = toSectorFilter(c.target_segment || c.calculation_data.segment) || "Otro";
      sectorMap.set(s, (sectorMap.get(s) || 0) + 1);
    });
    const sectorData = [...sectorMap.entries()].map(([sector, ofertas]) => ({ sector, ofertas }));

    const segGroups = {
      res:    thisMonth.filter((c) => segCategory(c) === "res"),
      pyme20: thisMonth.filter((c) => segCategory(c) === "pyme20"),
      pyme30: thisMonth.filter((c) => segCategory(c) === "pyme30"),
      pyme61: thisMonth.filter((c) => segCategory(c) === "pyme61"),
    };

    const recentComparisons = comparisons.slice(0, 5);

    return {
      today,
      thisMonth,
      totalSavingsMonth,
      avgSavingMonth,
      lineData,
      sectorData,
      segGroups,
      recentComparisons,
    };
  }, [comparisons]);

  const noticeColor = (n: Notice) => {
    if (n.is_highlighted) return "bg-orange-500";
    if (n.type === "tarifa") return "bg-blue-400";
    if (n.type === "servicio") return "bg-amber-400";
    return "bg-green-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#002855]">Dashboard</h2>
          <p className="text-slate-400 text-sm">
            {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={fetchData} className="ml-auto text-xs font-bold underline">
            Reintentar
          </button>
        </div>
      )}

      {/* KPIs globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Ofertas (mes)"
          value={loading ? "…" : thisMonth.length}
          icon={<FileText className="text-orange-500" size={20} />}
        />
        <KPICard
          title="Ahorro total (mes)"
          value={loading ? "…" : fmtEur(totalSavingsMonth)}
          icon={<span className="text-green-500 font-black text-base leading-none">€</span>}
        />
        <KPICard
          title="Ahorro medio"
          value={loading ? "…" : fmtEur(avgSavingMonth)}
          icon={<TrendingUp className="text-blue-500" size={20} />}
        />
        <KPICard
          title="Ofertas hoy"
          value={loading ? "…" : comparisons.filter((c) => c.created_at.startsWith(today)).length}
          icon={<Users className="text-purple-500" size={20} />}
        />
      </div>

      {/* KPIs por segmento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Residencial"
          value={loading ? "…" : segGroups.res.length}
          icon={<Home className="text-blue-500" size={20} />}
          sub={loading ? undefined : `Top: ${topTariff(segGroups.res)}`}
        />
        <KPICard
          title="PYME 2.0TD"
          value={loading ? "…" : segGroups.pyme20.length}
          icon={<Zap className="text-orange-500" size={20} />}
          sub={loading ? undefined : `Top: ${topTariff(segGroups.pyme20)}`}
        />
        <KPICard
          title="PYME 3.0TD"
          value={loading ? "…" : segGroups.pyme30.length}
          icon={<Zap className="text-purple-500" size={20} />}
          sub={loading ? undefined : `Top: ${topTariff(segGroups.pyme30)}`}
        />
        <KPICard
          title="PYME 6.1TD"
          value={loading ? "…" : segGroups.pyme61.length}
          icon={<Zap className="text-green-600" size={20} />}
          sub={loading ? undefined : `Top: ${topTariff(segGroups.pyme61)}`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Línea: tendencia mensual */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-orange-500" />
            <h3 className="font-bold text-slate-700 text-sm">
              Tendencia mensual · últimos 6 meses
            </h3>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-slate-300 text-sm animate-pulse">
              Cargando…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={192}>
              <LineChart data={lineData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9", fontSize: 12 }}
                  labelStyle={{ fontWeight: 700, color: "#002855" }}
                />
                <Line
                  type="monotone"
                  dataKey="ofertas"
                  stroke="#F5821F"
                  strokeWidth={2.5}
                  dot={{ fill: "#F5821F", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Barras: por sector */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-orange-500" />
            <h3 className="font-bold text-slate-700 text-sm">Por sector (mes)</h3>
          </div>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-slate-300 text-sm animate-pulse">
              Cargando…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={sectorData} margin={{ top: 0, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="sector" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9", fontSize: 12 }}
                  labelStyle={{ fontWeight: 700, color: "#002855" }}
                />
                <Bar dataKey="ofertas" radius={[5, 5, 0, 0]}>
                  {sectorData.map((entry) => (
                    <Cell key={entry.sector} fill={sectorColor(entry.sector)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Actividad reciente + avisos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Actividad reciente */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
              <FileText size={15} className="text-slate-400" />
              Actividad reciente
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("history")}
              className="text-xs text-orange-600 font-bold hover:underline flex items-center gap-1"
            >
              Ver todo <ChevronRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-300 text-sm animate-pulse">Cargando…</div>
          ) : recentComparisons.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm italic">No hay comparativas aún.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-100">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th scope="col" className="px-5 py-2.5 text-left">Fecha</th>
                  <th scope="col" className="px-5 py-2.5 text-left">Cliente</th>
                  <th scope="col" className="px-5 py-2.5 text-left">Sector</th>
                  <th scope="col" className="px-5 py-2.5 text-right">Ahorro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentComparisons.map((c) => {
                  const saving = c.calculation_data.saving ?? 0;
                  const sector = toSectorFilter(c.target_segment || c.calculation_data.segment);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString("es-ES", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800 text-xs max-w-[140px] truncate">
                        {c.client_name || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase">
                          {sector || "Otro"}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-black text-sm ${saving >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {fmtEur(saving)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Avisos widget */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
              <Bell size={15} className="text-slate-400" />
              Últimos avisos
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("notices")}
              className="text-xs text-orange-600 font-bold hover:underline flex items-center gap-1"
            >
              Ver todos <ChevronRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-300 text-sm animate-pulse">Cargando…</div>
          ) : notices.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm italic">Sin avisos activos.</div>
          ) : (
            <div className="divide-y divide-slate-50 pb-2">
              {notices.map((n) => (
                <div key={n.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${noticeColor(n)}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 leading-tight line-clamp-1">
                        {n.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-slate-300 mt-1">
                        {new Date(n.created_at).toLocaleDateString("es-ES", {
                          day: "2-digit", month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
