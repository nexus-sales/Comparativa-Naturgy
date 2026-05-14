import React from "react";

export function KPICard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
      <div className="bg-slate-50 p-3 rounded-2xl">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">{title}</p>
        <p className="text-xl font-black text-[#002855] leading-none">{value}</p>
      </div>
    </div>
  );
}
