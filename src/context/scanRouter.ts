// The scan-router's context object + consumer hook, split out of the provider component so the
// .tsx file only exports components (react-refresh/only-export-components — the same split the
// make/model catalogue took). The provider lives in ./ScanRouterContext.tsx.
import { createContext, useContext, type RefObject } from 'react';

export interface ScanRouterValue {
  /**
   * Fire the camera AND open the overlay, in the caller's own click.
   *
   * Must be called synchronously from a user gesture. The provider holds the file input at app
   * scope precisely so it is already mounted when a tap arrives — an `input.click()` issued after
   * the overlay mounts would run from an effect, outside the gesture, and browsers block that
   * (Safari always, Chrome inconsistently). That constraint is the whole reason this lives here
   * and not in the overlay.
   */
  scan: () => void;
  /** The photo just picked, handed to the overlay to read. Consume it and null the ref. */
  pickedFileRef: RefObject<File | null>;
  /** Bumped once per picked photo. The overlay keys its consume-effect off this, not off the
   *  File's identity, so one photo is read exactly once. */
  pickedNonce: number;
}

export const ScanRouterContext = createContext<ScanRouterValue | null>(null);

export function useScanRouter(): ScanRouterValue {
  const ctx = useContext(ScanRouterContext);
  if (!ctx) throw new Error('useScanRouter must be used within a ScanRouterProvider');
  return ctx;
}
