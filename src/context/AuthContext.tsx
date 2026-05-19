import { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole, BranchId } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (employeeId: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  activeBranch: BranchId;
  setActiveBranch: (branch: BranchId) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('employee_id, name, role, branch_id')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return {
    id: userId,
    employeeId: data.employee_id as string,
    name: data.name as string,
    role: data.role as UserRole,
    branchId: data.branch_id as BranchId,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBranch, setActiveBranch] = useState<BranchId>('YWG');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setActiveBranch('YWG');
        setLoading(false);
        return;
      }
      const profile = await fetchProfile(session.user.id);
      if (profile) {
        setUser(profile);
        setActiveBranch(profile.branchId === 'ALL' ? 'ALL' : profile.branchId);
      } else if (event === 'INITIAL_SESSION') {
        setUser(null);
        setActiveBranch('YWG');
      }
      // SIGNED_IN with no profile: leave user alone — login() already set it
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = async (employeeId: string, password: string): Promise<boolean> => {
    const email = `${employeeId.toLowerCase()}@fleet-garage.internal`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return false;
    const profile = await fetchProfile(data.user.id);
    if (profile) {
      setUser(profile);
      setActiveBranch(profile.branchId === 'ALL' ? 'ALL' : profile.branchId);
    }
    return !!profile;
  };

  const logout = async () => {
    setUser(null);
    setActiveBranch('YWG');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, activeBranch, setActiveBranch }}>
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
