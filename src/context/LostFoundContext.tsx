import { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { mapLostFoundItem } from '../lib/garage-mappers';
import { useLostFound, type LostFoundSlice } from './useLostFound';
import { useVehicleHoldContext } from './VehicleHoldContext';

const LostFoundContext = createContext<LostFoundSlice | null>(null);

export function LostFoundProvider({ children }: { children: React.ReactNode }) {
  const { user, activeBranch } = useAuth();
  const { vehicles } = useVehicleHoldContext();
  const { setAllLostFoundItems, ...slice } = useLostFound(user, activeBranch, vehicles);

  useEffect(() => {
    supabase
      .from('lost_found')
      .select('*')
      .order('found_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setAllLostFoundItems(data.map(mapLostFoundItem));
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LostFoundContext.Provider value={slice}>
      {children}
    </LostFoundContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLostFoundContext(): LostFoundSlice {
  const ctx = useContext(LostFoundContext);
  if (!ctx) throw new Error('useLostFoundContext must be used within LostFoundProvider');
  return ctx;
}
