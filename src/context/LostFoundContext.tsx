import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { mapLostFoundItem } from '../lib/garage-mappers';
import { useLostFound, type LostFoundSlice } from './useLostFound';

export type LostFoundContextValue = LostFoundSlice & { loadError: boolean; reload: () => void };

const LostFoundContext = createContext<LostFoundContextValue | null>(null);

export function LostFoundProvider({ children }: { children: React.ReactNode }) {
  const { user, activeBranch } = useAuth();
  const { setAllLostFoundItems, ...slice } = useLostFound(user, activeBranch);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  function reload() { setLoadError(false); setLoadAttempt(a => a + 1); }

  useEffect(() => {
    supabase
      .from('lost_found')
      .select('*')
      .order('found_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) {
          console.error('[LostFoundContext] Initial load failed:', error);
          setLoadError(true);
        }
        if (data) setAllLostFoundItems(data.map(mapLostFoundItem));
      });
  }, [loadAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LostFoundContext.Provider value={{ ...slice, loadError, reload }}>
      {children}
    </LostFoundContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLostFoundContext(): LostFoundContextValue {
  const ctx = useContext(LostFoundContext);
  if (!ctx) throw new Error('useLostFoundContext must be used within LostFoundProvider');
  return ctx;
}
