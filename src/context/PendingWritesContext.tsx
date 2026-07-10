// One shared instance of the Effie pending-writes queue, so every consumer sees the SAME live
// count: the review section (PendingWritesSection), the producers that stage (keytag scan/batch,
// Effie chat "Later"), AND the My-Shift sidebar badge. Without this, each `usePendingWrites()` call
// was an independent fetch that never heard about the others — a sidebar badge would go stale the
// moment a write was staged or approved elsewhere. Mirrors how Holds/Issues feed their badges off a
// shared context. See src/hooks/usePendingWrites (the logic) + docs/ticket-effie-myshift-pending-badge.md.
import { createContext, useContext } from 'react';
import { usePendingWrites } from '../hooks/usePendingWrites';

type PendingWritesValue = ReturnType<typeof usePendingWrites>;

const PendingWritesContext = createContext<PendingWritesValue | null>(null);

export function PendingWritesProvider({ children }: { children: React.ReactNode }) {
  const value = usePendingWrites();
  return <PendingWritesContext.Provider value={value}>{children}</PendingWritesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePendingWritesContext(): PendingWritesValue {
  const ctx = useContext(PendingWritesContext);
  if (!ctx) throw new Error('usePendingWritesContext must be used within PendingWritesProvider');
  return ctx;
}
