// The tag's SECOND identity key — used when the plate can't be read.
//
// Aaron, 2026-08-18, holding a crumpled tag in the bay: the plate and model had torn away, but
// `Veh #: 542 4940` was still crisp — and unit 5424940 is a car FG knows completely (a 2025 VW
// Taos, black, class B5, plate LUR249). Every other field on the tag corroborated it: `B5` matched
// the rental class, `BLA 4DR` matched the colour.
//
// What FG did with that: **told him the scan failed.** `ScanRouterOverlay` bailed on a missing
// plate before anything else ran, and `resolveKeytagScan` only ever matched on plate. So the OCR
// read the unit perfectly, the fleet held the car, and the app said "Could not read that key tag".
//
// ⭐ And this is the case where the scanner is worth the MOST. A clean tag he can read himself; a
// crumpled, faded or half-torn one, with gloves on in a wash bay, is exactly when he wants FG to do
// the reading. The feature was failing hardest where its value was highest.
//
// ⚠️ UNIT NUMBER IS NOT UNIQUE, so this must never guess. At the time of writing, three unit
// numbers are shared by two live vehicles each (5427497, 5738117, 5421656) — which is the whole
// reason `useUnitConflict` exists: a unit gets reassigned and the old row isn't archived. A
// single match identifies; anything else must be handed back to the operator to choose.
import type { Vehicle } from '../types';

/** Digits only — the tag prints the unit spaced ("542 4940") and FG stores it unspaced. */
export function normalizeUnit(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

export type UnitMatch =
  | { kind: 'none' }
  /** Exactly one live vehicle carries this unit — safe to identify. */
  | { kind: 'one'; vehicle: Vehicle }
  /** Two or more carry it. NOT an error and NOT a guess — the operator picks. */
  | { kind: 'ambiguous'; vehicles: Vehicle[] };

/**
 * Find the fleet vehicle for a unit number read off a tag.
 *
 * Deliberately returns a THREE-way result rather than `Vehicle | null`. Collapsing "ambiguous" into
 * "none" would silently drop a car FG can see; collapsing it into "one" would attach a scan to the
 * wrong vehicle — the exact wrong-provenance class as the old scan-router payload bug. The caller
 * has to handle all three.
 */
export function matchByUnitNumber(unitRaw: string | null | undefined, vehicles: readonly Vehicle[]): UnitMatch {
  const unit = normalizeUnit(unitRaw);
  if (!unit) return { kind: 'none' };

  const hits = vehicles.filter(v => normalizeUnit(v.unitNumber) === unit);
  if (hits.length === 0) return { kind: 'none' };
  if (hits.length === 1) return { kind: 'one', vehicle: hits[0] };
  return { kind: 'ambiguous', vehicles: hits };
}

/** The show-your-work line for a card identified WITHOUT a plate — FG never resolves silently by a
 *  weaker key without saying so. '' when the plate did the work, which is the normal case. */
export function matchedByUnitLabel(matchedByUnit: boolean, unitRaw: string | null | undefined): string {
  const unit = normalizeUnit(unitRaw);
  if (!matchedByUnit || !unit) return '';
  return `Matched by unit #${unit} — the plate wasn't readable on the tag.`;
}
