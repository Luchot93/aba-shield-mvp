/**
 * useAssemblyToken
 *
 * Fetches a short-lived AssemblyAI realtime token from the local dev-server proxy
 * at POST /api/assembly-token. The real API key never leaves the server — only
 * the temporary token (8-minute TTL) is returned to the browser.
 *
 * Usage:
 *   const { token, loading, error, refresh } = useAssemblyToken();
 */
import { useState, useCallback } from 'react';

export function useAssemblyToken() {
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/assembly-token', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const { token: t } = await res.json();
      setToken(t);
      return t;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { token, loading, error, refresh };
}
