import { useState, useEffect } from 'react';
import { useVehicleByPlate } from './useVehicleByPlate';
import type { KnownPlate } from '../lib/vehicleByPlate';

// Debounce window for the registry lookup. Long enough to coalesce a burst of
// keystrokes into one query, short enough that the hint still feels live.
const DEBOUNCE_MS = 250;

/**
 * Live "recognize a plate as it's typed" — resolves a plate through the shared
 * primitive (fleet match, then cross-date registry memory) and returns the
 * current match, or null. One home for the lookup-on-input behaviour every
 * plate field needs, instead of each surface re-rolling the same effect.
 *
 * - Short/empty plates resolve to null without a query (`minLength`, default 4),
 *   and clear immediately — no debounce — so emptying the field drops the hint.
 * - A real plate's registry lookup is debounced (~250ms) so a burst of keystrokes
 *   fires one query once the input settles, not one round-trip per character.
 *   Resolution is async with a cancelled-guard so fast typing can't land a stale
 *   result (no synchronous setState in the effect body).
 * - `onResolved` fires after each settle — for callers that pre-fill a field
 *   from a recognized plate (e.g. registration filling the unit number). It is
 *   intentionally excluded from the effect deps, so it must NOT close over
 *   changing state: use functional setState (`setX(prev => …)`) inside it rather
 *   than a captured value, or you'll act on a stale closure.
 */
export function usePlateRecognition(
  plate: string,
  onResolved?: (match: KnownPlate | null) => void,
  minLength = 4,
): KnownPlate | null {
  const { resolve } = useVehicleByPlate();
  const [match, setMatch] = useState<KnownPlate | null>(null);

  useEffect(() => {
    const p = plate.trim();
    const isLong = p.length >= minLength;
    let cancelled = false;

    const settle = () => {
      const lookup = isLong ? resolve(p) : Promise.resolve(null);
      lookup.then(m => {
        if (cancelled) return;
        setMatch(m);
        onResolved?.(m);
      });
    };

    // Short/empty plate: clear at once (no query, no debounce) so emptying the
    // field drops the hint immediately. A real plate debounces the lookup so a
    // burst of keystrokes fires a single query once the input settles. Both go
    // through the async `settle` (no synchronous setState in the effect body);
    // the cleanup cancels the in-flight result and any pending debounce timer.
    if (!isLong) { settle(); return () => { cancelled = true; }; }
    const timer = setTimeout(settle, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
    // onResolved is caller-inline (changes identity each render); including it
    // would re-resolve on every render. It only reads stable setters, so it's
    // safe to fire the latest without re-subscribing.
  }, [plate, resolve, minLength]); // eslint-disable-line react-hooks/exhaustive-deps

  return match;
}
