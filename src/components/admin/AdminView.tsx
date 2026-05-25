import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Shield, Trash2, Pencil, Plus, FileText, Users, X, UserX, Bell, Zap, Wrench, Newspaper, Archive, RotateCcw, Star } from "lucide-react";
import { KPICard } from "../KPICard";
import { fmtEur } from "../../utils/calculations";
import { useAppStore } from "../../store/useAppStore";
import { toSectorFilter } from "../../utils/sectors";
import type { Segment, Tariff, ClientComparison, Profile, Notice } from "../../types";

interface AdminViewProps {
  segments: Segment[];
  tariffs: Tariff[];
}

export function AdminView({ segments, tariffs }: AdminViewProps) {
  const { refresh: refreshStore } = useAppStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [history, setHistory] = useState<ClientComparison[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [view, setView] = useState<"tariffs" | "users" | "history" | "notices">("tariffs");
  const [showTariffForm, setShowTariffForm] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [filterSegment, setFilterSegment] = useState<string>("all");
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  type PendingConfirm =
    | { action: 'toggleAdmin'; id: string; current: boolean }
    | { action: 'deactivate'; id: string; email: string }
    | { action: 'deleteTariff'; id: string };
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), type === 'success' ? 3000 : 5000);
  };

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

    const fetchNotices = async () => {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) console.error('Error loading notices:', error);
      else if (data) setNotices(data as Notice[]);
    };
    fetchNotices();

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
    if (error) { showMsg('error', "Error al actualizar usuario: " + error.message); return; }
    setProfiles(profiles.map(p => p.id === id ? { ...p, is_approved: nextApproved, is_blocked: !nextApproved } : p));
  };

  const toggleAdmin = async (id: string, current: boolean) => {
    setPendingConfirm(null);
    const { error } = await supabase
      .from("profiles")
      .update({ is_admin: !current, is_approved: true, is_blocked: false })
      .eq("id", id);
    if (error) { showMsg('error', "Error al actualizar permisos: " + error.message); return; }
    setProfiles(profiles.map(p => p.id === id ? { ...p, is_admin: !current, is_approved: true, is_blocked: false } : p));
  };

  const deactivateUser = async (id: string) => {
    setPendingConfirm(null);
    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: false, is_blocked: true })
      .eq("id", id);
    if (error) { showMsg('error', "Error al dar de baja el acceso: " + error.message); return; }
    setProfiles(profiles.map(p => p.id === id ? { ...p, is_approved: false, is_blocked: true } : p));
    showMsg('success', "Acceso dado de baja. El historial se conserva para Admin.");
  };

  const deleteTariff = async (id: string) => {
    setPendingConfirm(null);
    const { error } = await supabase.from("tariffs").delete().eq("id", id);
    if (error) {
      showMsg('error', "Error al borrar: " + error.message);
    } else {
      showMsg('success', "Tarifa eliminada");
      void refreshStore();
    }
  };

  const closeForm = () => { setShowTariffForm(false); setEditingTariff(null); };

  const filteredHistory = history.filter(item => {
    const cd = item.calculation_data as Record<string, unknown>;
    const tariffMatch = !historyFilterTariff || item.target_tariff === historyFilterTariff || cd?.best_tariff === historyFilterTariff;
    const sector = toSectorFilter(item.target_segment || cd?.segment);
    const segmentMatch = !historyFilterSegment || sector === historyFilterSegment;
    return tariffMatch && segmentMatch;
  });

  const uniqueHistoryTariffs = Array.from(new Set(history.map(item => {
    const cd = item.calculation_data as Record<string, unknown>;
    return item.target_tariff || (cd?.best_tariff as string);
  }).filter(Boolean)));
  const uniqueHistorySegments = Array.from(new Set(history.map(item => {
    const cd = item.calculation_data as Record<string, unknown>;
    return toSectorFilter(item.target_segment || cd?.segment);
  }).filter(Boolean)));

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2 text-[#002855]"><Shield className="text-orange-500" size={22} /> Panel de Control</h2>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setView("tariffs")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === "tariffs"  ? "bg-white shadow-sm text-blue-900" : "text-slate-500"}`}>Tarifas</button>
          <button onClick={() => setView("history")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === "history"  ? "bg-white shadow-sm text-blue-900" : "text-slate-500"}`}>Historial</button>
          <button onClick={() => setView("users")}   className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === "users"    ? "bg-white shadow-sm text-blue-900" : "text-slate-500"}`}>Usuarios</button>
          <button onClick={() => setView("notices")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === "notices"  ? "bg-white shadow-sm text-blue-900" : "text-slate-500"}`}>
            <Bell size={14} />Avisos
            {notices.filter(n => n.is_active).length > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {notices.filter(n => n.is_active).length}
              </span>
            )}
          </button>
        </div>
      </div>
      {actionMsg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-bold text-center animate-in fade-in duration-300 ${actionMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {actionMsg.type === 'success' ? '✓' : '✗'} {actionMsg.text}
        </div>
      )}

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
                    seg.id === 'pyme20one' ? 'bg-amber-600' :
                    (seg.id === 'pyme30' || seg.id === 'pyme61') ? 'bg-purple-600' :
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
              {pendingConfirm?.action === 'deleteTariff' && pendingConfirm.id === t.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-bold">¿Borrar?</span>
                  <button onClick={() => deleteTariff(t.id)} className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600">Sí</button>
                  <button onClick={() => setPendingConfirm(null)} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200">No</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingTariff(t)} className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50" title="Editar tarifa"><Pencil size={16} /></button>
                  <button onClick={() => setPendingConfirm({ action: 'deleteTariff', id: t.id })} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50" title="Borrar tarifa"><Trash2 size={16} /></button>
                </div>
              )}
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
                            {toSectorFilter(item.target_segment || cd?.segment) || "Otro"}
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

      {view === "notices" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              {notices.filter(n => n.is_active).length} activo{notices.filter(n => n.is_active).length !== 1 ? 's' : ''}
              {notices.filter(n => !n.is_active).length > 0 && ` · ${notices.filter(n => !n.is_active).length} archivado${notices.filter(n => !n.is_active).length !== 1 ? 's' : ''}`}
            </p>
            <button
              onClick={() => setShowNoticeForm(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-sm flex items-center gap-2"
            >
              <Plus size={16} /> Nuevo Aviso
            </button>
          </div>

          {notices.length === 0 && (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl">
              <Bell size={36} className="mx-auto mb-2 opacity-20" />
              <p className="font-medium">Aún no hay avisos publicados</p>
            </div>
          )}

          <div className="space-y-3">
            {notices.map(notice => {
              const NOTICE_TYPE_CFG = {
                tarifa:   { label: 'Tarifa',   Icon: Zap,      badgeCls: 'bg-orange-100 text-orange-700', borderCls: 'border-l-orange-400' },
                servicio: { label: 'Servicio', Icon: Wrench,   badgeCls: 'bg-blue-100 text-blue-700',     borderCls: 'border-l-blue-400'   },
                noticia:  { label: 'Noticia',  Icon: Newspaper, badgeCls: 'bg-green-100 text-green-700',  borderCls: 'border-l-green-400'  },
              } as const;
              const cfg = NOTICE_TYPE_CFG[notice.type];
              const Icon = cfg.Icon;
              return (
                <div
                  key={notice.id}
                  className={`bg-white border border-slate-200 rounded-xl p-4 border-l-4 ${cfg.borderCls} flex items-start justify-between gap-4 ${!notice.is_active ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${cfg.badgeCls}`}>
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${cfg.badgeCls}`}>{cfg.label}</span>
                        {notice.is_highlighted && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-yellow-100 text-yellow-700 flex items-center gap-1">
                            <Star size={9} fill="currentColor" /> Relevante
                          </span>
                        )}
                        {!notice.is_active && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-200 text-slate-500 flex items-center gap-1">
                            <Archive size={9} /> Archivado
                          </span>
                        )}
                        {notice.effective_date && (
                          <span className="text-[10px] text-slate-400">· {notice.effective_date}</span>
                        )}
                        {notice.expires_at && (
                          <span className="text-[10px] text-slate-400">→ {notice.expires_at}</span>
                        )}
                      </div>
                      <p className="font-bold text-slate-800 text-sm">{notice.title}</p>
                      {notice.body && <p className="text-xs text-slate-500 mt-0.5 truncate">{notice.body}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditingNotice(notice)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const { error } = await supabase.from('notices').update({ is_active: !notice.is_active }).eq('id', notice.id);
                        if (!error) setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, is_active: !notice.is_active } : n));
                        else showMsg('error', 'Error al actualizar aviso: ' + error.message);
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${notice.is_active ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                      title={notice.is_active ? 'Archivar' : 'Restaurar'}
                    >
                      {notice.is_active ? <Archive size={15} /> : <RotateCcw size={15} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {(showNoticeForm || editingNotice) && (
            <NoticeForm
              notice={editingNotice ?? undefined}
              onClose={() => { setShowNoticeForm(false); setEditingNotice(null); }}
              onSaved={(saved) => {
                setNotices(prev => {
                  const idx = prev.findIndex(n => n.id === saved.id);
                  return idx >= 0 ? prev.map(n => n.id === saved.id ? saved : n) : [saved, ...prev];
                });
                setShowNoticeForm(false);
                setEditingNotice(null);
                showMsg('success', editingNotice ? 'Aviso actualizado' : 'Aviso publicado');
              }}
            />
          )}
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
                {pendingConfirm?.action === 'toggleAdmin' && pendingConfirm.id === p.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-700 font-bold">{pendingConfirm.current ? "¿Quitar admin?" : "¿Hacer admin?"}</span>
                    <button onClick={() => toggleAdmin(p.id, pendingConfirm.current)} className="px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700">Sí</button>
                    <button onClick={() => setPendingConfirm(null)} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200">No</button>
                  </div>
                ) : pendingConfirm?.action === 'deactivate' && pendingConfirm.id === p.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-bold">¿Dar de baja?</span>
                    <button onClick={() => deactivateUser(p.id)} className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600">Sí</button>
                    <button onClick={() => setPendingConfirm(null)} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200">No</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPendingConfirm({ action: 'toggleAdmin', id: p.id, current: p.is_admin })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${p.is_admin ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-500 hover:bg-purple-50 hover:text-purple-700"}`}
                      title={p.is_admin ? "Quitar admin" : "Hacer admin"}
                    >
                      {p.is_admin ? "Admin ✓" : "Hacer admin"}
                    </button>
                    <button
                      onClick={() => setPendingConfirm({ action: 'deactivate', id: p.id, email: p.email })}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Dar de baja acceso"
                    >
                      <UserX size={16} />
                    </button>
                  </div>
                )}
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

function NoticeForm({ notice, onClose, onSaved }: { notice?: Notice; onClose: () => void; onSaved: (n: Notice) => void }) {
  const isEdit = !!notice;
  const [form, setForm] = useState({
    type:           notice?.type           ?? 'tarifa' as 'tarifa' | 'servicio' | 'noticia',
    title:          notice?.title          ?? '',
    body:           notice?.body           ?? '',
    effective_date: notice?.effective_date ?? '',
    expires_at:     notice?.expires_at     ?? '',
    is_highlighted: notice?.is_highlighted ?? false,
    is_active:      notice?.is_active      ?? true,
  });
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) {
      setFormMsg({ type: 'error', text: 'El título es obligatorio.' });
      return;
    }
    setSaving(true);
    const payload = {
      type:           form.type,
      title:          form.title.trim(),
      body:           form.body.trim(),
      effective_date: form.effective_date || null,
      expires_at:     form.expires_at     || null,
      is_highlighted: form.type === 'noticia' ? form.is_highlighted : false,
      is_active:      form.is_active,
    };

    if (isEdit) {
      const { data, error } = await supabase.from('notices').update(payload).eq('id', notice!.id).select().single();
      setSaving(false);
      if (error) { setFormMsg({ type: 'error', text: 'Error al guardar: ' + error.message }); return; }
      onSaved(data as Notice);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('notices').insert([{ ...payload, created_by: user?.id ?? null }]).select().single();
      setSaving(false);
      if (error) { setFormMsg({ type: 'error', text: 'Error al crear: ' + error.message }); return; }
      onSaved(data as Notice);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#002855]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#002855]">{isEdit ? 'Editar Aviso' : 'Nuevo Aviso'}</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X /></button>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-400">Tipo</label>
          <div className="flex gap-2 mt-1">
            {(['tarifa', 'servicio', 'noticia'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, type: t })}
                className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${form.type === t ? 'border-[#002855] bg-[#002855] text-white' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                {t === 'tarifa' ? '⚡ Tarifa' : t === 'servicio' ? '🔧 Servicio' : '📰 Noticia'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="nf-title" className="text-xs font-bold text-slate-400">Título</label>
          <input
            id="nf-title"
            className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm"
            placeholder="Ej: Actualización de precios Plan Fijo Luz"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="nf-body" className="text-xs font-bold text-slate-400">Descripción</label>
          <textarea
            id="nf-body"
            rows={3}
            className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm resize-none"
            placeholder="Detalle del aviso, cambio o noticia..."
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="nf-effdate" className="text-xs font-bold text-slate-400">
              {form.type === 'tarifa' ? 'Vigente desde' : 'Fecha de vigencia'}
            </label>
            <input
              id="nf-effdate"
              type="date"
              className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm"
              value={form.effective_date}
              onChange={e => setForm({ ...form, effective_date: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="nf-expires" className="text-xs font-bold text-slate-400">Caduca el</label>
            <input
              id="nf-expires"
              type="date"
              className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm"
              value={form.expires_at}
              onChange={e => setForm({ ...form, expires_at: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          {form.type === 'noticia' && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-yellow-500"
                checked={form.is_highlighted}
                onChange={e => setForm({ ...form, is_highlighted: e.target.checked })}
              />
              <span className="text-sm font-semibold text-yellow-700 flex items-center gap-1">
                <Star size={14} fill="currentColor" /> Marcar como relevante
              </span>
            </label>
          )}
          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-slate-600"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
              />
              <span className="text-sm font-semibold text-slate-600">Activo (visible)</span>
            </label>
          )}
        </div>

        {formMsg && (
          <div className={`px-4 py-3 rounded-xl text-sm font-bold text-center ${formMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {formMsg.type === 'success' ? '✓' : '✗'} {formMsg.text}
          </div>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full bg-[#002855] text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg disabled:opacity-60"
        >
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Publicar aviso'}
        </button>
      </div>
    </div>
  );
}

function defaultTypeForSegment(segId: string): string {
  return (segId === 'pyme30' || segId === 'pyme61') ? 'hex' : 'uni';
}

function TariffForm({ segments, onClose, tariff }: { segments: Segment[]; onClose: () => void; tariff?: Tariff }) {
  const isEdit = !!tariff;
  const initialSegId = tariff?.segment_id ?? segments[0]?.id ?? "";
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    segment_id: initialSegId,
    name: tariff?.name ?? "",
    type: tariff?.type ?? defaultTypeForSegment(initialSegId),
    pot_unit: tariff?.pot_unit ?? "dia",
    r_pot: tariff ? [...tariff.r_pot.map(v => v === 0 ? "" : String(v)), ...Array(6).fill("")].slice(0, 6) : ["", "", "", "", "", ""],
    r_en:  tariff ? [...tariff.r_en.map(v => v === 0 ? "" : String(v)),  ...Array(6).fill("")].slice(0, 6) : ["", "", "", "", "", ""],
    sva: String(tariff?.sva ?? "0"),
    requires_auth: tariff?.requires_auth ?? false,
  });

  const save = async () => {
    setSaving(true);
    setFormMsg(null);
    const cleanNum = (v: string | number) => {
      if (typeof v === "number") return v;
      const s = String(v || "0").replace(/[^\d,.+-]/g, "").replace(",", ".");
      const res = parseFloat(s);
      return isNaN(res) ? 0 : res;
    };

    try {
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
        setFormMsg({ type: 'error', text: "Error al guardar: " + error.message });
      } else {
        setFormMsg({ type: 'success', text: isEdit ? "Cambios guardados correctamente" : "Tarifa creada correctamente" });
        setTimeout(() => { onClose(); void useAppStore.getState().refresh(); }, 1200);
      }
    } catch (err) {
      setFormMsg({ type: 'error', text: "Error inesperado: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setSaving(false);
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
            <select id="tf-segment" title="Segmento" className="w-full mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm" value={form.segment_id} onChange={e => {
              const newSegId = e.target.value;
              setForm({ ...form, segment_id: newSegId, ...(!isEdit && { type: defaultTypeForSegment(newSegId) }) });
            }}>
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
        {formMsg && (
          <div className={`px-4 py-3 rounded-xl text-sm font-bold text-center animate-in fade-in duration-300 ${formMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {formMsg.type === 'success' ? '✓' : '✗'} {formMsg.text}
          </div>
        )}
        <button type="button" onClick={save} disabled={saving || formMsg?.type === 'success'} className="w-full bg-[#002855] text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition-all shadow-lg disabled:opacity-60">
          {saving ? 'Guardando...' : isEdit ? "Guardar cambios" : "Crear tarifa"}
        </button>
      </div>
    </div>
  );
}
