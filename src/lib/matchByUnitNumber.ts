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
 *  weaker key without saying so. '' when the plate did the work, which is the normal case.
 *
 *  ⚠️ TWO CAUSES, and this used to assert the wrong one. The line was hardcoded to "the plate
 *  wasn't readable on the tag" — true when the tag is torn, and **false** when the tag is crisp but
 *  carries a plate FG doesn't have on file. That second case is a **re-plate**, and it is the more
 *  interesting of the two: an out-of-province car converted to MB plates keeps its unit number and
 *  owning area but changes the only key FG searches by (Aaron, 2026-08-25 — a Calgary-owned
 *  Suburban on `0GK641`, due for MB plates). FG would have resolved it correctly by unit, then
 *  explained itself with a confident lie and buried the actual news.
 *
 *  So the cause is DERIVED, never assumed: if the tag gave us a plate and it differs from the
 *  record's, say that instead. It's the difference between silently-wrong and known-and-fixable —
 *  and the fix is one tap away in the identity modal, where migration 118's trigger logs
 *  `license_plate: {from → to}` so the old plate survives in the car's own history. */
export function matchedByUnitLabel(
  matchedByUnit: boolean,
  unitRaw: string | null | undefined,
  tagPlate?: string | null,
  recordPlate?: string | null,
): string {
  const unit = normalizeUnit(unitRaw);
  if (!matchedByUnit || !unit) return '';
  const tag = (tagPlate ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const record = (recordPlate ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (tag && record && tag !== record) {
    return `Matched by unit #${unit} — the tag reads ${tag}, but this car is on file as ${record}. Re-plated? Open the record to update the plate.`;
  }
  return `Matched by unit #${unit} — the plate wasn't readable on the tag.`;
}

/** True when the unit-number match was caused by a plate CHANGE rather than an unreadable tag.
 *  Drives the tone: a torn tag is an FYI, a re-plate is a thing to act on. */
export function isPlateMismatch(tagPlate?: string | null, recordPlate?: string | null): boolean {
  const tag = (tagPlate ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const record = (recordPlate ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return !!tag && !!record && tag !== record;
}
