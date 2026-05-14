import React from "react";

export function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap
        ${active 
          ? "bg-white text-[#002855] shadow-md scale-105" 
          : "text-blue-100 hover:bg-white/10 hover:text-white"
        }
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
