import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Bell, Zap, Wrench, Newspaper, Star } from "lucide-react";
import type { Notice } from "../../types";

type TypeFilter = 'all' | 'tarifa' | 'servicio' | 'noticia';

const TYPE_CONFIG = {
  tarifa:   { label: 'Tarifa',   Icon: Zap,       borderCls: 'border-l-orange-400', badgeCls: 'bg-orange-100 text-orange-700' },
  servicio: { label: 'Servicio', Icon: Wrench,     borderCls: 'border-l-blue-400',   badgeCls: 'bg-blue-100 text-blue-700'   },
  noticia:  { label: 'Noticia',  Icon: Newspaper,  borderCls: 'border-l-green-400',  badgeCls: 'bg-green-100 text-green-700' },
} as const;

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function getDateBadge(notice: Notice): { label: string; cls: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (notice.expires_at) {
    const exp = new Date(notice.expires_at + 'T00:00:00');
    if (exp < today) return { label: 'Caducada', cls: 'bg-slate-100 text-slate-500' };
    const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
    if (daysLeft <= 14) return { label: `Caduca ${fmtDate(notice.expires_at)} · ${daysLeft}d`, cls: 'bg-red-100 text-red-700' };
    return { label: `Vigente · hasta ${fmtDate(notice.expires_at)}`, cls: 'bg-green-100 text-green-700' };
  }

  if (notice.effective_date) {
    const eff = new Date(notice.effective_date + 'T00:00:00');
    if (eff > today) return { label: `Próxima · ${fmtDate(notice.effective_date)}`, cls: 'bg-orange-100 text-orange-700' };
    return { label: `Vigente desde ${fmtDate(notice.effective_date)}`, cls: 'bg-green-100 text-green-700' };
  }

  return null;
}

function sortNotices(notices: Notice[]): Notice[] {
  const priority = (n: Notice) => {
    if (n.is_highlighted) return 0;
    if (n.type === 'tarifa')   return 1;
    if (n.type === 'servicio') return 2;
    return 3;
  };
  return [...notices].sort((a, b) => {
    const pd = priority(a) - priority(b);
    if (pd !== 0) return pd;
    const aDate = a.effective_date ?? a.created_at.split('T')[0];
    const bDate = b.effective_date ?? b.created_at.split('T')[0];
    return bDate.localeCompare(aDate);
  });
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)     return 'Ahora mismo';
  if (diff < 3600)   return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `Hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`;
  return fmtDate(dateStr.split('T')[0]);
}

export function NoticesView() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TypeFilter>('all');

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('notices')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setNotices(data as Notice[]);
      } catch (err) {
        console.error('Error cargando avisos:', err);
        setNotices([]);
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, []);

  const sorted   = sortNotices(notices);
  const filtered = filter === 'all' ? sorted : sorted.filter(n => n.type === filter);
  const counts   = {
    tarifa:   notices.filter(n => n.type === 'tarifa').length,
    servicio: notices.filter(n => n.type === 'servicio').length,
    noticia:  notices.filter(n => n.type === 'noticia').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-pulse text-slate-400 font-bold">Cargando avisos...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
              <Bell className="text-orange-500" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#002855]">Avisos y Novedades</h2>
              <p className="text-xs text-slate-400">
                {notices.length} aviso{notices.length !== 1 ? 's' : ''} activo{notices.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
            <FilterBtn active={filter === 'all'}      onClick={() => setFilter('all')}      label="Todos"    count={notices.length} />
            <FilterBtn active={filter === 'tarifa'}   onClick={() => setFilter('tarifa')}   label="Tarifas"  count={counts.tarifa}   color="orange" />
            <FilterBtn active={filter === 'servicio'} onClick={() => setFilter('servicio')} label="Servicio" count={counts.servicio}  color="blue"   />
            <FilterBtn active={filter === 'noticia'}  onClick={() => setFilter('noticia')}  label="Noticias" count={counts.noticia}   color="green"  />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Bell size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No hay avisos en esta categoría</p>
            <p className="text-xs mt-1">El administrador publicará novedades aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(notice => <NoticeCard key={notice.id} notice={notice} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count: number; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${active ? 'bg-white shadow-sm text-blue-900' : 'text-slate-500 hover:text-slate-700'}`}
    >
      {label}
      {count > 0 && (
        <span className={`min-w-[1rem] h-4 px-1 rounded-full text-[10px] flex items-center justify-center font-black ${active ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function NoticeCard({ notice }: { notice: Notice }) {
  const cfg       = TYPE_CONFIG[notice.type];
  const dateBadge = getDateBadge(notice);
  const Icon      = cfg.Icon;

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl p-5 border-l-4 ${cfg.borderCls} hover:shadow-sm transition-all`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${cfg.badgeCls}`}>
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${cfg.badgeCls}`}>
                {cfg.label}
              </span>
              {notice.is_highlighted && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-yellow-100 text-yellow-700 flex items-center gap-1">
                  <Star size={10} fill="currentColor" /> Relevante
                </span>
              )}
              {dateBadge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${dateBadge.cls}`}>
                  {dateBadge.label}
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-800 text-sm leading-snug">{notice.title}</h3>
            {notice.body && (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed whitespace-pre-wrap">{notice.body}</p>
            )}
          </div>
        </div>
        <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0 pt-1">
          {timeAgo(notice.created_at)}
        </span>
      </div>
    </div>
  );
}
