import { createContext, useContext, useState } from 'react';
import type { User, BranchId } from '../types';
import { USERS } from '../data/mock';

const AUTH_STORAGE_KEY = 'fg_auth_userId';

interface AuthContextValue {
  user: User | null;
  login: (employeeId: string, password: string) => boolean;
  logout: () => void;
  activeBranch: BranchId;
  setActiveBranch: (branch: BranchId) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedId = localStorage.getItem(AUTH_STORAGE_KEY);
      if (savedId) return USERS.find(u => u.id === savedId) ?? null;
    } catch { /* localStorage unavailable — fail silently */ }
    return null;
  });

  const [activeBranch, setActiveBranch] = useState<BranchId>(() => {
    try {
      const savedId = localStorage.getItem(AUTH_STORAGE_KEY);
      if (savedId) {
        const found = USERS.find(u => u.id === savedId);
        return found?.branchId ?? 'YWG';
      }
    } catch { /* localStorage unavailable */ }
    return 'YWG';
  });

  const login = (employeeId: string, password: string): boolean => {
    const found = USERS.find(
      u => u.employeeId.toLowerCase() === employeeId.toLowerCase() && u.password === password
    );
    if (found) {
      setUser(found);
      setActiveBranch(found.branchId === 'ALL' ? 'ALL' : found.branchId);
      localStorage.setItem(AUTH_STORAGE_KEY, found.id);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setActiveBranch('YWG');
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, activeBranch, setActiveBranch }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
