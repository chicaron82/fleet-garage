// When a cheap key-tag read is good enough, and when it isn't.
//
// Measured 2026-08-18 against 40 of Aaron's real stored tags, scored against the vehicle records he
// had already corrected (so the fleet WAS the ground truth — no expensive control run needed):
//
//   claude-haiku-4-5   resolves to the right car 97.5% · plate 87.5% · unit 97.5% · year 82.5%
//   claude-opus-4-8    perfect 5/5 fields on ALL 13 tags haiku got imperfect — 13-0, no ties
//
// So Opus is plainly the better reader, and past-DiZee's recommendation to use it was right. But
// "better reader" is not the same as "worth 5.4× on every scan", because of an asymmetry Aaron
// spotted first:
//
//   • For a car FG ALREADY KNOWS, a misread barely matters — the tag carries up to six mutually
//     confirming keys (plate, unit, year, model, colour, class) against a 626-plate fleet, so any
//     one of them lands on the car and the RECORD corrects the rest. His words: *"LUR243 exists in
//     FG, so can match either unit too. it knows versa's are B class"*.
//   • For a car FG does NOT know, there is no record to correct against. The read becomes the
//     record. At 87.5% plate accuracy that is a wrong plate on roughly 1 in 8 new registrations —
//     permanent, and an identity key.
//
// ⭐ So the escalation trigger is NOT a confidence score. It is simply: **can FG check this answer?**
// A read that resolves against the fleet is self-verified and needs nothing more. A read that
// resolves to nothing is either a new car or a bad read, and both of those want the strong model.
//
// The check costs nothing extra — resolving a scan against the fleet is something FG already does.
import type { KeytagRead } from './keytagRead';

/** Digits only — tags print the unit spaced ("542 4882"), FG stores it joined. */
export function unitDigits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

/** Plate, normalized the way a match would compare it. */
export function plateKey(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

/** What a cheap read has to offer before it's even worth a fleet lookup. */
export function hasIdentityKey(read: KeytagRead | null | undefined): boolean {
  return !!plateKey(read?.plate) || !!unitDigits(read?.unitNumber);
}

/**
 * Should this read be re-done with the strong model?
 *
 * `matched` is whether the fleet lookup found a vehicle for the cheap read's plate or unit.
 *
 * Escalate when the read carries no identity key at all (nothing to check), or when it carries one
 * that matches nothing (a new car, or a misread — indistinguishable here, and both want Opus).
 * A matched read is left alone: it is confirmed by an independent record, which is a stronger
 * guarantee than a second opinion from a bigger model would be.
 */
export function shouldEscalate(read: KeytagRead | null | undefined, matched: boolean): boolean {
  if (!hasIdentityKey(read)) return true;
  return !matched;
}
