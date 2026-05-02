import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface Preferences {
  darkMode: boolean;
  notifyNewFlags: boolean;
  notifyReleases: boolean;
}

interface PreferencesContextValue {
  prefs: Preferences;
  updatePref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  avatarBase64: string | null;
  setAvatarBase64: (val: string | null) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const DEFAULT_PREFS: Preferences = { darkMode: false, notifyNewFlags: true, notifyReleases: true };

function upsertRemote(userId: string, patch: { avatar?: string | null; prefs?: Preferences }) {
  const payload: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if ('avatar' in patch) payload.avatar = patch.avatar ?? null;
  if ('prefs' in patch) payload.prefs = patch.prefs;
  supabase.from('user_preferences').upsert(payload, { onConflict: 'user_id' }).then(() => {});
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [avatarBase64, setAvatarState] = useState<string | null>(null);
  const [prevUserId, setPrevUserId] = useState<string | undefined>(user?.id);

  // Sync localStorage load on user change — immediate, no flicker
  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id);
    if (!user) {
      setPrefs(DEFAULT_PREFS);
      setAvatarState(null);
    } else {
      const savedPrefs = localStorage.getItem(`fg_prefs_${user.id}`);
      setPrefs(savedPrefs ? JSON.parse(savedPrefs) : DEFAULT_PREFS);
      setAvatarState(localStorage.getItem(`fg_avatar_${user.id}`) || null);
    }
  }

  // Async Supabase hydration — overrides localStorage if a remote row exists
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_preferences')
      .select('avatar, prefs')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const av = data.avatar as string | null;
        setAvatarState(av);
        if (av) localStorage.setItem(`fg_avatar_${user.id}`, av);
        else localStorage.removeItem(`fg_avatar_${user.id}`);
        if (data.prefs) {
          const p = data.prefs as Preferences;
          setPrefs(p);
          localStorage.setItem(`fg_prefs_${user.id}`, JSON.stringify(p));
        }
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply dark mode class to <html>
  useEffect(() => {
    if (prefs.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [prefs.darkMode]);

  const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      if (user) {
        localStorage.setItem(`fg_prefs_${user.id}`, JSON.stringify(next));
        upsertRemote(user.id, { prefs: next });
      }
      return next;
    });
  };

  const setAvatarBase64 = (val: string | null) => {
    setAvatarState(val);
    if (user) {
      if (val === null) localStorage.removeItem(`fg_avatar_${user.id}`);
      else localStorage.setItem(`fg_avatar_${user.id}`, val);
      upsertRemote(user.id, { avatar: val });
    }
  };

  return (
    <PreferencesContext.Provider value={{ prefs, updatePref, avatarBase64, setAvatarBase64 }}>
      {children}
    </PreferencesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
