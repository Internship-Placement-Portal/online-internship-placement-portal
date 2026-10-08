import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAccessToken, setSessionLostHandler } from '../api/http.js';
import { loginApi, logoutApi, refreshSession } from '../api/auth.js';

const AuthContext = createContext(null);

export const ROLE_HOME = { student: '/student', recruiter: '/recruiter', admin: '/admin' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  // On first load, try to resume the session from the httpOnly refresh cookie.
  useEffect(() => {
    let active = true;
    setSessionLostHandler(clear);
    refreshSession()
      .then((data) => active && setUser(data.user))
      .catch(() => active && clear())
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [clear]);

  const login = useCallback(async (email, password) => {
    const data = await loginApi({ email, password });
    setAccessToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
