import { useState, useCallback } from 'react';

/**
 * A soft speed-bump for starting a timed session while another is already
 * running. When `blocking` is truthy, the start is held and a heads-up is shown
 * (`guardActive`); the user either proceeds anyway or bails to go end the other.
 * Deliberately NOT a hard block — it just turns an accidental double-run into a
 * conscious choice (the "forgot the trip was still running" bug this guards).
 */
export function useStartCollisionGuard(blocking: unknown) {
  const [pending, setPending] = useState<(() => void) | null>(null);

  // Hold the start in a thunk if something's already running; otherwise fire now.
  const guard = useCallback((start: () => void) => {
    if (blocking) setPending(() => start);
    else start();
  }, [blocking]);

  const proceed = useCallback(() => {
    pending?.();
    setPending(null);
  }, [pending]);

  const dismiss = useCallback(() => setPending(null), []);

  return { guardActive: pending !== null, guard, proceed, dismiss };
}
