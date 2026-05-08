import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { useAuth } from "./hooks/useAuth";
import { useData } from "./hooks/useData";
import type { Segment, Tariff } from "./hooks/useData";
import { calc, fmtEur, fmtRaw, makeDefaultClient, CHART_COLS } from "./utils/calculations";
import type { SegCliente, TarifaLocal } from "./utils/calculations";
import { exportPDF } from "./utils/pdfExport";
import type { ComercialData } from "./utils/pdfExport";
import { exportExcel } from "./utils/excelExport";
import {
  LogIn, Shield, Users,
  Plus, Trash2, X, AlertTriangle, Pencil
} from "lucide-react";
import {
  Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip
} from "chart.js";
import { AuthStatus } from "./components/auth/AuthOverlay";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const SEG_DEFS = [
  { id: "res",       label: "Residencial",      color: "#185FA5" },
  { id: "pyme20",    label: "Pyme 2.0TD",       color: "#0F6E56" },
  { id: "pyme20one", label: "Pyme ONE 2.0TD",   color: "#B45309" },
  { id: "pyme361",   label: "Pyme 3.0/6.1TD",   color: "#6D28D9" },
];

const PERIODO_LABELS = ["P1 — Punta", "P2 — Valle", "P3", "P4", "P5", "P6"];

// ── APP SHELL ─────────────────────────────────────────────────────────────────

