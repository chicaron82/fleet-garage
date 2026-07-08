// Effie's conversation, lifted to a shared owner. The chat state (messages, in-flight
// send, proposals) used to live INSIDE FgAssistantFab; hoisting it here lets multiple
// surfaces render the SAME live thread — the FAB today, and Effie's full-screen module
// next (docs/ticket-misc-effie-module.md). One provider, one conversation; the surfaces
// are just different windows onto it. Pass 1 of the module build: state-lift only, no UI
// change — the FAB renders exactly as before.
import { createContext, useContext, type ReactNode } from 'react';
import { useFgAssistant } from '../hooks/useFgAssistant';

type EffieContextValue = ReturnType<typeof useFgAssistant>;

const EffieContext = createContext<EffieContextValue | null>(null);

export function EffieProvider({ children }: { children: ReactNode }) {
  const effie = useFgAssistant();
  return <EffieContext.Provider value={effie}>{children}</EffieContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEffie(): EffieContextValue {
  const ctx = useContext(EffieContext);
  if (!ctx) throw new Error('useEffie must be used within EffieProvider');
  return ctx;
}
