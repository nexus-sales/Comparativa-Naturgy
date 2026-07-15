import { useState, useEffect } from 'react';
import { supabase, withTimeout } from '../../lib/supabase';
import { Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

export function ResetPasswordView({ onComplete }: Props) {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // detectSessionInUrl: false in supabase.ts — process the recovery hash manually.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    if (type === 'recovery' && accessToken && refreshToken) {
      withTimeout(supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }))
        .then(({ error: err }) => {
          if (err) setError('El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.');
          else setReady(true);
        })
        .catch(() => setError('Tiempo de espera agotado al validar el enlace. Recarga la página e inténtalo de nuevo.'));
    } else {
      setError('Enlace incompleto. Asegúrate de haber abierto el enlace completo del email.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await withTimeout(supabase.auth.updateUser({ password }));
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      await withTimeout(supabase.auth.signOut({ scope: 'local' }));
      setDone(true);
      setTimeout(onComplete, 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar la contraseña');
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full mx-auto p-10 border border-slate-200 rounded-3xl bg-white shadow-xl text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle size={52} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-[#002855]">Contraseña actualizada</h2>
          <p className="text-slate-500 text-sm mt-2">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-[440px] w-full mx-auto p-8 border border-slate-200 rounded-3xl bg-white shadow-xl shadow-slate-200/50">
        <div className="text-center mb-6">
          <svg height="40" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 220 54" className="mb-4 mx-auto">
            <path fill="#E57200" fillRule="evenodd" d="M218.697 8.68827c.309-.27302.584-.37661.788-.37661.309 0 .515.23913.515.68352 0 2.97712-14.877 20.28492-19.23 24.35502-3.563 3.3518-6.102 5.505-7.575 5.505-.48 0-.789-.2392-.789-.8201 0-2.2228 3.359-8.1073 3.359-8.1073v-.1695l-6.203 5.4711c-1.44 1.2673-3.187 1.8473-4.763 1.8473-2.881 0-5.382-2.2578-5.382-7.4558V1.74463C179.417.581864 180.204 0 181.199 0c.581 0 1.267.239135 1.952.649635 4.356 2.771845 10.01 8.004755 14.363 15.153665.686 1.1289.959 2.2577.959 3.3866 0 3.6248-2.913 7.2835-5.929 10.5684v.2053l26.153-21.27533Z" clipRule="evenodd"/>
            <path fill="#002855" fillRule="evenodd" d="M49.1796 35.049v3.5251c0 .4937-.2396.698-.9518.8394-1.0828.213-2.446.3437-3.7539.3437-3.3424 0-4.4378-.912-4.4378-2.4814 0-.6284.1892-1.1057.5481-1.46.5298-.5257 1.4855-.7668 2.9214-.7668h5.674Zm4.8241 8.5479c1.1924-.4773 1.6125-1.2112 1.6125-2.6508v-9.6952c0-3.8329-.6753-6.0578-2.3072-7.6078-1.7474-1.6623-4.5941-2.4165-9.1863-2.4165-2.4819 0-4.7357.1646-6.3366.4802-1.6038.3156-2.1229 1.0543-2.1229 2.5298 0 .9014.0786 2.0283.1824 2.7147.0592.3902.2746.5209.7878.4492 2.51-.3572 4.7581-.5586 6.8509-.5586 2.7012 0 4.0857.1704 4.8667.7591.6074.455.8286 1.1859.8286 2.3768v.7716c-1.9735-.2546-4.2079-.4018-5.8001-.4018-3.7519 0-6.4055.7194-8.0132 2.2297-1.2507 1.1753-1.9279 2.8938-1.9279 4.9492 0 4.594 3.292 7.5459 10.8551 7.5459 3.8548 0 7.5242-.6022 9.7102-1.4755ZM29.0762 13.9823v27.487c0 1.0601-.2387 1.8018-.7248 2.2829-.6752.6681-1.8541.9304-3.4938.9304-.814 0-1.8376-.1026-2.5934-.3272-.6181-.1801-.9761-.4773-1.3749-1.0088-4.0304-5.3762-9.4715-12.7158-14.14903-19.0147v19.3187c0 .7019-.21345.9323-.97412.9323H0V17.0968c0-1.063.23868-1.8036.724771-2.2848.678199-.669 1.854129-.9304 3.493839-.9304.81598 0 1.83764.1036 2.5954.3262.65492.1946.98092.4822 1.37581 1.0098C11.7535 20.0004 17.2247 27.3932 22.334 34.2933V14.9059c0-.6758.2891-.9236.9654-.9236h5.7768Z" clipRule="evenodd"/>
          </svg>
          <h2 className="text-[#002855] text-2xl font-bold">Nueva contraseña</h2>
          <p className="text-slate-500 text-sm mt-1">Introduce y confirma tu nueva contraseña de acceso</p>
        </div>

        {!ready && !error && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        )}

        {ready && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nueva contraseña (mín. 8 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="p-3 rounded-xl border border-slate-200 w-full pr-12 outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600 transition-colors flex items-center p-2"
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirmar contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="p-3 rounded-xl border border-slate-200 w-full outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-medium"
              aria-label="Confirmar contraseña"
            />
            <button
              type="submit"
              disabled={loading}
              className="p-4 bg-orange-500 text-white border-none rounded-2xl cursor-pointer font-bold text-base hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}

        {error && (
          <div className="flex items-start gap-3 text-red-700 mt-4 text-sm font-medium bg-red-50 p-4 rounded-xl border border-red-100">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
