import { useState, useEffect, useCallback } from 'react';
import { fetchMe, logout, type AuthUser } from '../lib/auth.js';

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => prev ? { ...prev, ...patch } : prev);
  }, []);

  return { user, loading, logout: handleLogout, updateUser };
}
