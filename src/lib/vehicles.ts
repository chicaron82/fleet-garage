import type { Vehicle } from '../types';

export function isTesla(vehicle: Vehicle): boolean {
  return vehicle.make.toLowerCase() === 'tesla';
}

/** The oldest model year the fleet realistically carries. A scanned year below this
 *  (a 2-digit OCR mis-read like `10`, or the `0` sentinel for a blank field) is treated
 *  as garbage, not a real year. Mirrors the `year > 1999` submit guard. */
const FLEET_YEAR_FLOOR = 2000;

/**
 * Sanitize a scanned/parsed model year: return it only when it's a plausible fleet year,
 * otherwise fall back (to the current year at the call sites). "Plausible" = at least the
 * fleet floor and no more than one model-year ahead of the fallback. This stops a handwritten
 * tag's mis-read year (e.g. `10`) — non-null, so `?? fallback` never catches it — from seeding
 * the register form's ±1 stepper dozens of taps away from a sensible start.
 */
export function plausibleYearOr(scanned: number | null | undefined, fallback: number): number {
  if (scanned == null) return fallback;
  if (scanned < FLEET_YEAR_FLOOR || scanned > fallback + 1) return fallback;
  return scanned;
}
