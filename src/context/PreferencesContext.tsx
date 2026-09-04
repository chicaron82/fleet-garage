import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase, writeWithRefresh } from '../lib/supabase';
import type { Json } from '../types/database.types';
import type { LandingTab } from '../types';

interface Preferences {
  darkMode: boolean;
  notifyNewFlags: boolean;
  notifyReleases: boolean;
  landingTab: LandingTab;
  /** Show the ℹ️ / ⓘ guide affordances in the header and sidebar.
   *
   *  Aaron, 2026-08-17: *"a toggle switch to disable the module guides. its my tool now afterall,
   *  i know what everything goes. if i want to show it off i can turn it back on."*
   *
   *  ⭐ THE REAL REASON, which he gave AFTER it shipped: *"i've been accidentally tapping it."*
   *  Not clutter — MIS-TAPS. The header ℹ️ sits `ml-0.5` from 📷, his highest-frequency action, so
   *  a thumb reaching for the scanner opened a guide modal instead, on the lot, tag in hand. The
   *  header below already documents the identical bug on the OTHER side of 📷 (the notification
   *  bell) and fixed it with a divider and a gap; ℹ️ never got the same treatment.
   *
   *  So the toggle is a hit-target fix that happens to look like a preference. Note the corollary:
   *  turning guides back ON for a demo restores the mis-tap. If that becomes annoying, give ℹ️ the
   *  same divider/gap the bell got rather than reaching for this switch.
   *
   *  Off, the guide itself is untouched and still reachable from the profile menu — what stops is
   *  the app OFFERING it. Defaults true so a demo account (and the first run) keeps the tour. */
  showModuleGuide: boolean;
  /** ✨ on the rare good news — a new car, a first key tag.
   *
   *  ⭐ Aaron asked for this and then defended it against my own measurement: I found that a car
   *  new to FG turns up about SEVEN TIMES A DAY, argued a sparkle would be wallpaper inside a week,
   *  and recommended a quiet line. *"i want the sparkle! that's why asked for it. but to compromise
   *  how bout a toggle in settings to switch off the sparkle and just use plain ol text toast."*
   *
   *  ⚠️ It is his tool, and delight is a real requirement — the restraint argument is mine and is
   *  now a SWITCH rather than a veto. Defaults ON, because he asked for it; the off position is the
   *  version I would have shipped. **The sparkle also never fires under `prefers-reduced-motion`,
   *  toggle or no toggle** — that is an accessibility floor, not a preference. */
  sparkles: boolean;
}

interface PreferencesContextValue {
  prefs: Preferences;
  updatePref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  avatarBase64: string | null;
  setAvatarBase64: (val: string | null) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const DEFAULT_PREFS: Preferences = { darkMode: false, notifyNewFlags: true, notifyReleases: true, landingTab: 'last-visited', showModuleGuide: true, sparkles: true };

function upsertRemote(userId: string, patch: { avatar?: string | null; prefs?: Preferences }) {
  void writeWithRefresh(() => supabase.from('user_preferences').upsert(
    {
      user_id:    userId,
      updated_at: new Date().toISOString(),
      ...('avatar' in patch ? { avatar: patch.avatar ?? null } : {}),
      ...('prefs'  in patch ? { prefs:  patch.prefs as unknown as Json } : {}),
    },
    { onConflict: 'user_id' },
  ));
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
      // Merge over defaults so a pref added later (e.g. landingTab) is present even
      // when the stored blob predates it.
      setPrefs(savedPrefs ? { ...DEFAULT_PREFS, ...JSON.parse(savedPrefs) } : DEFAULT_PREFS);
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
        if (av !== null) {
          setAvatarState(av);
          localStorage.setItem(`fg_avatar_${user.id}`, av);
        }
        if (data.prefs) {
          const p = { ...DEFAULT_PREFS, ...(data.prefs as unknown as Partial<Preferences>) };
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

/**
 * ⭐⭐⭐ DECORATION MUST FAIL OPEN. Whether the flourish is switched on, from anywhere, **without
 * ever throwing** — because a missing provider has to mean *no sparkles*, never a crash.
 *
 * ⚠️ THIS EXISTS BECAUSE THE FIRST VERSION DID CRASH. `<Sparkles>` called `usePreferences()`, which
 * throws outside a provider, so adding a decorative layer to `Toast` made a previously-pure
 * presentational component depend on app context — and took three of its tests down with it. **The
 * sparkle became load-bearing, which is the fastest way to make the next restraint argument
 * unanswerable.** If delight can break a toast, delight loses, and it deserves to.
 *
 * Falls back to the default (on) rather than off, so the absence of a provider is not silently the
 * same as the user having opted out.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSparklesEnabled(): boolean {
  return useContext(PreferencesContext)?.prefs.sparkles ?? DEFAULT_PREFS.sparkles;
}
