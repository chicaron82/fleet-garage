import { createContext, useContext } from 'react';
import { useFleetBalance } from '../hooks/useFleetBalance';

// One shared fleet-balance instance for the whole app. Without this, every
// caller (sidebar, analytics, my-shift) ran its own useFleetBalance with private
// state — so logging numbers in one place never reached the sidebar's copy, which
// stayed stuck on the projection until a full reload. The provider holds the
// single source; upsertEntry's refetch updates every consumer at once.
export type FleetBalanceContextValue = ReturnType<typeof useFleetBalance>;

const FleetBalanceContext = createContext<FleetBalanceContextValue | null>(null);

export function FleetBalanceProvider({ children }: { children: React.ReactNode }) {
  const value = useFleetBalance();
  return (
    <FleetBalanceContext.Provider value={value}>
      {children}
    </FleetBalanceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFleetBalanceContext(): FleetBalanceContextValue {
  const ctx = useContext(FleetBalanceContext);
  if (!ctx) throw new Error('useFleetBalanceContext must be used within FleetBalanceProvider');
  return ctx;
}