function App() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { segments, tariffs, loading: dataLoading, error: dataError } = useData();
  const [activeTab, setActiveTab] = useState("comparator");
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const effectiveTab = (!isAdmin && activeTab === "admin") ? "comparator" : activeTab;
  const effectiveShowAdminLogin = !user && showAdminLogin;

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
    </div>
  );

  if (!user) return <AuthStatus />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-[#002855] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg height="28" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 220 54">
              <path fill="#E57200" fillRule="evenodd" d="M218.697 8.68827c.309-.27302.584-.37661.788-.37661.309 0 .515.23913.515.68352 0 2.97712-14.877 20.28492-19.23 24.35502-3.563 3.3518-6.102 5.505-7.575 5.505-.48 0-.789-.2392-.789-.8201 0-2.2228 3.359-8.1073 3.359-8.1073v-.1695l-6.203 5.4711c-1.44 1.2673-3.187 1.8473-4.763 1.8473-2.881 0-5.382-2.2578-5.382-7.4558V1.74463C179.417.581864 180.204 0 181.199 0c.581 0 1.267.239135 1.952.649635 4.356 2.771845 10.01 8.004755 14.363 15.153665.686 1.1289.959 2.2577.959 3.3866 0 3.6248-2.913 7.2835-5.929 10.5684v.2053l26.153-21.27533Z" clipRule="evenodd"/>
              <path fill="#ffffff" fillRule="evenodd" d="M49.1796 35.049v3.5251c0 .4937-.2396.698-.9518.8394-1.0828.213-2.446.3437-3.7539.3437-3.3424 0-4.4378-.912-4.4378-2.4814 0-.6284.1892-1.1057.5481-1.46.5298-.5257 1.4855-.7668 2.9214-.7668h5.674Zm4.8241 8.5479c1.1924-.4773 1.6125-1.2112 1.6125-2.6508v-9.6952c0-3.8329-.6753-6.0578-2.3072-7.6078-1.7474-1.6623-4.5941-2.4165-9.1863-2.4165-2.4819 0-4.7357.1646-6.3366.4802-1.6038.3156-2.1229 1.0543-2.1229 2.5298 0 .9014.0786 2.0283.1824 2.7147.0592.3902.2746.5209.7878.4492 2.51-.3572 4.7581-.5586 6.8509-.5586 2.7012 0 4.0857.1704 4.8667.7591.6074.455.8286 1.1859.8286 2.3768v.7716c-1.9735-.2546-4.2079-.4018-5.8001-.4018-3.7519 0-6.4055.7194-8.0132 2.2297-1.2507 1.1753-1.9279 2.8938-1.9279 4.9492 0 4.594 3.292 7.5459 10.8551 7.5459 3.8548 0 7.5242-.6022 9.7102-1.4755ZM111.66 31.1754c0-1.793.26-2.6092.829-3.2182.619-.6603 1.695-.9507 3.385-.9507.643 0 1.629.0639 2.714.1481.535.0417.711-.1239.8-.5547.112-.5364.21-1.5026.21-2.3101 0-1.2818-.375-1.9982-1.34-2.4116-.819-.3505-2.369-.6516-4.31-.6516-2.535 0-4.799.6061-6.375 2.0099-1.463 1.3022-2.349 3.2569-2.349 6.7335v13.9745c0 .4676.281.6409.659.6409h5.777v-13.41Zm-45.0147-9.4638v-6.7694h-5.2131c-.9343 0-1.2244.3766-1.2244 1.1957v20.6063c0 3.0507.6927 4.8301 1.9958 6.1042 1.4534 1.4242 3.5695 2.222 6.4268 2.222 2.1676 0 4.3215-.5102 5.9787-1.2277 1.2797-.5518 1.7299-1.0843 1.7299-1.9179 0-.3214-.0737-.6806-.1921-1.0824-.1649-.5625-.4919-1.5539-.7626-2.1551-.1223-.2721-.2464-.4037-.4832-.4037-.0815 0-.194.0232-.3619.0687-1.6863.4831-3.5627.8626-4.8308.8626-1.176 0-1.9036-.2284-2.3693-.7048-.5094-.5218-.6938-1.3225-.6938-2.6208v-8.4327h5.9651c.912 0 1.4088-.2294 1.6998-.7464.2756-.4841.392-1.2218.392-2.2636 0-.7735-.0815-1.7553-.1795-2.2422-.0718-.3612-.2581-.4928-.716-.4928h-7.1614Zm34.0777.0006h-5.2078c-.9343 0-1.2273.3795-1.2273 1.1957v11.9742c0 1.5442-.3357 2.5385-1.0149 3.2065-.7141.7068-1.8095 1.1125-3.293 1.1125-1.4845 0-2.5779-.4057-3.294-1.1125-.6792-.668-1.0149-1.6623-1.0149-3.2065V21.7122h-5.2034c-.9343 0-1.2283.3795-1.2283 1.1957v12.8088c0 2.8909.8441 5.015 2.3907 6.5447 1.8522 1.8298 4.7163 2.8096 8.3499 2.8096 3.6345 0 6.4967-.9798 8.3489-2.8096 1.5485-1.5297 2.3941-3.6538 2.3941-6.5447V21.7122Zm31.681 31.8224c4.446 0 7.398-.9904 9.298-2.9451 1.738-1.7873 2.516-4.379 2.516-7.757V32.3948c0-3.5735-1.019-6.1672-2.774-7.9621-2-2.0458-5.185-3.2076-8.551-3.2076-7.26 0-11.864 4.531-11.864 11.9394 0 6.9436 3.711 11.6024 10.303 11.6024 2.776 0 4.98-1.0378 6.449-2.676v.9885c0 1.6033-.273 2.707-1.033 3.4815-.914.9275-2.72 1.34-5.293 1.34-1.704 0-3.872-.215-5.717-.4773-.611-.0852-1.007.1549-1.114.8945-.092.6487-.144 1.6091-.144 2.2026 0 1.5171.451 2.19 2.177 2.5366 1.564.3137 3.783.4773 5.747.4773Zm5.377-21.2056v.6419c0 2.248-.464 3.9433-1.506 5.0044-.81.8229-1.986 1.2993-3.502 1.2993-3.624 0-5.123-2.4437-5.123-6.1101 0-4.1641 2.107-6.0694 5.115-6.0694 1.496 0 2.774.487 3.625 1.3186.913.8898 1.391 2.2132 1.391 3.9153ZM29.0762 13.9823v27.487c0 1.0601-.2387 1.8018-.7248 2.2829-.6752.6681-1.8541.9304-3.4938.9304-.814 0-1.8376-.1026-2.5934-.3272-.6181-.1801-.9761-.4773-1.3749-1.0088-4.0304-5.3762-9.4715-12.7158-14.14903-19.0147v19.3187c0 .7019-.21345.9323-.97412.9323H0V17.0968c0-1.063.23868-1.8036.724771-2.2848.678199-.669 1.854129-.9304 3.493839-.9304.81598 0 1.83764.1036 2.5954.3262.65492.1946.98092.4822 1.37581 1.0098C11.7535 20.0004 17.2247 27.3932 22.334 34.2933V14.9059c0-.6758.2891-.9236.9654-.9236h5.7768ZM152.332 47.4774c-.699-.0997-1.015.2933-1.106.9033-.078.5266-.151 1.5316-.151 2.2006 0 1.3932.394 2.1474 2.138 2.492 1.465.2905 3.783.4628 5.701.4628 4.112 0 6.945-1.0446 8.68-2.9006 1.778-1.9005 2.486-4.6307 2.486-8.4859V21.7137h-5.323c-.766 0-1.115.4153-1.115 1.1947v11.1319c0 1.8279-.344 3.0681-1.113 3.9036-.78.8481-1.996 1.2877-3.51 1.2877-1.363 0-2.363-.3796-3.005-1.0941-.693-.7745-.97-1.855-.97-3.6964V21.7137h-5.298c-.87 0-1.139.4927-1.139 1.1511v12.1949c0 3.4012.788 5.657 2.348 7.2545 1.52 1.5577 3.778 2.4533 6.755 2.4533 2.636 0 4.765-1.094 5.932-2.3401v.5945c0 1.5403-.21 2.6963-.891 3.498-.815.9575-2.339 1.4115-5.003 1.4115-1.736 0-3.789-.2226-5.416-.454Z" clipRule="evenodd"/>
            </svg>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Comparativa Tarifas Naturgy</h1>
              <p className="text-xs text-blue-200">Herramienta comercial — Canarias</p>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-blue-900/50 p-1 rounded-xl overflow-x-auto max-w-full">
            <TabButton active={effectiveTab === "comparator"} onClick={() => setActiveTab("comparator")} icon={<Users size={16} />} label="Comercial" />
            {isAdmin && <TabButton active={effectiveTab === "admin"} onClick={() => setActiveTab("admin")} icon={<Shield size={16} />} label="Admin" />}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <span className="text-blue-200 hidden md:inline">{user.email}</span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload(); // Forzamos limpieza total
                  }}
                  className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors border border-white/10"
                >
                  Salir
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors border border-white/10 flex items-center gap-2 opacity-40 hover:opacity-100"
                title="Acceso administrador"
              >
                <Shield size={14} />
                <span className="hidden sm:inline text-xs">Admin</span>
              </button>
            )}
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-blue-800"></div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {dataError && (
          <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={16} className="flex-shrink-0" />
            {dataError}
          </div>
        )}
        {dataLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-pulse text-slate-400">Cargando tarifas...</div>
          </div>
        ) : effectiveTab === "comparator"
          ? <ComparatorView segments={segments} tariffs={tariffs} isAdmin={isAdmin} />
          : <AdminView segments={segments} tariffs={tariffs} />
        }
      </main>
      {effectiveShowAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} />}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-5 py-2 rounded-lg transition-all duration-200 font-medium text-sm ${active ? "bg-orange-500 text-white shadow-md" : "text-blue-100 hover:bg-white/10"}`}>
      {icon} {label}
    </button>
  );
}

// ── ADMIN LOGIN MODAL ─────────────────────────────────────────────────────────

function AdminLoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Credenciales incorrectas");
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100 relative">
        <button type="button" onClick={onClose} title="Cerrar" aria-label="Cerrar" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={20} />
        </button>
        <div className="text-center mb-8">
          <div className="bg-orange-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="text-orange-600" size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-[#002855]">Acceso Administrador</h1>
          <p className="text-slate-500 mt-2">Solo para gestión de tarifas y usuarios</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
            <input type="email" required placeholder="admin@email.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Contraseña</label>
            <input type="password" required placeholder="••••••••" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <div className="bg-red-50 border border-red-100 p-4 rounded-xl"><p className="text-red-600 text-sm font-medium text-center">{error}</p></div>}
          <button type="submit" disabled={loading} className="w-full bg-[#002855] text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-800 transition-colors shadow-lg flex items-center justify-center gap-2">
            {loading ? "Verificando..." : <><LogIn size={20} /> Entrar como Admin</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── COMPARATOR VIEW ───────────────────────────────────────────────────────────

function ComparatorView({ segments, tariffs, isAdmin }: { segments: Segment[]; tariffs: Tariff[]; isAdmin: boolean }) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Record<string, SegCliente>>({});
  const hasInitializedClients = useRef(false);

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
  const [tariffMeta, setTariffMeta] = useState<Record<string, { selected: boolean; open: boolean }>>({});
  const [activeSeg, setActiveSeg] = useState("res");
  const [subTabs, setSubTabs] = useState<Record<string, string>>({ res: "comp", pyme20: "comp", pyme20one: "comp", pyme361: "comp" });
  const [comercialData, setComercialData] = useState<ComercialData>({ nombre: "Salvador Muñoz Portillo", telefono: "", email: "admin@nexus-sales.com" });
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const chartInstances = useRef<Record<string, Chart>>({});

  const segDef = SEG_DEFS.find(s => s.id === activeSeg) ?? SEG_DEFS[0];
  const segColor = segDef.color;

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

  const saveConfig = async (segId: string) => {
    const c = clients[segId];
    const { error } = await supabase.from("segments").update({
      bono_rate: c.bonoRate,
      excedente_rate: c.excedenteRate,
      tax_imp_elec: c.taxImpElec,
      tax_igic: c.taxIGIC,
      tax_igic_red: c.taxIGICRed,
      tax_igic_7: c.taxIGIC7
    }).eq("id", segId);

    if (error) alert("Error al guardar: " + error.message);
    else alert("Configuración guardada correctamente");
  };

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

  // Draw chart effect
  useEffect(() => {
    if (subTabs[activeSeg] !== "comp") return;
    const timer = setTimeout(() => {
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
      chartInstances.current[segId] = new Chart(canvas, {
        type: "bar",
        data: {
          labels: ["Factura actual", ...results.map(x => x.t.nombre)],
          datasets: [{
            data: [+c.factura, ...results.map(x => +x.r.total.toFixed(2))],
            backgroundColor: ["#94a3b8", ...results.map(x => x.t.id === best.t.id ? "#F5821F" : x.color)],
            borderRadius: 5,
            borderSkipped: false as const,
          }] as never,
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx: never) => (ctx as { raw: number }).raw.toFixed(2).replace(".", ",") + " €" } },
          },
          scales: {
            y: { ticks: { callback: (v: unknown) => Number(v).toFixed(0) + " €", font: { size: 11 } }, grid: { color: "rgba(0,0,0,.05)" }, border: { display: false } },
            x: { ticks: { font: { size: 11 }, maxRotation: 28 }, grid: { display: false }, border: { display: false } },
          },
        },
      } as never);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeSeg, subTabs, clients, tariffMeta, segments, tariffs, getSegMeta, getSegTariffs]);

  // Auth warning banner (pyme20one only)
  const AuthWarning = () => activeSeg !== "pyme20one" ? null : (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
      <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <strong className="text-amber-800">Autorización previa requerida</strong>
        <p className="text-amber-700 mt-0.5">Este segmento tarifario <strong>no puede ofertarse</strong> sin autorización previa de Naturgy. Consulta con tu responsable antes de presentar esta comparativa al cliente.</p>
      </div>
    </div>
  );

  // ── CLIENT PANE ──────────────────────────────────────────────────────────────
  const ClientPane = ({ segId }: { segId: string }) => {
    const c = clients[segId];
    if (!c) return null;

    const { taxModel, potP } = getSegMeta(segId);
    const isPyme = taxModel !== "res";
    const enCols = potP === 6 ? 6 : 3;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <AuthWarning />
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-[#002855] text-base">Datos del cliente</h3>
          <button onClick={() => clearClient(segId)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors border border-slate-200 hover:border-red-200 rounded-lg px-3 py-1.5">
            <Trash2 size={12} /> Limpiar datos
          </button>
        </div>

        {/* Nombre + CUPS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Nombre</label>
            <input title="Nombre del cliente" placeholder="Nombre" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.nombre} onChange={e => upClient(segId, "nombre", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">CUPS</label>
            <input title="CUPS" placeholder="ES00XXXX..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono" value={c.cups} onChange={e => upClient(segId, "cups", e.target.value.toUpperCase())} />
          </div>
        </div>

        {/* Dirección */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-500 mb-1">Dirección de suministro</label>
          <input title="Dirección de suministro" placeholder="Calle, número, municipio" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.dir} onChange={e => upClient(segId, "dir", e.target.value)} />
        </div>

        {/* Fechas + Días */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Lectura anterior</label>
            <input type="date" title="Lectura anterior" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.f1} onChange={e => upDate(segId, "f1", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Lectura actual</label>
            <input type="date" title="Lectura actual" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.f2} onChange={e => upDate(segId, "f2", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Días del período</label>
            <input type="text" title="Días del período" className="w-full p-2.5 bg-orange-50 border border-orange-200 rounded-lg text-sm font-bold text-orange-700" 
              value={inputValues[`${segId}-dias`] ?? fmtRaw(c.dias, 0)} 
              onChange={e => {
                const val = e.target.value;
                setInputValues(prev => ({ ...prev, [`${segId}-dias`]: val }));
                const clean = val.replace(/\./g, '').replace(',', '.');
                const num = parseFloat(clean);
                if (!isNaN(num)) upClient(segId, "dias", num);
              }}
              onBlur={() => setInputValues(prev => {
                const next = { ...prev };
                delete next[`${segId}-dias`];
                return next;
              })}
            />
          </div>
        </div>

        <div className="border-t border-slate-100 my-4"></div>

        {/* Potencia contratada */}
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-l-4 border-orange-500 pl-2">Potencia contratada (kW)</p>
        <div className={`grid gap-3 mb-4 ${potP === 6 ? "grid-cols-3 md:grid-cols-6" : "grid-cols-2"}`}>
          {Array.from({ length: potP }, (_, i) => (
            <div key={i}>
              <label className="block text-xs text-slate-400 mb-1">{PERIODO_LABELS[i]}</label>
              <input type="text" title={PERIODO_LABELS[i]} placeholder="0" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" 
                value={inputValues[`${segId}-kw-${i}`] ?? fmtRaw(c.kw[i] || 0, 3)} 
                onChange={e => {
                  const val = e.target.value;
                  setInputValues(prev => ({ ...prev, [`${segId}-kw-${i}`]: val }));
                  const clean = val.replace(/\./g, '').replace(',', '.');
                  const num = parseFloat(clean);
                  if (!isNaN(num)) upClientArr(segId, "kw", i, num);
                }}
                onBlur={() => setInputValues(prev => {
                  const next = { ...prev };
                  delete next[`${segId}-kw-${i}`];
                  return next;
                })}
              />
            </div>
          ))}
        </div>

        {/* Consumo energía */}
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-l-4 border-blue-500 pl-2">Consumo energía (kWh)</p>
        <div className={`grid gap-3 mb-4 ${potP === 6 ? "grid-cols-3 md:grid-cols-6" : "grid-cols-3"}`}>
          {Array.from({ length: enCols }, (_, i) => (
            <div key={i}>
              <label className="block text-xs text-slate-400 mb-1">{PERIODO_LABELS[i]}</label>
              <input type="text" title={PERIODO_LABELS[i]} placeholder="0" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold" 
                value={inputValues[`${segId}-en-${i}`] ?? fmtRaw(c.en[i] || 0, 2)} 
                onChange={e => {
                  const val = e.target.value;
                  setInputValues(prev => ({ ...prev, [`${segId}-en-${i}`]: val }));
                  const clean = val.replace(/\./g, '').replace(',', '.');
                  const num = parseFloat(clean);
                  if (!isNaN(num)) upClientArr(segId, "en", i, num);
                }}
                onBlur={() => setInputValues(prev => {
                  const next = { ...prev };
                  delete next[`${segId}-en-${i}`];
                  return next;
                })}
              />
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 my-4"></div>

        {/* Alquiler + Factura */}
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Alquiler contador (€)</label>
            <input type="text" placeholder="0,00" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" 
              value={inputValues[`${segId}-alquiler`] ?? fmtRaw(c.alquiler || 0, 2)} 
              onChange={e => {
                const val = e.target.value;
                setInputValues(prev => ({ ...prev, [`${segId}-alquiler`]: val }));
                const clean = val.replace(/\./g, '').replace(',', '.');
                const num = parseFloat(clean);
                if (!isNaN(num)) upClient(segId, "alquiler", num);
              }}
              onBlur={() => setInputValues(prev => {
                const next = { ...prev };
                delete next[`${segId}-alquiler`];
                return next;
              })}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-green-600 mb-1">Excedentes kWh (placas)</label>
            <input type="text" placeholder="0" className="w-full p-2.5 bg-green-50 border border-green-200 rounded-lg text-sm font-bold text-green-700" 
              value={inputValues[`${segId}-enExc`] ?? fmtRaw(c.enExc || 0, 0)} 
              onChange={e => {
                const val = e.target.value;
                setInputValues(prev => ({ ...prev, [`${segId}-enExc`]: val }));
                const clean = val.replace(/\./g, '').replace(',', '.');
                const num = parseFloat(clean);
                if (!isNaN(num)) upClient(segId, "enExc", num);
              }}
              onBlur={() => setInputValues(prev => {
                const next = { ...prev };
                delete next[`${segId}-enExc`];
                return next;
              })}
            />
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor={`factura-${segId}`} className="block text-xs font-bold text-slate-500 mb-1">Importe factura actual (€)</label>
          <input id={`factura-${segId}`} type="text" placeholder="0,00" className="w-full p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-bold text-blue-700" 
            value={inputValues[`${segId}-factura`] ?? fmtRaw(c.factura || 0, 2)} 
            onChange={e => {
              const val = e.target.value;
              setInputValues(prev => ({ ...prev, [`${segId}-factura`]: val }));
              const clean = val.replace(/\./g, '').replace(',', '.');
              const num = parseFloat(clean);
              if (!isNaN(num)) upClient(segId, "factura", num);
            }}
            onBlur={() => setInputValues(prev => {
              const next = { ...prev };
              delete next[`${segId}-factura`];
              return next;
            })}
          />
        </div>

        <div className="border-t border-slate-100 my-4"></div>

        {/* Datos comercial */}
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-l-4 border-slate-700 pl-2">Datos del comercial</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Nombre comercial</label>
            <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="Nombre del agente" value={comercialData.nombre} onChange={e => setComercialData(p => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Teléfono</label>
            <input className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="600 000 000" value={comercialData.telefono} onChange={e => setComercialData(p => ({ ...p, telefono: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
            <input type="email" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="agente@naturgy.es" value={comercialData.email} onChange={e => setComercialData(p => ({ ...p, email: e.target.value }))} />
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">Creado para Cris Energy. @ todos los derechos reservados</p>
        </div>

        {/* Admin fiscal config */}
        {isAdmin ? (
          <>
            <div className="border-t border-slate-100 my-4"></div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 border-l-4 border-red-400 pl-2 flex items-center gap-2">
              Configuración fiscal
              <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full normal-case tracking-normal">Solo admin</span>
            </p>
            <p className="text-xs text-slate-400 mb-3">Fijados por normativa Canarias. No modificar salvo cambio regulatorio.</p>
            {isPyme ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div><label className="block text-xs text-slate-500 mb-1">Imp. electricidad (%)</label><input type="number" step="0.001" title="Impuesto electricidad (%)" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.taxImpElec} onChange={e => upClient(segId, "taxImpElec", +e.target.value)} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">IGIC Reducido (%)</label><input type="number" step="0.01" title="IGIC Reducido (%)" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.taxIGICRed} onChange={e => upClient(segId, "taxIGICRed", +e.target.value)} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">IGIC 7% alquiler (%)</label><input type="number" step="0.01" title="IGIC 7% alquiler (%)" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.taxIGIC7} onChange={e => upClient(segId, "taxIGIC7", +e.target.value)} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Bono Social (€/día)</label><input type="number" step="0.000001" title="Bono Social (€/día)" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.bonoRate} onChange={e => upClient(segId, "bonoRate", +e.target.value)} /></div>
                <div><label className="block text-xs text-green-600 mb-1 font-bold">Pago Excedente (€)</label><input type="number" step="0.001" title="Pago Excedente (€)" className="w-full p-2 bg-green-50 border border-green-200 rounded-lg text-sm" value={c.excedenteRate} onChange={e => upClient(segId, "excedenteRate", +e.target.value)} /></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label className="block text-xs text-slate-500 mb-1">Imp. electricidad (%)</label><input type="number" step="0.001" title="Impuesto electricidad (%)" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.taxImpElec} onChange={e => upClient(segId, "taxImpElec", +e.target.value)} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">IGIC alquiler (%)</label><input type="number" step="0.01" title="IGIC alquiler (%)" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.taxIGIC} onChange={e => upClient(segId, "taxIGIC", +e.target.value)} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Bono Social (€/día)</label><input type="number" step="0.000001" title="Bono Social (€/día)" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={c.bonoRate} onChange={e => upClient(segId, "bonoRate", +e.target.value)} /></div>
                <div><label className="block text-xs text-green-600 mb-1 font-bold">Pago Excedente (€)</label><input type="number" step="0.001" title="Pago Excedente (€)" className="w-full p-2 bg-green-50 border border-green-200 rounded-lg text-sm" value={c.excedenteRate} onChange={e => upClient(segId, "excedenteRate", +e.target.value)} /></div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button 
                onClick={() => saveConfig(segId)} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2"
              >
                <Shield size={14} /> Guardar configuración para comerciales
              </button>
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mt-2">
            🔒 Tipos aplicados (normativa Canarias): Imp. elec. {c.taxImpElec}% · {isPyme ? `IGIC red. ${c.taxIGICRed}% · IGIC alq. ${c.taxIGIC7}%` : `IGIC alq. ${c.taxIGIC}%`} · Bono Social {c.bonoRate} €/día
          </div>
        )}
      </div>
    );
  };

  // ── TARIFF PANE ──────────────────────────────────────────────────────────────
  const TariffPane = ({ segId }: { segId: string }) => {
    const { taxModel, potP } = getSegMeta(segId);
    const segTariffs = getSegTariffs(segId);
    const c = clients[segId];

    if (!segTariffs.length) return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
        <p>No hay tarifas para este segmento. Ve a Admin → Nueva Tarifa.</p>
      </div>
    );

    return (
      <div className="space-y-3">
        <AuthWarning />
        {segTariffs.map(t => {
          const r = calc(taxModel, potP, c, t);
          const ah = +(c.factura - r.total).toFixed(2);
          const isPyme = taxModel !== "res";
          const tipoBadge = ({ uni: "1 período", tri: "Trihoraria", hex: "6 períodos" } as Record<string, string>)[t.tipo] ?? t.tipo;
          const tipoCls = ({ uni: "bg-blue-100 text-blue-700", tri: "bg-amber-100 text-amber-700", hex: "bg-purple-100 text-purple-700" } as Record<string, string>)[t.tipo] ?? "bg-blue-100 text-blue-700";
          const pUL = t.potUnit === "dia" ? "€/kW·día" : "€/kW·año";
          const nEn = { uni: 1, tri: 3, hex: 6 }[t.tipo] ?? 1;

          return (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Card header */}
              <div
                className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                onClick={() => toggleOpen(t.id)}
              >
                <span
                  className="w-1.5 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: t.selected ? segColor : "#cbd5e1" }}
                ></span>
                <input
                  type="checkbox"
                  checked={t.selected}
                  aria-label={`Seleccionar ${t.nombre}`}
                  onClick={e => { e.stopPropagation(); toggleSelected(t.id); }}
                  onChange={() => {}}
                  className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
                  style={{ accentColor: segColor }}
                />
                <span className={`text-slate-400 text-xs transition-transform ${t.open ? "rotate-90" : ""}`}>▶</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-semibold text-slate-800 text-sm truncate">{t.nombre}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tipoCls}`}>{tipoBadge}</span>
                    {t.requires_auth && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Auth. requerida</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="font-black text-[#002855] text-base">{fmtEur(r.total)}</span>
                  {c.factura > 0 && (
                    <div className={`text-[10px] sm:text-xs font-bold ${ah > 0.005 ? "text-green-600" : ah < -0.005 ? "text-red-500" : "text-slate-400"}`}>
                      {ah > 0.005 ? `−${fmtEur(ah)}` : ah < -0.005 ? `+${fmtEur(Math.abs(ah))}` : "Igual"}
                    </div>
                  )}
                </div>
              </div>

              {/* Card body */}
              {t.open && (
                <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50">
                  <div className="text-xs text-slate-500 bg-white border border-slate-100 rounded-lg px-3 py-2 mb-4">
                    🔒 Precios oficiales Naturgy
                  </div>

                  {/* Potencia */}
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Término de potencia</p>
                  <div className="space-y-1 mb-4">
                    {Array.from({ length: potP }, (_, i) => t.rPot[i] ? (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-500">P{i + 1} — {(+t.rPot[i]).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}</span>
                        <span className="text-slate-400">{pUL}</span>
                      </div>
                    ) : null)}
                  </div>

                  {/* Energía */}
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Término de energía</p>
                  <div className="space-y-1 mb-4">
                    {Array.from({ length: nEn }, (_, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-500">{t.tipo === "uni" && i === 0 ? "Todos los períodos" : `P${i + 1}`} — {(+t.rEn[i]).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}</span>
                        <span className="text-slate-400">€/kWh</span>
                      </div>
                    ))}
                  </div>

                  {/* SVA */}
                  {t.sva > 0 && (
                    <div className="flex justify-between text-xs mb-4">
                      <span className="text-slate-500">SVA</span>
                      <span className="font-bold text-slate-700">{fmtEur(t.sva)}</span>
                    </div>
                  )}

                  {/* Resumen de costes */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Resumen de costes</p>
                    {(isPyme ? [
                      ["Coste potencia", r.potencia], ["Coste energía", r.energia],
                      r.sva ? ["SVA", r.sva] : null, ["Alquiler contador", r.alquiler],
                      null, ["Subtotal", r.subtotal], ["Imp. electricidad", r.impElec],
                      ["IGIC Reducido 3%", r.igicRed], ["IGIC 7% alquiler", r.igic7],
                    ] as ([string, number | undefined] | null)[] : [
                      ["Coste potencia", r.potencia], ["Coste energía", r.energia],
                      r.sva ? ["SVA", r.sva] : null, ["Alquiler contador", r.alquiler],
                      null, ["Subtotal", r.subtotal], ["Imp. electricidad", r.impElec],
                      ["IGIC alquiler", r.igic ?? 0], ["Financiación Bono Social", r.bonoSocial],
                    ] as ([string, number | undefined] | null)[]).map((row, idx) =>
                      row === null ? <div key={idx} className="my-1 border-t border-slate-100"></div> : (
                        <div key={idx} className="flex justify-between text-xs py-0.5">
                          <span className="text-slate-500">{row[0]}</span>
                          <span className="font-semibold text-slate-700">{fmtEur(row[1])}</span>
                        </div>
                      )
                    )}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-slate-200">
                      <span className="font-bold text-slate-700 text-sm">Total estimado</span>
                      <span className="font-black text-lg" style={{ color: segColor }}>{fmtEur(r.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── COMP PANE ────────────────────────────────────────────────────────────────
  const CompPane = ({ segId }: { segId: string }) => {
    const c = clients[segId];
    if (!c) return null;

    const { taxModel, potP } = getSegMeta(segId);
    const segTariffs = getSegTariffs(segId);
    const isPyme = taxModel !== "res";

    const isEmpty = !+c.factura && c.en.every(v => !+v) && c.kw.every(v => !+v);
    if (isEmpty) return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <AuthWarning />
        <div className="text-slate-300 text-5xl mb-4">⚡</div>
        <h3 className="font-bold text-slate-600 text-lg">Sin datos de cliente</h3>
        <p className="text-slate-400 mt-2">Introduce los datos del cliente en la pestaña <strong>Datos cliente</strong> para ver la comparativa.</p>
      </div>
    );

    const selected = segTariffs.filter(t => t.selected);
    if (!selected.length) return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <p className="text-slate-400">Ve a <strong>Tarifas</strong> y selecciona al menos una para comparar.</p>
      </div>
    );

    const results = selected.map((t, i) => ({ t, r: calc(taxModel, potP, c, t), color: CHART_COLS[i % CHART_COLS.length] }));
    const best = results.reduce((a, b) => b.r.total < a.r.total ? b : a, results[0]);
    const bestAh = +(c.factura - best.r.total).toFixed(2);

    const handleExportPDF = async () => {
      exportPDF(segDef.label, taxModel, potP, c, segTariffs, comercialData);
      
      // Guardar en el historial (RGPD)
      try {
        const currentUser = user;
        await supabase.from('client_comparisons').insert({
          user_id: currentUser?.id,
          client_name: c.nombre || 'Sin nombre',
          client_email: (c as any).email || null,
          client_address: c.dir || null,
          calculation_data: {
            best_tariff: best.t.nombre,
            total_cost: best.r.total,
            saving: bestAh,
            current_invoice: c.factura,
            segment: segDef.label
          }
        });
        
        await supabase.from('user_activity').insert({
          user_id: currentUser?.id,
          action: 'PDF_EXPORTED',
          details: { client: c.nombre, segment: segDef.label }
        });
      } catch (err) {
        console.error("Error al guardar en el historial:", err);
      }
    };

    const rowDefs: [string, string][] = isPyme ? [
      ["Coste potencia", "potencia"], ["Coste energía", "energia"], ["SVA", "sva"],
      ["Alquiler", "alquiler"], ["Subtotal", "subtotal"], ["Imp. electricidad", "impElec"],
      ["IGIC Red. 3%", "igicRed"], ["IGIC 7% alquiler", "igic7"], ["Bono Social *", "bonoSocial"],
    ] : [
      ["Coste potencia", "potencia"], ["Coste energía", "energia"], ["SVA", "sva"],
      ["Alquiler", "alquiler"], ["Subtotal", "subtotal"], ["Imp. electricidad", "impElec"],
      ["IGIC alquiler", "igic"], ["Bono Social", "bonoSocial"],
    ];

    return (
      <div className="space-y-5">
        <AuthWarning />

        {/* Export buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-[#002855] hover:bg-blue-900 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            Exportar PDF
          </button>
          <button
            onClick={() => exportExcel(segDef.label, taxModel, potP, c, segTariffs)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F6E56] hover:bg-green-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Exportar Excel
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Factura actual</p>
            <p className="text-2xl font-black text-slate-700 mt-1">{fmtEur(c.factura)}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{c.nombre || "Cliente"}</p>
          </div>
          <div className="bg-white rounded-2xl border-2 p-4 shadow-sm" style={{ borderColor: segColor }}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mejor opción</p>
            <p className="text-2xl font-black mt-1" style={{ color: "#F5821F" }}>{fmtEur(best.r.total)}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{best.t.nombre}</p>
          </div>
          <div className={`rounded-2xl border p-4 shadow-sm ${bestAh >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ahorro máximo</p>
            <p className={`text-2xl font-black mt-1 ${bestAh >= 0 ? "text-green-700" : "text-red-600"}`}>
              {bestAh >= 0 ? "−" : "+"}{fmtEur(Math.abs(bestAh))}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">vs factura actual</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tarifas comparadas</p>
            <p className="text-2xl font-black text-slate-700 mt-1">{results.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">seleccionadas</p>
          </div>
        </div>

        {/* Comparison table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 font-bold text-slate-600">Componente</th>
                  <th className="text-right p-3 font-bold text-slate-600">Factura actual</th>
                  {results.map(x => (
                    <th key={x.t.id} className="text-right p-3 font-bold" style={{ color: x.t.id === best.t.id ? "#F5821F" : "#002855" }}>{x.t.nombre}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowDefs.map(([lbl, key], idx) => {
                  const isBono = key === "bonoSocial" && isPyme;
                  return (
                    <tr key={key} className={`border-b border-slate-100 ${idx % 2 === 0 ? "" : "bg-slate-50/50"} ${isBono ? "opacity-40" : ""}`}>
                      <td className="p-3 text-slate-600">{lbl}</td>
                      <td className="text-right p-3 text-slate-500">{key === "alquiler" ? fmtEur(c.alquiler) : "—"}</td>
                      {results.map(x => (
                        <td key={x.t.id} className="text-right p-3 font-semibold text-slate-700">
                          {(x.r as unknown as Record<string, number | undefined>)[key] !== undefined ? fmtEur((x.r as unknown as Record<string, number | undefined>)[key]) : "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-300 bg-orange-50/50">
                  <td className="p-3 font-black text-slate-800">TOTAL ESTIMADO</td>
                  <td className="text-right p-3 font-black text-slate-800">{fmtEur(c.factura)}</td>
                  {results.map(x => {
                    const ah = +(c.factura - x.r.total).toFixed(2);
                    return (
                      <td key={x.t.id} className="text-right p-3">
                        <span className="font-black" style={{ color: x.t.id === best.t.id ? "#F5821F" : "#002855" }}>{fmtEur(x.r.total)}</span>
                        {ah > 0.005 && <span className="ml-1 text-green-600 font-bold">−{fmtEur(ah)}</span>}
                        {ah < -0.005 && <span className="ml-1 text-red-500 font-bold">+{fmtEur(Math.abs(ah))}</span>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {isPyme && <p className="text-xs text-slate-400">* Bono Social mostrado como referencia; no incluido en el total según normativa Canarias.</p>}
        <p className="text-xs text-slate-400">Comparativa estimativa, no vinculante. Puede variar según lecturas reales del cliente.</p>

        {/* Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Comparativa visual</p>
          <div className="relative" style={{ height: "260px" }}>
            <canvas id={`compChart_${segId}`}></canvas>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#94a3b8] inline-block"></span> Factura actual
            </span>
            {results.map(x => (
              <span key={x.t.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: x.t.id === best.t.id ? "#F5821F" : x.color }}></span>
                {x.t.nombre}
              </span>
            ))}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-medium">Creado para Cris Energy. @ todos los derechos reservados</p>
          </div>
        </div>
      </div>
    );
  };

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  const sub = subTabs[activeSeg] ?? "comp";

  return (
    <div>
      {/* Segment tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto mb-2 scrollbar-hide">
        {SEG_DEFS.map(seg => (
          <button
            key={seg.id}
            onClick={() => setActiveSeg(seg.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-1 sm:flex-none justify-center"
            style={activeSeg === seg.id
              ? { backgroundColor: seg.color, color: "#fff" }
              : { color: "#64748b" }
            }
          >
            <span className="w-2 h-2 rounded-full hidden sm:inline-block" style={{ backgroundColor: activeSeg === seg.id ? "rgba(255,255,255,0.6)" : seg.color }}></span>
            {seg.label}
          </button>
        ))}
      </div>

      {/* Sub-tab bar */}
      <div className="flex border-b border-slate-200 mb-5 overflow-x-auto scrollbar-hide">
        {[["cli", "Datos cliente"], ["tar", "Tarifas"], ["comp", "Comparativa"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className="px-4 sm:px-6 py-3 text-sm font-semibold transition-all relative flex-1 whitespace-nowrap"
            style={sub === id
              ? { color: segColor, borderBottom: `2px solid ${segColor}`, marginBottom: "-1px" }
              : { color: "#94a3b8" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active pane — llamados como funciones para evitar remount al escribir */}
      {sub === "cli" && ClientPane({ segId: activeSeg })}
      {sub === "tar" && TariffPane({ segId: activeSeg })}
      {sub === "comp" && CompPane({ segId: activeSeg })}
    </div>
  );
}

// ── ADMIN VIEW ────────────────────────────────────────────────────────────────

function AdminView({ segments, tariffs }: { segments: Segment[]; tariffs: Tariff[] }) {
  const [profiles, setProfiles] = useState<{ id: string; email: string; is_admin: boolean; is_approved: boolean }[]>([]);
  const [view, setView] = useState<"tariffs" | "users">("tariffs");
  const [showTariffForm, setShowTariffForm] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("*").then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  const toggleApprove = async (id: string, current: boolean) => {
    await supabase.from("profiles").update({ is_approved: !current }).eq("id", id);
    setProfiles(profiles.map(p => p.id === id ? { ...p, is_approved: !current } : p));
  };

  const toggleAdmin = async (id: string, current: boolean) => {
    if (!confirm(`¿${current ? "Quitar" : "Dar"} permisos de administrador a este usuario?`)) return;
    await supabase.from("profiles").update({ is_admin: !current, is_approved: true }).eq("id", id);
    setProfiles(profiles.map(p => p.id === id ? { ...p, is_admin: !current, is_approved: true } : p));
  };

  const deleteTariff = async (id: string) => {
    if (!confirm("¿Seguro que quieres borrar esta tarifa?")) return;
    await supabase.from("tariffs").delete().eq("id", id);
    window.location.reload();
  };

  const closeForm = () => { setShowTariffForm(false); setEditingTariff(null); };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2 text-[#002855]"><Shield className="text-orange-500" size={22} /> Panel de Control</h2>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setView("tariffs")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === "tariffs" ? "bg-white shadow-sm text-blue-900" : "text-slate-500"}`}>Tarifas</button>
          <button onClick={() => setView("users")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === "users" ? "bg-white shadow-sm text-blue-900" : "text-slate-500"}`}>Usuarios</button>
        </div>
      </div>
      {view === "tariffs" ? (
        <div className="space-y-3">
          <div className="flex justify-end mb-2">
            <button onClick={() => setShowTariffForm(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2"><Plus size={16} /> Nueva Tarifa</button>
          </div>
          {tariffs.map(t => (
            <div key={t.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xs">{t.type.toUpperCase()}</div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{t.name}</h3>
                  <p className="text-xs text-slate-400">
                    {segments.find(s => s.id === t.segment_id)?.label}
                    {t.requires_auth && <span className="ml-2 text-amber-600 font-semibold">· Auth. requerida</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingTariff(t)} className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50" title="Editar tarifa"><Pencil size={16} /></button>
                <button onClick={() => deleteTariff(t.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50" title="Borrar tarifa"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          {(showTariffForm || editingTariff) && (
            <TariffForm segments={segments} tariff={editingTariff ?? undefined} onClose={closeForm} />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profiles.map(p => (
            <div key={p.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{p.email}</p>
                  <p className="text-xs text-slate-400">{p.is_admin ? "Administrador" : "Comercial"}</p>
                </div>
                <button
                  onClick={() => toggleAdmin(p.id, p.is_admin)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${p.is_admin ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-500 hover:bg-purple-50 hover:text-purple-700"}`}
                  title={p.is_admin ? "Quitar admin" : "Hacer admin"}
                >
                  {p.is_admin ? "Admin ✓" : "Hacer admin"}
                </button>
              </div>
              {!p.is_admin && (
                <button
                  onClick={() => toggleApprove(p.id, p.is_approved)}
                  className={`w-full mt-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${p.is_approved ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                >
                  {p.is_approved ? "🔒 Bloquear acceso" : "✓ Aprobar acceso"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-slate-100 text-center">
        <p className="text-[10px] text-slate-400 font-medium font-sans">Creado para Cris Energy. @ todos los derechos reservados</p>
      </div>
    </div>
  );
}

// ── TARIFF FORM ───────────────────────────────────────────────────────────────

function TariffForm({ segments, onClose, tariff }: { segments: Segment[]; onClose: () => void; tariff?: Tariff }) {
  const isEdit = !!tariff;
  const [form, setForm] = useState({
    segment_id: tariff?.segment_id ?? segments[0]?.id ?? "",
    name: tariff?.name ?? "",
    type: tariff?.type ?? "uni",
    pot_unit: tariff?.pot_unit ?? "dia",
    r_pot: tariff ? [...tariff.r_pot.map(String), ...Array(6).fill("")].slice(0, 6) : ["", "", "", "", "", ""],
    r_en:  tariff ? [...tariff.r_en.map(String),  ...Array(6).fill("")].slice(0, 6) : ["", "", "", "", "", ""],
    sva: String(tariff?.sva ?? "0"),
    requires_auth: tariff?.requires_auth ?? false,
  });

  const save = async () => {
    if (!form.name.trim()) { alert("El nombre de la tarifa es obligatorio."); return; }
    const supabase = (await import("./lib/supabase")).supabase;
    const payload = {
      segment_id: form.segment_id,
      name: form.name.trim(),
      type: form.type,
      pot_unit: form.pot_unit,
      r_pot: form.r_pot.map(v => parseFloat(v as string) || 0),
      r_en:  form.r_en.map(v => parseFloat(v as string) || 0),
      sva: parseFloat(form.sva) || 0,
      requires_auth: form.requires_auth,
    };
    const { error } = isEdit
      ? await supabase.from("tariffs").update(payload).eq("id", tariff!.id)
      : await supabase.from("tariffs").insert([payload]);
    if (error) alert("Error: " + error.message);
    else { onClose(); window.location.reload(); }
  };

  return (
    <div className="fixed inset-0 bg-[#002855]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#002855]">{isEdit ? "Editar Tarifa" : "Nueva Tarifa"}</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="tf-name" className="text-xs font-bold text-slate-400">Nombre de la Tarifa</label>
            <input id="tf-name" className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200" placeholder="Ej: Plan Fijo Luz 24h" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="tf-segment" className="text-xs font-bold text-slate-400">Segmento</label>
            <select id="tf-segment" title="Segmento" className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200" value={form.segment_id} onChange={e => setForm({ ...form, segment_id: e.target.value })}>
              {segments.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400">Tipo / Unidad de Potencia</label>
          <div className="flex gap-4 mt-1">
            <select title="Tipo de tarifa" className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="uni">Unihoraria (1P)</option>
              <option value="tri">Discriminada (3P)</option>
              <option value="hex">Seis períodos (6P)</option>
            </select>
            <select title="Unidad de potencia" className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200" value={form.pot_unit} onChange={e => setForm({ ...form, pot_unit: e.target.value })}>
              <option value="dia">€/kW·día</option>
              <option value="anio">€/kW·año</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-bold text-slate-400">Precios Potencia (P1–P6)</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {form.r_pot.map((v, i) => (
                <input key={i} className="p-2 text-xs bg-slate-50 rounded border border-slate-200" placeholder={`P${i + 1}`} value={v}
                  onChange={e => { const n = [...form.r_pot]; n[i] = e.target.value; setForm({ ...form, r_pot: n }); }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400">Precios Energía (E1–E6)</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {form.r_en.map((v, i) => (
                <input key={i} className="p-2 text-xs bg-slate-50 rounded border border-slate-200" placeholder={`E${i + 1}`} value={v}
                  onChange={e => { const n = [...form.r_en]; n[i] = e.target.value; setForm({ ...form, r_en: n }); }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <label htmlFor="tf-sva" className="text-xs font-bold text-slate-400">SVA (€/mes, opcional)</label>
            <input id="tf-sva" type="number" step="0.01" className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm" placeholder="0" value={form.sva} onChange={e => setForm({ ...form, sva: e.target.value })} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer pt-5">
            <input type="checkbox" className="w-4 h-4 rounded accent-amber-500" checked={form.requires_auth} onChange={e => setForm({ ...form, requires_auth: e.target.checked })} />
            <span className="text-sm font-semibold text-amber-700">Requiere autorización previa</span>
          </label>
        </div>
        <button onClick={save} className="w-full bg-[#002855] text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg">
          {isEdit ? "Guardar cambios" : "Crear tarifa"}
        </button>
      </div>
    </div>
  );
}

export default App;
