import { useEffect, useState, useCallback } from "react";
import { api, withTimeout } from "../lib/api";

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    withTimeout(api.auth.me(), 10_000)
      .then(({ authenticated }) => { if (!cancelled) setAuthenticated(authenticated); })
      .catch(() => { if (!cancelled) setAuthenticated(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (password: string) => {
    try {
      const { error } = await withTimeout(api.auth.login(password));
      if (error) return error.message;
      setAuthenticated(true);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Error de conexión";
    }
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    setAuthenticated(false);
  }, []);

  return { authenticated, loading, login, logout };
}
