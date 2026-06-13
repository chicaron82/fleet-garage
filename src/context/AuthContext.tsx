import { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole, BranchId } from '../types';
import { supabase } from '../lib/supabase';
import { cacheProfile, getCachedProfile, clearProfileCache, restoreOnNullProfile } from '../lib/profileCache';

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
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void supabase.auth.startAutoRefresh();
        void supabase.auth.refreshSession(); // proactive refresh — token may have expired while idle
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        setLoading(false);
        return;
      }
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
        cacheProfile(profile); // for an offline reload — see profileCache
      } else if (event === 'INITIAL_SESSION') {
        // Token restored but the profile read failed. If we're genuinely offline,
        // ride the cached profile so a logged-in VSA isn't locked out on a
        // dead-wifi reload; online → require login (profile may be gone).
        const restored = restoreOnNullProfile(event, navigator.onLine, getCachedProfile(session.user.id));
        if (restored) {
          setUser(restored);
          setActiveBranch(restored.branchId === 'ALL' ? 'ALL' : restored.branchId);
        } else {
          setUser(null);
          setActiveBranch('YWG');
        }
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
      cacheProfile(profile); // seed the offline-reload cache on a fresh login too
    }
    return !!profile;
  };

  const logout = async () => {
    // First sweep — synchronous, completes before any async op. Prevents hard-refresh
    // race where INITIAL_SESSION finds a stale token and auto-logs back in.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    }
    clearProfileCache(); // drop the offline-reload profile too — no riding it after logout
    setUser(null);
    setActiveBranch('YWG');
    await supabase.auth.signOut();
    // Second sweep — catches anything re-written by a concurrent token refresh
    // racing signOut (the lock no-op needed for Strict Mode allows this).
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    }
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
