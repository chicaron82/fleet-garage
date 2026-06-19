// Fuel pump reading maths for the Shift Duties fuel section. Pure so the form,
// the tripwire warning, and the tests share one source of truth.

/** The baseline Pump 2 reading — the value that gauge should never move from
 *  (the side was taken out of service). Used when there's no prior shift on
 *  record to read a "last recorded" from. */
export const DEFAULT_PUMP2 = 1439;

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

/** The tripwire: true when the entered Pump 2 reading differs from the last
 *  recorded value. A blank or non-numeric entry is not a drift (nothing typed). */
export function pump2Drifted(reading: string, lastRecorded: number): boolean {
  const n = num(reading);
  return n !== null && n !== lastRecorded;
}

/** A digital reading that went UP mid-shift implies a top-up — prompt for why. */
export function digitalWentUp(open: string, close: string): boolean {
  const d = digitalDelta(open, close);
  return d !== null && d > 0;
}
