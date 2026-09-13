// "Needs a look" — the contradictions FG already has the evidence to spot (2026-08-19).
//
// Aaron found two duplicate vehicles by asking a question, not by using a screen: unit 5421656
// registered twice as LUR143 and LURL43, and unit 5738117 as 0EJ761 and OEJ761. One car each,
// entered twice off a SINGLE MISREAD CHARACTER. Both had sat in the live fleet for months, and
// nothing in FG was ever going to mention them.
//
// ⭐ THE DESIGN CHOICE THAT MATTERS: the CONFUSABLE-PLATE check does not validate against provincial
// formats. A fleet that takes one-ways from four provinces would make a format whitelist rot, so it
// looks for the failure mode that actually happened: **two live plates that are the same string once
// the OCR-confusable characters are collapsed.** No provincial knowledge required, and it catches
// exactly the pair that got past everything.
//
// ⚠️ UPDATED 2026-08-22 — that paragraph used to end "no provincial knowledge required" full stop,
// and a fifth check now DOES compare a plate's shape to a province's. The two are not in conflict
// and the difference is the point: the whitelist I refused is a list of formats a plate is ALLOWED
// to have; the cross-check below compares a plate against the one branch that actually owns it, read
// off the same key tag. It cannot rot, because a branch's shape is measured from that branch's own
// live cars. The old sentence is corrected rather than deleted so the reasoning survives.
//
// It PROPOSES, it never fixes. A wrong auto-merge would eat a damage record — the one thing FG
// exists to prevent (project_fg_old_damage_amnesia). Every finding names the records and leaves the
// call to the operator.

import { TESLA_KEYCARD_COUNT } from './keyCount';
import { vehicleLabel } from './vehicleName';
import { LETTER_TO_DIGIT } from '../../api/_lib/platePrefix';
import { expectedPlateShape, owningLabel } from '../../api/_lib/owningArea';

export interface AuditVehicle {
  id: string;
  /** A Tesla's key count is not a preference — it is always exactly one (see lib/keyCount). */
  isTesla?: boolean;
  unitNumber: string | null;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  keyCount?: number | null;
  /** The branch that owns the car, read off the key tag ("8193"). Empty/absent for most of the
   *  fleet, which predates the capture — absent is never a finding. */
  owningArea?: string | null;
}

export type FleetAuditKind =
  | 'duplicate-unit' | 'duplicate-plate' | 'confusable-plate' | 'confusable-unit'
  | 'tesla-key-count' | 'plate-owning';

export interface FleetAuditFinding {
  /** Stable across runs so a dismissal sticks. Derived from the kind + the identifiers, never from
   *  row ids or ordering — a re-registered car must not resurrect a finding he already settled. */
  key: string;
  kind: FleetAuditKind;
  title: string;
  detail: string;
  vehicles: AuditVehicle[];
}

export function normalizePlate(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** A plate reduced to its FORM: letters become A, digits become 9. "LZM516" → "AAA999". */
export function plateShape(raw: string | null | undefined): string {
  return normalizePlate(raw).replace(/[A-Z]/g, 'A').replace(/[0-9]/g, '9');
}

/** Collapse a plate to its confusable-class form, so LUR143 and LURL43 land on the same string. */
export function confusableKey(raw: string | null | undefined): string {
  return normalizePlate(raw).split('').map(c => LETTER_TO_DIGIT[c] ?? c).join('');
}

/**
 * Two unit numbers of the same length that differ in exactly ONE position.
 *
 * ⚠️ Deliberately NOT built on `confusableKey`, which is the natural-looking move and the wrong one.
 * `plateDifference.ts` was right to reuse it: it encodes which SHAPES a vision read swaps, and
 * plates are mixed letters and digits. Unit numbers are all digits, and the misreads that actually
 * happened were 5423082→5429082 (3→9), 5425814→5424814 (5→4) and, on the same tag, 7TM063592→
 * 7TM062592 (3→2). Digit-for-digit, not shape-for-shape — a confusable key would have collapsed
 * none of them. Position, not resemblance, is the signal here.
 */
export function unitOneApart(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && ++diff > 1) return false;
  }
  return diff === 1;
}

