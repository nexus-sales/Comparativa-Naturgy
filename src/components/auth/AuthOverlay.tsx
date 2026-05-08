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
    <div className="auth-container" style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff' }}>
      <h2 style={{ textAlign: 'center', color: '#002855' }}>
        {isSignUp ? 'Crear Cuenta' : 'Acceder al Comparador'}
      </h2>
      
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
          variant="link" 
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
      </div>
    </div>
  );
};
