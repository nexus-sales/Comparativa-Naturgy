import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export const AuthStatus = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setError('Debes aceptar la política de privacidad y términos legales.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              accepted_terms: true,
            }
          }
        });
        if (error) throw error;
        setMessage('Registro casi completado. Revisa tu email para confirmar tu cuenta.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          if (error.message.includes('blocked')) {
            throw new Error('Tu cuenta ha sido suspendida. Contacta con el administrador.');
          }
          throw error;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Introduce tu email para recuperar la contraseña.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setMessage('Se ha enviado un enlace de recuperación a tu email.');
  };

  return (
    <div className="auth-container" style={{ maxWidth: '450px', margin: '40px auto', padding: '30px', border: '1px solid #ddd', borderRadius: '12px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <svg height="45" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 220 54" style={{ marginBottom: '15px' }}>
          <path fill="#E57200" fillRule="evenodd" d="M218.697 8.68827c.309-.27302.584-.37661.788-.37661.309 0 .515.23913.515.68352 0 2.97712-14.877 20.28492-19.23 24.35502-3.563 3.3518-6.102 5.505-7.575 5.505-.48 0-.789-.2392-.789-.8201 0-2.2228 3.359-8.1073 3.359-8.1073v-.1695l-6.203 5.4711c-1.44 1.2673-3.187 1.8473-4.763 1.8473-2.881 0-5.382-2.2578-5.382-7.4558V1.74463C179.417.581864 180.204 0 181.199 0c.581 0 1.267.239135 1.952.649635 4.356 2.771845 10.01 8.004755 14.363 15.153665.686 1.1289.959 2.2577.959 3.3866 0 3.6248-2.913 7.2835-5.929 10.5684v.2053l26.153-21.27533Z" clipRule="evenodd"/>
          <path fill="#002855" fillRule="evenodd" d="M49.1796 35.049v3.5251c0 .4937-.2396.698-.9518.8394-1.0828.213-2.446.3437-3.7539.3437-3.3424 0-4.4378-.912-4.4378-2.4814 0-.6284.1892-1.1057.5481-1.46.5298-.5257 1.4855-.7668 2.9214-.7668h5.674Zm4.8241 8.5479c1.1924-.4773 1.6125-1.2112 1.6125-2.6508v-9.6952c0-3.8329-.6753-6.0578-2.3072-7.6078-1.7474-1.6623-4.5941-2.4165-9.1863-2.4165-2.4819 0-4.7357.1646-6.3366.4802-1.6038.3156-2.1229 1.0543-2.1229 2.5298 0 .9014.0786 2.0283.1824 2.7147.0592.3902.2746.5209.7878.4492 2.51-.3572 4.7581-.5586 6.8509-.5586 2.7012 0 4.0857.1704 4.8667.7591.6074.455.8286 1.1859.8286 2.3768v.7716c-1.9735-.2546-4.2079-.4018-5.8001-.4018-3.7519 0-6.4055.7194-8.0132 2.2297-1.2507 1.1753-1.9279 2.8938-1.9279 4.9492 0 4.594 3.292 7.5459 10.8551 7.5459 3.8548 0 7.5242-.6022 9.7102-1.4755ZM111.66 31.1754c0-1.793.26-2.6092.829-3.2182.619-.6603 1.695-.9507 3.385-.9507.643 0 1.629.0639 2.714.1481.535.0417.711-.1239.8-.5547.112-.5364.21-1.5026.21-2.3101 0-1.2818-.375-1.9982-1.34-2.4116-.819-.3505-2.369-.6516-4.31-.6516-2.535 0-4.799.6061-6.375 2.0099-1.463 1.3022-2.349 3.2569-2.349 6.7335v13.9745c0 .4676.281.6409.659.6409h5.777v-13.41Zm-45.0147-9.4638v-6.7694h-5.2131c-.9343 0-1.2244.3766-1.2244 1.1957v20.6063c0 3.0507.6927 4.8301 1.9958 6.1042 1.4534 1.4242 3.5695 2.222 6.4268 2.222 2.1676 0 4.3215-.5102 5.9787-1.2277 1.2797-.5518 1.7299-1.0843 1.7299-1.9179 0-.3214-.0737-.6806-.1921-1.0824-.1649-.5625-.4919-1.5539-.7626-2.1551-.1223-.2721-.2464-.4037-.4832-.4037-.0815 0-.194.0232-.3619.0687-1.6863.4831-3.5627.8626-4.8308.8626-1.176 0-1.9036-.2284-2.3693-.7048-.5094-.5218-.6938-1.3225-.6938-2.6208v-8.4327h5.9651c.912 0 1.4088-.2294 1.6998-.7464.2756-.4841.392-1.2218.392-2.2636 0-.7735-.0815-1.7553-.1795-2.2422-.0718-.3612-.2581-.4928-.716-.4928h-7.1614Zm34.0777.0006h-5.2078c-.9343 0-1.2273.3795-1.2273 1.1957v11.9742c0 1.5442-.3357 2.5385-1.0149 3.2065-.7141.7068-1.8095 1.1125-3.293 1.1125-1.4845 0-2.5779-.4057-3.294-1.1125-.6792-.668-1.0149-1.6623-1.0149-3.2065V21.7122h-5.2034c-.9343 0-1.2283.3795-1.2283 1.1957v12.8088c0 2.8909.8441 5.015 2.3907 6.5447 1.8522 1.8298 4.7163 2.8096 8.3499 2.8096 3.6345 0 6.4967-.9798 8.3489-2.8096 1.5485-1.5297 2.3941-3.6538 2.3941-6.5447V21.7122Zm31.681 31.8224c4.446 0 7.398-.9904 9.298-2.9451 1.738-1.7873 2.516-4.379 2.516-7.757V32.3948c0-3.5735-1.019-6.1672-2.774-7.9621-2-2.0458-5.185-3.2076-8.551-3.2076-7.26 0-11.864 4.531-11.864 11.9394 0 6.9436 3.711 11.6024 10.303 11.6024 2.776 0 4.98-1.0378 6.449-2.676v.9885c0 1.6033-.273 2.707-1.033 3.4815-.914.9275-2.72 1.34-5.293 1.34-1.704 0-3.872-.215-5.717-.4773-.611-.0852-1.007.1549-1.114.8945-.092.6487-.144 1.6091-.144 2.2026 0 1.5171.451 2.19 2.177 2.5366 1.564.3137 3.783.4773 5.747.4773Zm5.377-21.2056v.6419c0 2.248-.464 3.9433-1.506 5.0044-.81.8229-1.986 1.2993-3.502 1.2993-3.624 0-5.123-2.4437-5.123-6.1101 0-4.1641 2.107-6.0694 5.115-6.0694 1.496 0 2.774.487 3.625 1.3186.913.8898 1.391 2.2132 1.391 3.9153ZM29.0762 13.9823v27.487c0 1.0601-.2387 1.8018-.7248 2.2829-.6752.6681-1.8541.9304-3.4938.9304-.814 0-1.8376-.1026-2.5934-.3272-.6181-.1801-.9761-.4773-1.3749-1.0088-4.0304-5.3762-9.4715-12.7158-14.14903-19.0147v19.3187c0 .7019-.21345.9323-.97412.9323H0V17.0968c0-1.063.23868-1.8036.724771-2.2848.678199-.669 1.854129-.9304 3.493839-.9304.81598 0 1.83764.1036 2.5954.3262.65492.1946.98092.4822 1.37581 1.0098C11.7535 20.0004 17.2247 27.3932 22.334 34.2933V14.9059c0-.6758.2891-.9236.9654-.9236h5.7768ZM152.332 47.4774c-.699-.0997-1.015.2933-1.106.9033-.078.5266-.151 1.5316-.151 2.2006 0 1.3932.394 2.1474 2.138 2.492 1.465.2905 3.783.4628 5.701.4628 4.112 0 6.945-1.0446 8.68-2.9006 1.778-1.9005 2.486-4.6307 2.486-8.4859V21.7137h-5.323c-.766 0-1.115.4153-1.115 1.1947v11.1319c0 1.8279-.344 3.0681-1.113 3.9036-.78.8481-1.996 1.2877-3.51 1.2877-1.363 0-2.363-.3796-3.005-1.0941-.693-.7745-.97-1.855-.97-3.6964V21.7137h-5.298c-.87 0-1.139.4927-1.139 1.1511v12.1949c0 3.4012.788 5.657 2.348 7.2545 1.52 1.5577 3.778 2.4533 6.755 2.4533 2.636 0 4.765-1.094 5.932-2.3401v.5945c0 1.5403-.21 2.6963-.891 3.498-.815.9575-2.339 1.4115-5.003 1.4115-1.736 0-3.789-.2226-5.416-.454Z" clipRule="evenodd"/>
        </svg>
        <h2 style={{ color: '#002855', margin: '0' }}>
          {isSignUp ? 'Crear Cuenta' : 'Acceder al Comparador'}
        </h2>
      </div>
      
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input
          type="email"
          placeholder="Email profesional"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          <label style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={acceptedTerms} 
              onChange={(e) => setAcceptedTerms(e.target.checked)} 
            />
            Acepto el tratamiento de mis datos según el <strong>RGPD</strong> y la 
            <strong> Política de Privacidad</strong>.
          </label>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '12px', background: '#f5821f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Cargando...' : isSignUp ? 'Registrarme' : 'Entrar'}
        </button>
      </form>

      {error && <div style={{ color: 'red', marginTop: '10px', fontSize: '13px' }}>{error}</div>}
      {message && <div style={{ color: 'green', marginTop: '10px', fontSize: '13px' }}>{message}</div>}

      <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px' }}>
        <button 
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          style={{ background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {isSignUp ? '¿Ya tienes cuenta? Entra aquí' : '¿Eres nuevo? Crea tu cuenta'}
        </button>
        {!isSignUp && (
          <div style={{ marginTop: '10px' }}>
            <button 
              onClick={handleResetPassword}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '12px' }}
            >
              He olvidado mi contraseña
            </button>
          </div>
        )}
      </div>

      <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid #eee' }} />

      <div style={{ fontSize: '11px', color: '#999', textAlign: 'center', lineHeight: '1.4' }}>
        <strong>Transparencia IA:</strong> Esta aplicación utiliza modelos de IA para el análisis de facturas. 
        Los cálculos son consultivos y basados en tarifas oficiales.
        <div style={{ marginTop: '8px', fontWeight: 'bold', color: '#666' }}>App de Cris Energy - Distribuidor Oficial</div>
      </div>
    </div>
  );
};
