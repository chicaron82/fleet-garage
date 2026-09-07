import { isEvModel } from '../../api/_lib/vehicleClassCodex';


/**
 * What a car is CALLED — year, make, model, and the badges that say what it runs on.
 *
 * ⭐ THE NORTH STAR IS HIS. Aaron, 2026-08-28: *"what's important to me is having FG be truthful on
 * what type of vehicle it is."* Not the tag, not the class code — what the car IS, said plainly
 * wherever he identifies one.
 *
 * ── WHY A COMPONENT AND NOT A NINTH INLINE STRING ──────────────────────────────────────────────
 *
 * `{v.year} {v.make} {v.model}` was hand-written in **eight** files, and the hybrid badge existed on
 * exactly **one** of them (`FleetMasterView`, a green 🔋) — which is why he had never once seen it
 * on a vehicle record. Meanwhile 🇺🇸 `isUs` rendered on a *different* single screen
 * (`ScanVehicleCapture`). Two identity marks, two screens, no overlap.
 *
 * ⚠️ **The badge has to appear where cars get CONFUSED, not where you look one up.** A hybrid
 * Sportage is indistinguishable from the petrol one *in a list* — fleet search, the holds row, the
 * trip picker, and above all **the scan sheet, standing at the car deciding what it is.** A badge
 * only on the record helps after you have already picked the right car.
 *
 * So: one component, every surface, and the next badge (winter tyres? sale car?) is one line here
 * instead of eight edits nobody remembers to make.
 *
 * ── WHAT THE MARKS MEAN ────────────────────────────────────────────────────────────────────────
 *
 * Aaron settled this: *"either works. but let's be consistent. one for EVs the other for Hybrid."*
 *
 *   ⚡ **battery-electric** — a Tesla, or a model the codex marks `isEv` (Niro EV).
 *   🔋 **hybrid** — carries a battery, nothing to plug in.
 *
 * ⚠️ They are about the CAR, not about workload. My first argument for ⚡ was "this one plugs in, so
 * it has kit to check" — wrong, and he corrected it: *"we aren't required to check assets for Niro.
 * that's why it wasn't built to check for them like Tesla's."* The EV-asset check stays Tesla-gated
 * because that is a **policy**; the badge says what the car is. Two different questions.
 *
 * ⭐ `isEvModel` rather than a new column: `CKNE → { model: 'Niro EV', isEv: true }` has been in the
 * codex all along and `AirportFlipSection` already reads `isTesla || isEvModel(model)`. No migration
 * was ever needed — I had claimed one was, and he was right that FG already knew.
 *
 * Mutually exclusive by construction: nothing is both, and ⚡ wins if a record ever says otherwise.
 */

/** The least a caller must supply. Deliberately structural — the trip pickers carry a snake_case
 *  search row and everything else carries a `Vehicle`, and both have these four in camelCase. */
/**
 * ⭐ WHAT IS MISSING FROM A CAR'S NAME — the counterpart to `vehicleLabel`.
 *
 * ⚠️ Aaron, working the Needs-details list (2026-09-07): *"took me a sec to figure out what was
 * still needed. at first i thought it was because no odo was recorded… but then realized make and
 * model weren't showing."*
 *
 * `vehicleLabel` DROPS missing parts, and that is correct — it exists so a null never renders as the
 * literal string "null". The consequence is that a car with no make or model reads as `2024`, and
 * the absence is communicated by nothing being there. He had to notice a negative space, guess
 * wrong once, and reason his way to it.
 *
 * ⚠️⚠️ ONLY GAPS THAT CAN BE FILLED. A missing odometer is a legitimate resting state — *"i have a
 * lot that don't have a reading"* — and naming it would manufacture work that never closes, which
 * is the archived-cars defect this codebase has already been bitten by twice in one day. These
 * three are backfillable, and Fleet already treats them as a work cohort.
 *
 * ⭐ THIS IS THE SINGLE DEFINITION: `fleetCohorts`' `needs-backfill` chip delegates here rather than
 * repeating the predicate, so the record and the fleet count cannot drift apart.
 */
export type IdentityGap = 'year' | 'make' | 'model';

/** Below this a year is a blank or a mis-read (0 included), not a real model year. Mirrors the
 *  register form's `year > 1999` submit guard. */
export const FLEET_YEAR_FLOOR = 2000;

