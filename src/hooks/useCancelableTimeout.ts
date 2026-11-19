import { useCallback, useEffect, useRef } from 'react';

/**
 * A setTimeout that dies with its component (2026-11-19).
 *
 * Every search box closes its suggestions 200 ms after a blur, so a tap on a suggestion lands first. Written as a bare
 * `setTimeout`, that timer outlived its screen: GitHub CI on f7968ac8 failed with all 5349 tests passing, on "window
 * is not defined", one of these firing after HoldsView's test had torn the page down. Four boxes carried the same line.
 *
 * `later(fn, ms)` replaces any timer still pending (a second blur doesn't stack a second close), `cancel()` drops it
 * (a refocus inside the window keeps the list open), and unmounting cancels it.
 */
export function useCancelableTimeout() {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    cancel();
    pending.current = setTimeout(() => { pending.current = null; fn(); }, ms);
  }, [cancel]);
  useEffect(() => cancel, [cancel]);
  return { later, cancel };
}
