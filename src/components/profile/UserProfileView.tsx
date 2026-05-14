import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Users } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "../../types";

interface UserProfileViewProps {
  user: User;
  profile: Profile | null;
  isAdmin: boolean;
}

export function UserProfileView({ user, profile, isAdmin }: UserProfileViewProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: ""
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setFormData({
      full_name: profile?.full_name || "",
      phone: profile?.phone || "",
      email: profile?.email || user?.email || ""
    });
  }, [profile, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setMessage("Error: no hay sesión activa.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const cleanStr = (s: string) => s.replace(/[<>"{}$%]/g, "").trim();

      const payload = {
        id: user.id,
        full_name: cleanStr(formData.full_name),
        phone: cleanStr(formData.phone),
        email: cleanStr(formData.email) || user.email
      };

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (error) {
        console.error("Update error details:", error);
        throw error;
      }

      setMessage("✓ Perfil actualizado correctamente.");
    } catch (err: unknown) {
      console.error("Profile save error:", err);
      setMessage("Error al guardar: " + (err instanceof Error ? err.message : "Error de red o permisos RLS"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
          <Users size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-[#002855]">Mi Perfil</h2>
          <p className="text-slate-500">Configura tus datos para que aparezcan en las comparativas</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1">
            <label className="block text-sm font-bold text-slate-700 mb-2">Nombre Completo</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              placeholder="Ej: Juan Pérez"
              value={formData.full_name}
              onChange={e => setFormData({...formData, full_name: e.target.value})}
              required
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-bold text-slate-700 mb-2">Teléfono de contacto</label>
            <input
              type="tel"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              placeholder="600 000 000"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2">Email Profesional</label>
            <input
              type="email"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              placeholder="tu@email.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium ${message.includes('Error') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
            {message}
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Rol actual: <span className="font-bold text-blue-600 uppercase">{isAdmin ? "Administrador" : "Comercial"}</span>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-[#002855] text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg flex items-center gap-2"
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