/**
 * ⚠️⚠️ "Unknown" IS A PLACEHOLDER, NOT AN IDENTITY — found by rendering the chip on a real car
 * rather than by a test (2026-09-07). `SB183H` reads **"Tesla Unknown · Unknown"**, and the first
 * version of `identityGaps` called only its year missing, because "Unknown" is a non-blank string.
 *
 * ⭐ It is a gap by his own north star for this file: *"what's important to me is having FG be
 * truthful on what type of vehicle it is."* A record saying "Tesla Unknown" is not truthful about
 * the type, and a Tesla's model is knowable — so it is a FILLABLE gap, which is the only kind this
 * function is allowed to name.
 *
 * ⚠️ Deliberately the literal word only, case- and space-insensitive. Anything looser starts
 * accusing real models, and the codex already carries `Model 3` / `Model Y` — words that would not
 * survive a fuzzier rule. 5 cars carry it; counting them moves Fleet's count 23 → 24.
 */
const PLACEHOLDER = 'unknown';

const missing = (v: string | null | undefined): boolean => {
  const t = v?.trim();
  return !t || t.toLowerCase() === PLACEHOLDER;
};

export function identityGaps(v: NamedVehicle): IdentityGap[] {
  const gaps: IdentityGap[] = [];
  // Order is reading order, so the sentence built from it comes out as "year, make and model".
  if (v.year == null || v.year < FLEET_YEAR_FLOOR) gaps.push('year');
  if (missing(v.make)) gaps.push('make');
  if (missing(v.model)) gaps.push('model');
  return gaps;
}

/** "make and model" / "year, make and model" — the chip's own words, so the caller never
 *  hand-assembles a list and gets the comma wrong on the two-item case. */
export function describeIdentityGaps(gaps: readonly IdentityGap[]): string {
  if (gaps.length === 0) return '';
  if (gaps.length === 1) return gaps[0];
  return `${gaps.slice(0, -1).join(', ')} and ${gaps[gaps.length - 1]}`;
}

export interface NamedVehicle {
  /** ⚠️ NULLABLE, and that was a real gap rather than tidiness. `KnownPlate` (the plate-entry
   *  resolver) carries `number | null` / `string | null`, and the hand-written call sites this file
   *  replaced did `[year, make, model].filter(Boolean).join(' ')` — which DROPS a missing part.
   *  `${v.year} ${v.make}` would have rendered the literal "null" into a lost-item record and a
   *  plate-entry line. The helper has to be at least as careful as the code it is replacing;
   *  otherwise a consolidation is a downgrade with better provenance. (2026-09-01) */
  year: number | null;
  make: string | null;
  model: string | null;
  isHybrid?: boolean | null;
  isTesla?: boolean | null;
}

/** 'year-first' → "2026 Toyota RAV4" (seven of eight surfaces). 'model-first' → "Toyota RAV4 2026"
 *  (FleetMasterView, whose column layout leads with the model). */
export type NameOrder = 'year-first' | 'model-first';

export function vehicleLabel(v: NamedVehicle, order: NameOrder = 'year-first'): string {
  // Built from a filtered list rather than a template, so an absent part leaves NOTHING behind —
  // no stray "null", no double space, no leading gap on a car with no year on file.
  const parts = order === 'model-first' ? [v.make, v.model, v.year] : [v.year, v.make, v.model];
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * The name AS A STRING, badge included — the non-JSX half of `<VehicleName>`.
 *
 * ⭐⭐ WHY THIS EXISTS, and it is the reason the badge kept going missing. `<VehicleName>` can only
 * be used where JSX can: a toast, a push notification, a flash message and a driver's transit line
 * are all plain strings, so every one of them hand-wrote the name and silently lost the badge.
 * Aaron found the tail of it on 2026-09-01, comparing three screens of one Civic — the audit card
 * said "2026 Honda Civic 🔋" and the record and the scan sheet did not.
 *
 * ── THE RULE, so a future caller does not have to guess ────────────────────────────────────────
 *   HE READS IT ON A SCREEN  → `<VehicleName>` (JSX) or `vehicleNameText` (a string). Badge shown:
 *                              a hybrid Sportage is indistinguishable from the petrol one, and
 *                              that is the whole point of the mark.
 *   STORED, EXPORTED, COMPARED → `vehicleLabel`. NO badge: an emoji inside a saved field, a CSV
 *                              cell or a de-duplication key is not identity, it is decoration that
 *                              can break a match.
 * Either way it goes through this file. The defect was never a wrong choice between the two — it
 * was thirteen files making the choice by hand and one of them forgetting.
 */
export function vehicleNameText(v: NamedVehicle, order: NameOrder = 'year-first'): string {
  const badge = powertrainBadge(v);
  const name = vehicleLabel(v, order);
  return badge ? `${name} ${badge}` : name;
}

/** ⚡ / 🔋 / nothing. Exported so tests and non-JSX callers can ask the same question the UI asks. */
export function powertrainBadge(v: NamedVehicle): '⚡' | '🔋' | null {
  if (v.isTesla || isEvModel(v.model)) return '⚡';
  if (v.isHybrid) return '🔋';
  return null;
}
