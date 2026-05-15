import { useState, useEffect } from "react";
import { Download, X, Smartphone, Monitor } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      if (window.matchMedia("(display-mode: standalone)").matches) return;
      // Evitar que el navegador muestre el prompt automático
      e.preventDefault();
      // Guardar el evento para dispararlo más tarde
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Mostrar nuestro propio banner/leyenda
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Mostrar el prompt nativo
    await deferredPrompt.prompt();
    
    // Esperar a la elección del usuario
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // Limpiar el evento guardado
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] md:left-auto md:right-8 md:max-w-md animate-in fade-in slide-in-from-bottom-5">
      <div className="bg-[#002855] text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex items-start gap-4">
        <div className="bg-orange-500 p-3 rounded-xl shrink-0">
          <Download className="text-white" size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-lg leading-tight">¿Quieres instalar la App?</h3>
            <button 
              onClick={() => setShowBanner(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              title="Cerrar"
              aria-label="Cerrar aviso de instalación"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-blue-100 text-sm mt-1">
            Accede rápidamente y sin conexión a la comparativa de tarifas de Naturgy.
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleInstallClick}
              className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl font-semibold transition-all shadow-lg active:scale-95 flex items-center gap-2 text-sm"
            >
              Instalar ahora
            </button>
            <div className="hidden sm:flex items-center gap-3 text-blue-200">
              <Smartphone size={16} />
              <Monitor size={16} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
