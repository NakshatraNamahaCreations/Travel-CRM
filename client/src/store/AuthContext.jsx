import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/auth.js';
import { TOKEN_KEY } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On boot, if we have a token, fetch the current user.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (credentials) => {
    const { user: u, token } = await authApi.login(credentials);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    hasRole: (...roles) => (user ? roles.includes(user.role) : false),
    // Fine-grained permission check, e.g. can('payments.cancel').
    // Falls back to true when the server didn't send a permission list (older sessions).
    can: (key) => (user?.permissions ? user.permissions.includes(key) : true),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