function describe(v: AuditVehicle): string {
  // ⚠️ `vehicleLabel`, not the badged form: this string is a COMPARISON key for duplicate
  // detection, and an emoji in it is decoration that can break a match.
  return `${v.licensePlate} · ${vehicleLabel(v)} · ${v.color}`;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Do these records look like the same physical car?
 *
 * ⚠️ COLOUR IS IN HERE ON PURPOSE, and it's the field that does the work. A fleet this size holds
 * dozens of identical 2025 Rogues, so year+make+model alone proves almost nothing — the two real
 * duplicates matched on colour too, and unit 5427497's Green Prius vs Gray Prius is exactly the
 * case that must NOT be called a duplicate.
 *
 * The failure direction is deliberate: colour naming drifts (Gray vs Grey, Silver vs Gray), so a
 * mismatch occasionally means sloppy entry rather than a different car. That costs a softer message
 * telling him to look. The opposite error — confidently calling two real cars one — would send him
 * merging a record that holds someone's damage history.
 */
function sameSpec(a: AuditVehicle, b: AuditVehicle): boolean {
  return a.year === b.year
    && norm(a.make) === norm(b.make)
    && norm(a.model) === norm(b.model)
    && norm(a.color) === norm(b.color);
}

function groupBy(vehicles: readonly AuditVehicle[], key: (v: AuditVehicle) => string) {
  const out = new Map<string, AuditVehicle[]>();
  for (const v of vehicles) {
    const k = key(v);
    if (!k) continue;   // a blank identifier isn't a collision, it's a gap — different problem
    const list = out.get(k);
    if (list) list.push(v); else out.set(k, [v]);
  }
  return out;
}

/**
 * Every contradiction worth a human look, worst evidence first.
 *
 * `dismissed` are keys the operator has already settled — unit 5427497 is the live example: a Green
 * Prius and a Gray Prius on different plates might genuinely be two cars, and once he says so it
 * must stop asking. **An audit list you can't clear is a list you stop reading.**
 */
export function auditFleet(
  vehicles: readonly AuditVehicle[],
  dismissed: readonly string[] = [],
): FleetAuditFinding[] {
  const gone = new Set(dismissed);
  const findings: FleetAuditFinding[] = [];
  const claimed = new Set<string>();   // ids already explained by a stronger finding

  // ── 1. Same unit number, two live records ──────────────────────────────────────────────────
  // The hardest evidence there is: a unit number is stamped on the car itself.
  for (const [unit, group] of groupBy(vehicles, v => (v.unitNumber ?? '').trim())) {
    if (group.length < 2) continue;
    findings.push({
      key: `duplicate-unit:${unit}`,
      kind: 'duplicate-unit',
      title: `Unit ${unit} is on ${group.length} live records`,
      detail: group.every(v => sameSpec(v, group[0]))
        ? 'Same year, make and model on every record — almost certainly one car entered twice.'
        : 'The records describe different vehicles, so one of them may carry the wrong unit number.',
      vehicles: group,
    });
    group.forEach(v => claimed.add(v.id));
  }

  // ── 2. Same plate, two live records ────────────────────────────────────────────────────────
  for (const [plate, group] of groupBy(vehicles, v => normalizePlate(v.licensePlate))) {
    if (group.length < 2) continue;
    if (group.every(v => claimed.has(v.id))) continue;   // already reported as a unit collision
    findings.push({
      key: `duplicate-plate:${plate}`,
      kind: 'duplicate-plate',
      title: `Plate ${group[0].licensePlate} is on ${group.length} live records`,
      detail: 'A plate belongs to one car at a time — these records disagree about which.',
      vehicles: group,
    });
    group.forEach(v => claimed.add(v.id));
  }

  // ── 3. Two plates one misread apart ────────────────────────────────────────────────────────
  // The check that would have caught both of today's duplicates on the day they were created.
  for (const [, group] of groupBy(vehicles, v => confusableKey(v.licensePlate))) {
    if (group.length < 2) continue;
    const distinct = new Set(group.map(v => normalizePlate(v.licensePlate)));
    if (distinct.size < 2) continue;                     // identical plates → already covered above
    if (group.every(v => claimed.has(v.id))) continue;
    const plates = [...distinct].sort();
    findings.push({
      key: `confusable-plate:${plates.join('|')}`,
      kind: 'confusable-plate',
      title: `${plates.join(' and ')} differ by one easily-misread character`,
      detail: group.every(v => sameSpec(v, group[0]))
        ? 'Same year, make and model too — one of these plates was very likely read wrong.'
        : 'The vehicles differ, so this may be a coincidence worth confirming rather than a misread.',
      vehicles: group,
    });
  }

  // ── 4. Two unit numbers one misread apart, on the same model ───────────────────────────────
  // The mirror of check 3, on the identifier check 1 calls "the hardest evidence there is" — and
  // the asymmetry that let two more duplicates live for two weeks (found 2026-09-12): the audit
  // looked for NEAR-miss plates but only EXACT-collision units. LZM527/LMS527 (unit …3082/…9082)
  // and LFJ213/LPU213 (unit …5814/…4814) were one digit apart on the unit and TWO characters apart
  // on the plate, so check 1 and check 3 both walked past them. Aaron, who reads the tags:
  // *"LPU is a terrible read lol so i'm sure the jetta is also a misread."* Both tags confirmed it.
  //
  // ⭐ THE MAKE+MODEL GATE IS WHAT MAKES THIS USABLE, and it is measured rather than guessed —
  // over all 803 rows on the day it was written:
  //     unit numbers one character apart .................  8 pairs
  //     ...and the same make and model ...................  2 pairs  ← both were real duplicates
  //     (license plates one character apart, for contrast)  3,785 pairs
  // Zero false positives at the gate; plates alone are pure noise on this test.
  //
  // ⚠️ YEAR AND COLOUR ARE DELIBERATELY OUT OF THE GATE, unlike `sameSpec`. They changed nothing in
  // the measurement above, and requiring them would blind the check exactly when a read went wrong
  // in more than one field — which is the failure being hunted. They still SOFTEN THE MESSAGE
  // below, the same way check 3 uses them: gate on what is measured, hedge on what is uncertain.
  //
  // Grouped by model before comparing: pairwise over the whole fleet is ~322k comparisons, and this
  // runs on his phone.
  for (const [, group] of groupBy(vehicles, v => `${norm(v.make)}|${norm(v.model)}`)) {
    const withUnits = group.filter(v => (v.unitNumber ?? '').trim());
    for (let i = 0; i < withUnits.length; i++) {
      for (let j = i + 1; j < withUnits.length; j++) {
        const a = withUnits[i], b = withUnits[j];
        const ua = (a.unitNumber ?? '').trim(), ub = (b.unitNumber ?? '').trim();
        if (ua === ub) continue;                          // exact collision → check 1 owns it
        if (!unitOneApart(ua, ub)) continue;
        if (claimed.has(a.id) && claimed.has(b.id)) continue;
        const units = [ua, ub].sort();
        findings.push({
          key: `confusable-unit:${units.join('|')}`,
          kind: 'confusable-unit',
          title: `Units ${units.join(' and ')} differ by one character on the same model`,
          detail: sameSpec(a, b)
            ? 'Same year, make, model and colour — one unit number was very likely read wrong, '
              + 'leaving one car on two records.'
            : 'The records disagree on year or colour, so this may be two real cars with close unit '
              + 'numbers — worth confirming against the key tags rather than merging.',
          vehicles: [a, b],
        });
      }
    }
  }

  // ── 5. A Tesla whose key count isn't one ───────────────────────────────────────────────────
  // Not a gap — a contradiction. A Tesla carries exactly one keycard, so any other number means the
  // record is wrong or the card is gone, and a gone card means the car cannot be driven at all.
  for (const v of vehicles) {
    if (!v.isTesla) continue;
    if (v.keyCount === null || v.keyCount === undefined) continue;   // never counted is a gap, not a contradiction
    if (v.keyCount === TESLA_KEYCARD_COUNT) continue;
    findings.push({
      // ⚠️ Keyed on the PLATE, not the row id. The contract at the top of this file says keys derive
      // from identifiers so a dismissal survives a record being re-registered — and this one quietly
      // broke it (found at /reflect 59, the same "documented a property the code doesn't uphold"
      // shape as R58's cascade-race comment, two days running).
      key: `tesla-key-count:${normalizePlate(v.licensePlate)}`,
      kind: 'tesla-key-count',
      title: `${v.licensePlate} is a Tesla recorded with ${v.keyCount} keycards`,
      detail: v.keyCount < TESLA_KEYCARD_COUNT
        ? 'A Tesla cannot be driven without its card — if it is genuinely missing, this car is grounded.'
        : 'A Tesla carries exactly one keycard, so this count cannot be right.',
      vehicles: [v],
    });
  }

  // ── 6. A plate that disagrees with the branch that owns it ─────────────────────────────────
  // Aaron's design (2026-08-21): "that's why we double check, with the owning. ABCD123 paired with
  // toronto good. but if it read ABC0123 and toronto, then it should know that its not a 0 it may
  // be an O, so surface to get actual eyes to make the call."
  //
  // ⭐⭐ IT NAMES THE DISAGREEMENT AND REFUSES TO NAME A CULPRIT, and that rule was bought the hard
  // way. Validating this against the live fleet turned up exactly one one-off case — 0ES919, an
  // Alberta-shaped plate on a car owned by 8199 Winnipeg — and I wrote into the spec that the check
  // should suggest "OES919". Aaron read the key tag: CALG / 08193, with 0ES919 printed on it. The
  // OWNING CODE was the bad value. Acting on that suggestion would have overwritten a correct plate.
  // The data cannot tell you which half is wrong; that is the entire reason a human looks at the tag.
  //
  // The discriminator is DISTANCE, and on the live fleet it separated the two cases perfectly:
  // 125 plates matched their owning branch's shape, ONE was a single character off (the misread),
  // and FOUR were two or more off — genuinely re-plated cars, which must stay silent or the board
  // fills with permanent noise and stops being read at all.
  for (const v of vehicles) {
    if (claimed.has(v.id)) continue;
    const expected = expectedPlateShape(v.owningArea);
    if (!expected) continue;                       // unknown branch, or one whose own fleet disagrees
    const shape = plateShape(v.licensePlate);
    // A different LENGTH is a different format, not a misread: a misread swaps a character, it does
    // not add or drop one — and same-length is what the one-off distance was measured on.
    if (shape.length !== expected.length) continue;
    let off = 0;
    for (let i = 0; i < expected.length; i++) if (shape[i] !== expected[i]) off++;
    if (off !== 1) continue;                       // 0 = agrees; 2+ = really wearing another province
    findings.push({
      key: `plate-owning:${normalizePlate(v.licensePlate)}`,
      kind: 'plate-owning',
      title: `${v.licensePlate} does not match the plates ${owningLabel(v.owningArea)} issues`,
      detail: `Cars owned there read ${expected}; this one reads ${shape} — one character apart. `
        + 'Either the plate or the owning number was read wrong, and only the key tag can say which.',
      vehicles: [v],
    });
  }


  return findings
    .filter(f => !gone.has(f.key))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key));
}

/** One line for the collapsed header. Zero findings is the goal state, and should read like one. */
export function auditSummary(findings: readonly FleetAuditFinding[]): string {
  if (findings.length === 0) return 'Nothing needs a look';
  return findings.length === 1 ? '1 record needs a look' : `${findings.length} records need a look`;
}

export { describe as describeAuditVehicle };
