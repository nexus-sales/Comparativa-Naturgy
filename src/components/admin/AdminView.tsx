import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Shield, Trash2, Pencil, Plus, FileText, Users, X } from "lucide-react";
import { KPICard } from "../KPICard";
import { fmtEur } from "../../utils/calculations";
import { useAppStore } from "../../store/useAppStore";
import type { Segment, Tariff, ClientComparison, Profile } from "../../types";

interface AdminViewProps {
  segments: Segment[];
  tariffs: Tariff[];
}

export function AdminView({ segments, tariffs }: AdminViewProps) {
  const { refresh: refreshStore } = useAppStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [history, setHistory] = useState<ClientComparison[]>([]);
  const [view, setView] = useState<"tariffs" | "users" | "history">("tariffs");
  const [showTariffForm, setShowTariffForm] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [filterSegment, setFilterSegment] = useState<string>("all");
  
  // Filtros historial admin
  const [historyFilterTariff, setHistoryFilterTariff] = useState<string>("");
  const [historyFilterSegment, setHistoryFilterSegment] = useState<string>("");

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("email");
      if (error) {
        console.error("Error loading profiles:", error);
      } else if (data) {
        setProfiles(data);
      }
    };

    fetchProfiles();
    
    const fetchAdminHistory = async () => {
      const { data, error } = await supabase.from("client_comparisons")
        .select("*, profiles(email)")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) {
        console.error("Admin History Error (Join failed):", error);
        const { data: sData } = await supabase.from("client_comparisons")
          .select("*")
          .order("created_at", { ascending: false });
        if (sData) setHistory(sData);
      } else if (data) {
        setHistory(data);
      }
    };

    fetchAdminHistory();
  }, []);

  const toggleApprove = async (id: string, current: boolean) => {
    const nextApproved = !current;
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: nextApproved, is_blocked: !nextApproved })
      .eq("id", id);
    if (error) {
      alert("Error al actualizar usuario: " + error.message);
      return;
    }
    setProfiles(profiles.map(p => p.id === id ? { ...p, is_approved: nextApproved, is_blocked: !nextApproved } : p));
  };

  const toggleAdmin = async (id: string, current: boolean) => {
    if (!confirm(`¿${current ? "Quitar" : "Dar"} permisos de administrador a este usuario?`)) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_admin: !current, is_approved: true, is_blocked: false })
      .eq("id", id);
    if (error) {
      alert("Error al actualizar permisos: " + error.message);
      return;
    }
    setProfiles(profiles.map(p => p.id === id ? { ...p, is_admin: !current, is_approved: true, is_blocked: false } : p));
  };

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar permanentemente al usuario ${email}? Esta acción no se puede deshacer.`)) return;
    
    // Primero intentamos borrar el perfil (que debería borrar en cascada o simplemente el registro de la tabla profiles)
    // Nota: Para borrar del Auth de Supabase se requiere una Service Role Key o llamar a una Edge Function,
    // pero aquí borraremos el perfil de la base de datos que es lo que gestiona el acceso en la app.
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error al eliminar usuario: " + error.message);
      return;
    }

    setProfiles(profiles.filter(p => p.id !== id));
    alert("Usuario eliminado correctamente de la base de datos.");
  };

  const deleteTariff = async (id: string) => {
    if (!confirm("¿Seguro que quieres borrar esta tarifa?")) return;
    const { error } = await supabase.from("tariffs").delete().eq("id", id);
    if (error) {
      alert("Error al borrar: " + error.message);
    } else {
      alert("Tarifa eliminada");
      void refreshStore();
    }
  };

  const closeForm = () => { setShowTariffForm(false); setEditingTariff(null); };

  const filteredHistory = history.filter(item => {
    const cd = item.calculation_data as Record<string, unknown>;
    const tariffMatch = !historyFilterTariff || item.target_tariff === historyFilterTariff || cd?.best_tariff === historyFilterTariff;
    const segmentMatch = !historyFilterSegment || item.target_segment === historyFilterSegment || cd?.segment === historyFilterSegment;
    return tariffMatch && segmentMatch;
  });

  const uniqueHistoryTariffs = Array.from(new Set(history.map(item => {
    const cd = item.calculation_data as Record<string, unknown>;
    return item.target_tariff || (cd?.best_tariff as string);
  }).filter(Boolean)));
  const uniqueHistorySegments = Array.from(new Set(history.map(item => {
    const cd = item.calculation_data as Record<string, unknown>;
    return item.target_segment || (cd?.segment as string);
  }).filter(Boolean)));

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2 text-[#002855]"><Shield className="text-orange-500" size={22} /> Panel de Control</h2>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setView("tariffs")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === "tariffs" ? "bg-white shadow-sm text-blue-900" : "text-slate-500"}`}>Tarifas</button>
          <button onClick={() => setView("history")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === "history" ? "bg-white shadow-sm text-blue-900" : "text-slate-500"}`}>Historial</button>
          <button onClick={() => setView("users")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === "users" ? "bg-white shadow-sm text-blue-900" : "text-slate-500"}`}>Usuarios</button>
        </div>
      </div>
      {view === "tariffs" && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-4">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto w-full sm:w-auto scrollbar-hide">
              <button 
                onClick={() => setFilterSegment("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterSegment === "all" ? "bg-white shadow-sm text-blue-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                Todas
              </button>
              {segments.map(seg => (
                <button
                  key={seg.id}
                  onClick={() => setFilterSegment(seg.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterSegment === seg.id ? "bg-white shadow-sm text-blue-900" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    seg.id === 'res' ? 'bg-orange-500' : 
                    seg.id === 'pyme361' ? 'bg-purple-600' : 
                    'bg-blue-600'
                  }`}></span>
                  {seg.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowTariffForm(true)} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2">
              <Plus size={16} /> Nueva Tarifa
            </button>
          </div>
          {tariffs
            .filter(t => filterSegment === "all" || t.segment_id === filterSegment)
            .sort((a, b) => {
              const segA = segments.findIndex(s => s.id === a.segment_id);
              const segB = segments.findIndex(s => s.id === b.segment_id);
              return segA - segB;
            })
            .map(t => (
            <div key={t.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-sm hover:border-blue-200 transition-colors">
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
      )}

      {view === "history" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Total Global" value={filteredHistory.length} icon={<FileText className="text-blue-500" size={20} />} />
            <KPICard title="Ahorro Acumulado" value={fmtEur(filteredHistory.reduce((acc, curr) => acc + (((curr.calculation_data as Record<string, unknown>)?.saving as number) || 0), 0))} icon={<div className="text-green-500 font-bold">€</div>} />
            <KPICard 
              title="Ahorro Promedio" 
              value={fmtEur(filteredHistory.length ? filteredHistory.reduce((acc, curr) => acc + (((curr.calculation_data as Record<string, unknown>)?.saving as number) || 0), 0) / filteredHistory.length : 0)} 
              icon={<div className="text-emerald-500 font-bold">⌀</div>} 
            />
            <KPICard title="Top Comercial" value={
              Object.entries(filteredHistory.reduce<Record<string, number>>((acc, curr) => {
                const name = curr.profiles?.email?.split('@')[0] || 'Desconocido';
                acc[name] = (acc[name] || 0) + 1;
                return acc;
              }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "-"
            } icon={<Users className="text-orange-500" size={20} />} />
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Tarifa:</span>
              <select 
                title="Filtrar por Tarifa"
                value={historyFilterTariff} 
                onChange={(e) => setHistoryFilterTariff(e.target.value)}
                className="text-sm border-none bg-slate-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="">Todas</option>
                {uniqueHistoryTariffs.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Sector:</span>
              <select 
                title="Filtrar por Sector"
                value={historyFilterSegment} 
                onChange={(e) => setHistoryFilterSegment(e.target.value)}
                className="text-sm border-none bg-slate-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="">Todos</option>
                {uniqueHistorySegments.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
              </select>
            </div>
            {(historyFilterTariff || historyFilterSegment) && (
              <button 
                onClick={() => { setHistoryFilterTariff(""); setHistoryFilterSegment(""); }}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 underline"
              >
                Limpiar Filtros
              </button>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Comercial</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Sector</th>
                    <th className="px-6 py-4 text-right">Ahorro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map(item => {
                    const cd = item.calculation_data as Record<string, unknown>;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 font-bold text-blue-700">
                          {item.profiles?.email?.split('@')[0] || 'Desconocido'}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-800">{item.client_name}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            {item.target_segment || (cd?.segment as string)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black text-green-600 text-right whitespace-nowrap">
                          {fmtEur((cd?.saving as number) || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!filteredHistory.length && (
              <div className="p-12 text-center text-slate-400 italic bg-slate-50/30">
                {history.length ? "No hay resultados para los filtros seleccionados." : "No hay registros aún en el sistema."}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "users" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profiles.map(p => (
            <div key={p.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{p.email}</p>
                  <p className="text-xs text-slate-400">{p.is_admin ? "Administrador" : "Comercial"}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleAdmin(p.id, p.is_admin)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${p.is_admin ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-500 hover:bg-purple-50 hover:text-purple-700"}`}
                    title={p.is_admin ? "Quitar admin" : "Hacer admin"}
                  >
                    {p.is_admin ? "Admin ✓" : "Hacer admin"}
                  </button>
                  <button
                    onClick={() => deleteUser(p.id, p.email)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar usuario"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
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
    </div>
  );
}

function TariffForm({ segments, onClose, tariff }: { segments: Segment[]; onClose: () => void; tariff?: Tariff }) {
  const isEdit = !!tariff;
  const [form, setForm] = useState({
    segment_id: tariff?.segment_id ?? segments[0]?.id ?? "",
    name: tariff?.name ?? "",
    type: tariff?.type ?? "uni",
    pot_unit: tariff?.pot_unit ?? "dia",
    r_pot: tariff ? [...tariff.r_pot.map(v => v === 0 ? "" : String(v)), ...Array(6).fill("")].slice(0, 6) : ["", "", "", "", "", ""],
    r_en:  tariff ? [...tariff.r_en.map(v => v === 0 ? "" : String(v)),  ...Array(6).fill("")].slice(0, 6) : ["", "", "", "", "", ""],
    sva: String(tariff?.sva ?? "0"),
    requires_auth: tariff?.requires_auth ?? false,
  });

  const save = async () => {
    const cleanNum = (v: string | number) => {
      if (typeof v === "number") return v;
      const s = String(v || "0").replace(/[^\d,.+-]/g, "").replace(",", ".");
      const res = parseFloat(s);
      return isNaN(res) ? 0 : res;
    };

    // Ajustar arrays según el tipo antes de guardar
    let final_r_en = form.r_en.map(v => cleanNum(v));
    let final_r_pot = form.r_pot.map(v => cleanNum(v));

    if (form.type === 'uni') {
      final_r_en = final_r_en.slice(0, 1);
      final_r_pot = final_r_pot.slice(0, 2);
    } else if (form.type === 'tri') {
      final_r_en = final_r_en.slice(0, 3);
      final_r_pot = final_r_pot.slice(0, 2);
    } else if (form.type === 'hex') {
      final_r_en = final_r_en.slice(0, 6);
      final_r_pot = final_r_pot.slice(0, 6);
    }

    const payload = {
      segment_id: form.segment_id,
      name: form.name.trim(),
      type: form.type,
      pot_unit: form.pot_unit,
      r_pot: final_r_pot,
      r_en:  final_r_en,
      sva: cleanNum(form.sva),
      requires_auth: form.requires_auth,
    };
    const { error } = isEdit
      ? await supabase.from("tariffs").update(payload).eq("id", tariff!.id)
      : await supabase.from("tariffs").insert([payload]);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      alert("Tarifa guardada correctamente");
      onClose();
      void useAppStore.getState().refresh();
    }
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
            <input id="tf-name" className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm" placeholder="Ej: Plan Fijo Luz 24h" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="tf-segment" className="text-xs font-bold text-slate-400">Segmento</label>
            <select id="tf-segment" title="Segmento" className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm" value={form.segment_id} onChange={e => setForm({ ...form, segment_id: e.target.value })}>
              {segments.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400">Tipo / Unidad de Potencia</label>
          <div className="flex gap-4 mt-1">
            <select title="Tipo de tarifa" className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="uni">Unihoraria (1P)</option>
              <option value="tri">Discriminada (3P)</option>
              <option value="hex">Seis períodos (6P)</option>
            </select>
            <select title="Unidad de potencia" className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm" value={form.pot_unit} onChange={e => setForm({ ...form, pot_unit: e.target.value })}>
              <option value="dia">€/kW·día</option>
              <option value="anio">€/kW·año</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-bold text-slate-400">
              Precios Potencia ({form.type === 'hex' ? 'P1–P6' : 'P1–P2'})
            </label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(form.type === 'hex' ? form.r_pot : form.r_pot.slice(0, 2)).map((v, i) => (
                <input key={i} className="p-2 text-xs bg-slate-50 rounded border border-slate-200 font-mono" placeholder={`P${i + 1}`} value={v}
                  onChange={e => { const n = [...form.r_pot]; n[i] = e.target.value; setForm({ ...form, r_pot: n }); }} title={`Potencia P${i + 1}`} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400">
              Precios Energía ({form.type === 'uni' ? 'E1' : form.type === 'tri' ? 'E1–E3' : 'E1–E6'})
            </label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(form.type === 'uni' ? form.r_en.slice(0, 1) : form.type === 'tri' ? form.r_en.slice(0, 3) : form.r_en).map((v, i) => (
                <input key={i} className="p-2 text-xs bg-slate-50 rounded border border-slate-200 font-mono" placeholder={`E${i + 1}`} value={v}
                  onChange={e => { const n = [...form.r_en]; n[i] = e.target.value; setForm({ ...form, r_en: n }); }} title={`Energía E${i + 1}`} />
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
