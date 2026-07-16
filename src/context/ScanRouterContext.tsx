// The scan-router's one shared instance. Both entry points (the My Day card + the header icon)
// call openScanRouter(); the overlay is rendered once here, at app scope. A context (not props)
// because the two triggers live in different trees — the header is in AppShell, the card is deep
// in a screen — and prop-drilling an opener through both would be the god-shell it's meant to avoid.
// `navigate` is handed in from App (which owns routing) so an action tap routes like any button.
// The context object + useScanRouter hook live in ./scanRouter (react-refresh: components only here).
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ScanRouterOverlay } from '../components/scan-router/ScanRouterOverlay';
import { ScanRouterContext } from './scanRouter';
import type { Screen } from '../types';

export function ScanRouterProvider({ navigate, children }: { navigate: (screen: Screen) => void; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ScanRouterContext.Provider value={value}>
      {children}
      {isOpen && <ScanRouterOverlay navigate={navigate} onClose={() => setIsOpen(false)} />}
    </ScanRouterContext.Provider>
  );
}
