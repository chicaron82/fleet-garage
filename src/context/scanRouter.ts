// The scan-router's context object + consumer hook, split out of the provider component so the
// .tsx file only exports components (react-refresh/only-export-components — the same split the
// make/model catalogue took). The provider lives in ./ScanRouterContext.tsx.
import { createContext, useContext } from 'react';

export interface ScanRouterValue {
  /** Open the scan-router overlay (snap a tag → resolve → actions → route). */
  open: () => void;
}

export const ScanRouterContext = createContext<ScanRouterValue | null>(null);

export function useScanRouter(): ScanRouterValue {
  const ctx = useContext(ScanRouterContext);
  if (!ctx) throw new Error('useScanRouter must be used within a ScanRouterProvider');
  return ctx;
}
