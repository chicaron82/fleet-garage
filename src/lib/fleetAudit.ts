// "Needs a look" — the contradictions FG already has the evidence to spot (2026-08-19).
//
// Aaron found two duplicate vehicles by asking a question, not by using a screen: unit 5421656
// registered twice as LUR143 and LURL43, and unit 5738117 as 0EJ761 and OEJ761. One car each,
// entered twice off a SINGLE MISREAD CHARACTER. Both had sat in the live fleet for months, and
// nothing in FG was ever going to mention them.
//
// ⭐ THE DESIGN CHOICE THAT MATTERS: the plate check does NOT validate against provincial formats.
// I don't reliably know them (I guessed at "Saskatchewan" earlier today and was wrong), and a fleet
// that takes one-ways from four provinces would make a format whitelist rot immediately. Instead it
// looks for the failure mode that actually happened: **two live plates that are the same string once
// the OCR-confusable characters are collapsed.** No provincial knowledge required, and it catches
// exactly the pair that got past everything.
//
// It PROPOSES, it never fixes. A wrong auto-merge would eat a damage record — the one thing FG
// exists to prevent (project_fg_old_damage_amnesia). Every finding names the records and leaves the
// call to the operator.

import { TESLA_KEYCARD_COUNT } from './keyCount';

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
}

export type FleetAuditKind = 'duplicate-unit' | 'duplicate-plate' | 'confusable-plate' | 'tesla-key-count';

export interface FleetAuditFinding {
  /** Stable across runs so a dismissal sticks. Derived from the kind + the identifiers, never from
   *  row ids or ordering — a re-registered car must not resurrect a finding he already settled. */
  key: string;
  kind: FleetAuditKind;
  title: string;
  detail: string;
  vehicles: AuditVehicle[];
}

/** Characters a vision read swaps for each other. Deliberately TIGHT — every pair here is one that
 *  actually bit us or is a textbook confusion. A loose set would flag half the fleet. */
const CONFUSABLE: Record<string, string> = {
  O: '0',           // OEJ761 → 0EJ761 (real, 2026-05)
  I: '1', L: '1',   // LURL43 → LUR143 (real, 2026-07)
  S: '5', B: '8', Z: '2', G: '6',
};

export function normalizePlate(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Collapse a plate to its confusable-class form, so LUR143 and LURL43 land on the same string. */
export function confusableKey(raw: string | null | undefined): string {
  return normalizePlate(raw).split('').map(c => CONFUSABLE[c] ?? c).join('');
}

function describe(v: AuditVehicle): string {
  return `${v.licensePlate} · ${v.year} ${v.make} ${v.model} · ${v.color}`;
}

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
  const norm = (s: string) => s.trim().toLowerCase();
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

  // ── 4. A Tesla whose key count isn't one ───────────────────────────────────────────────────
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
