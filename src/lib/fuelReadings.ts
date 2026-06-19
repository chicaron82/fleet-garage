// Fuel pump reading maths for the Shift Duties fuel section. Pure so the form,
// the tripwire warning, and the tests share one source of truth.

/** The locked Pump 2 baseline — the side is out of service, so its cumulative
 *  meter should read this every shift, forever. It is FIXED, not drift-from-saves:
 *  the meter only climbs when fuel is pumped, so any increase = the locked pump
 *  was used. (Re-baselining after a legitimate use would be a deliberate
 *  management action, not an automatic follow of whatever was last entered.) */
export const EXPECTED_PUMP2 = 1439;

export type Pump2Status = 'ok' | 'used' | 'fault';

const num = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Litres pumped on an analog gauge = close − open, whole numbers (the gauge
 *  shows no fractions). null until both readings are valid. */
export function analogPumped(open: string, close: string): number | null {
  const o = num(open), c = num(close);
  if (o === null || c === null) return null;
  return Math.round(c - o);
}

/** Digital tank net change = close − open, kept to one decimal (real instrument).
 *  null until both readings are valid. Positive means the tank went UP. */
export function digitalDelta(open: string, close: string): number | null {
  const o = num(open), c = num(close);
  if (o === null || c === null) return null;
  return Math.round((c - o) * 10) / 10;
}

/**
 * The tripwire, directional. The Pump 2 meter is cumulative and the side is
 * locked, so against the expected baseline:
 *   - equal → 'ok'   (untouched, as it should be)
 *   - above → 'used'  (the meter only climbs when pumped — someone used it)
 *   - below → 'fault' (a cumulative meter physically can't drop — fault/misread)
 * null until something numeric is typed (a blank field isn't an alarm).
 */
export function pump2Status(reading: string, expected: number): Pump2Status | null {
  const n = num(reading);
  if (n === null) return null;
  if (n === expected) return 'ok';
  return n > expected ? 'used' : 'fault';
}

/** A digital reading that went UP mid-shift implies a top-up — prompt for why. */
export function digitalWentUp(open: string, close: string): boolean {
  const d = digitalDelta(open, close);
  return d !== null && d > 0;
}
