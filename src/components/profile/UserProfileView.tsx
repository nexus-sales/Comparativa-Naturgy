import { useState } from "react";
import { Users } from "lucide-react";
import { useComercialSettings } from "../../hooks/useComercialSettings";

export function UserProfileView() {
  const { settings, save } = useComercialSettings();
  const [formData, setFormData] = useState(settings);
  const [message, setMessage] = useState("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanStr = (s: string) => s.replace(/[<>"{}$%]/g, "").trim();
    save({
      full_name: cleanStr(formData.full_name),
      phone: cleanStr(formData.phone),
      email: cleanStr(formData.email),
    });
    setMessage("✓ Datos guardados correctamente.");
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 p-4 sm:p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-blue-100 p-3 rounded-2xl text-blue-600">
          <Users size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-[#002855]">Datos del comercial</h2>
          <p className="text-slate-500">Aparecen en los informes PDF y Excel que generes</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="col-span-1">
            <label className="block text-sm font-bold text-slate-700 mb-2">Nombre Completo</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              placeholder="Ej: Juan Pérez"
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-bold text-slate-700 mb-2">Teléfono de contacto</label>
            <input
              type="tel"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              placeholder="600 000 000"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2">Email Profesional</label>
            <input
              type="email"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              placeholder="tu@email.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        {message && (
          <div className="p-4 rounded-xl text-sm font-medium bg-green-50 text-green-700 border border-green-100">
            {message}
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
          <button
            type="submit"
            className="bg-[#002855] text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg flex items-center gap-2"
          >
            Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
}
