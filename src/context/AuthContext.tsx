import { createContext, useContext, useState } from 'react';
import type { User } from '../types';
import { USERS } from '../data/mock';

interface AuthContextValue {
  user: User | null;
  login: (employeeId: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (employeeId: string, password: string): boolean => {
    const found = USERS.find(
      u => u.employeeId.toLowerCase() === employeeId.toLowerCase() && u.password === password
    );
    if (found) { setUser(found); return true; }
    return false;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
