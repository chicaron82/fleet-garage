import { useState } from 'react';

/**
 * ⚡ The EV asset check made AT THE CAR, during registration.
 *
 * `assessed` is the gate and it starts CLOSED, so a registration that ignores the block writes
 * both assets as null exactly as it always has — nothing assumed, nothing logged. The two
 * booleans only mean anything once the gate is open.
 *
 * The state lives in a hook rather than inside the panel because the SUBMIT handler is what acts
 * on it, and the re-seed on a fresh scan is what has to clear it. The panel is only the surface
 * it's collected on. See RegisterEVAssets for why the check sits on the register form at all.
 */
export interface EvAssetCheck {
  assessed: boolean;
  hasCable: boolean;
  hasAdapter: boolean;
  setAssessed: (v: boolean) => void;
  setHasCable: (v: boolean) => void;
  setHasAdapter: (v: boolean) => void;
  /** Back to "not assessed", both present. Called when a new scan replaces the car on the form. */
  reset: () => void;
}

export function useEvAssetCheck(): EvAssetCheck {
  const [assessed, setAssessed] = useState(false);
  const [hasCable, setHasCable] = useState(true);
  const [hasAdapter, setHasAdapter] = useState(true);
  const reset = () => {
    setAssessed(false);
    setHasCable(true);
    setHasAdapter(true);
  };
  return { assessed, hasCable, hasAdapter, setAssessed, setHasCable, setHasAdapter, reset };
}
