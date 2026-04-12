import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

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

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Default preferences
  const [prefs, setPrefs] = useState<Preferences>({
    darkMode: false,
    notifyNewFlags: true,
    notifyReleases: true,
  });

  const [avatarBase64, setAvatarState] = useState<string | null>(null);

  // Load user data on login
  useEffect(() => {
    if (!user) {
      document.documentElement.classList.remove('dark');
      return;
    }
    
    // Load config
    const savedPrefs = localStorage.getItem(`fg_prefs_${user.id}`);
    if (savedPrefs) {
      setPrefs(JSON.parse(savedPrefs));
    } else {
      setPrefs({
        darkMode: false,
        notifyNewFlags: true,
        notifyReleases: true,
      });
    }

    // Load avatar
    const savedAvatar = localStorage.getItem(`fg_avatar_${user.id}`);
    setAvatarState(savedAvatar || null);
  }, [user]);

  // Handle Dark mode DOM changes globally
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
      }
      return next;
    });
  };

  const setAvatarBase64 = (val: string | null) => {
    setAvatarState(val);
    if (user) {
      if (val === null) {
        localStorage.removeItem(`fg_avatar_${user.id}`);
      } else {
        localStorage.setItem(`fg_avatar_${user.id}`, val);
      }
    }
  };

  return (
    <PreferencesContext.Provider value={{ prefs, updatePref, avatarBase64, setAvatarBase64 }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
