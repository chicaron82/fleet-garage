import { useState } from 'react';
import { findUnitConflict } from '../lib/identityConflict';
import type { Vehicle } from '../types';

/**
 * Owns the unit#-conflict concern for the registration form: derive the
 * conflicting record live from the typed unit#, and hold the user's *intent* to
 * move the number (armed = confirmed via the two-step).
 *
 * `armed` is derived, never stored: it's true only while the confirmed id still
 * matches the live conflict. So if the unit# changes to a different conflict — or
 * none — a stale arm simply stops matching and can't fire against a number the
 * user has since edited; no reset effect needed. Keeping this out of the form
 * keeps the form a layout file (and under the line cap).
 */
export function useUnitConflict(unit: string, vehicles: Vehicle[]) {
  const conflict = findUnitConflict(unit, vehicles);
  const [armedId, setArmedId] = useState<string | null>(null);
  const armed = !!conflict && armedId === conflict.id;

  return {
    conflict,
    armed,
    arm: () => { if (conflict) setArmedId(conflict.id); },
    disarm: () => setArmedId(null),
  };
}
