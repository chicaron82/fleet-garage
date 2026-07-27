// The airport-flip capture list — an ephemeral shift-scoped tally Aaron keeps when there's no HIR
// on the lot and he's turning around returns himself: scan a tag, jot odo + fuel + whether it's
// damaged, and at the end copy a tight text block for the counter to close the rentals.
//
// Deliberately EPHEMERAL and MINIMAL (Aaron, 2026-07-17): the counter is a human who searches by
// plate, so the copy-out carries only what they need to act — plate, odo, fuel, damage flag. FG
// captures the FULL vehicle detail separately (register/backfill on the same scan), but that's for
// the fleet database, not the counter. Two outputs, two fidelities, one scan.

export interface FlipRow {
  id: string;
  /** The counter's search key — the only vehicle identifier in the copy-out. */
  plate: string;
  /** Kept for the on-screen row (not the copy-out); null when the tag didn't carry it. */
  unit: string | null;
  /** Free text as read off the dash — no unit assumed (miles vs km is the counter's to know). */
  odo: string;
  /** Free text — "7/8", "F", "1/2" off a gas gauge, or "67%" off an EV's dash (see isEv). */
  fuel: string;
  /** True when this return is an EV — the capture read a battery PERCENTAGE, not a fuel fraction,
   *  so the counter line says "charge 67%" instead of "fuel 67%". Same field, right word. */
  isEv: boolean;
  damaged: boolean;
  /** Rental class read off the tag (Q4, P4, V…). For AARON's own shift tally — how many of each
   *  class he turned around — NOT the counter copy-out (they search by plate; class is internal).
   *  Blank when the tag's class corner wasn't legible. */
  rentalClass: string;
  /** Free-text condition note for the counter — the odd thing worth flagging ("weed smell",
   *  "child seat left in back"). Blank by default; rides the copy-out only when filled. */
  notes: string;
  /** Selected for the next copy-out. New rows start checked (flipped it → send it). */
  checked: boolean;
  /** Already copied for the counter — locked out of future copies so nothing double-sends. */
  sent: boolean;
  /** Epoch ms of this ROW's last mutation — the merge key for cross-device reconciliation.
   *  Per-row rather than per-list: two devices adding DIFFERENT cars aren't in conflict at all,
   *  and whole-list last-write-wins invented one (see mergeFlipRows). 0 for a row written by a
   *  build older than this field, so any stamped edit beats it. */
  at: number;
  /** Tombstone. A removed row is KEPT (flagged) rather than spliced, because a merge that only
   *  unions ids would resurrect it from the other device's stale copy. Filtered out of everything
   *  the operator sees; garbage-collected for free by the shift-day expiry. */
  deleted: boolean;
}

/** One counter line: plate first (their search key), then only the fields that were filled. */
export function flipRowLine(row: FlipRow): string {
  // Nullish-guarded on every text field: a row hydrated from sessionStorage written by an OLDER
  // build can lack a field added since (notes shipped after the first rows were saved → a bare
  // `.trim()` crashed the whole My Shift render, 2026-07-17). Belt to normalizeFlipRow's suspenders.
  const parts = [(row.plate ?? '').trim()];
  if ((row.odo ?? '').trim()) parts.push(`odo ${(row.odo ?? '').trim()}`);
  if ((row.fuel ?? '').trim()) parts.push(`${row.isEv ? 'charge' : 'fuel'} ${(row.fuel ?? '').trim()}`);
  if (row.damaged) parts.push('⚠️ damage');
  if ((row.notes ?? '').trim()) parts.push((row.notes ?? '').trim());
  return parts.join(' · ');
}

/** Heal a row hydrated from storage into the CURRENT shape — every field defaulted, so a row
 *  saved by an older build (missing a field added since) can never crash a render. The real fix
 *  for "added a field to a persisted shape"; the caller runs it on load. */
export function normalizeFlipRow(r: Partial<FlipRow>): FlipRow {
  return {
    id: r.id ?? crypto.randomUUID(),
    plate: r.plate ?? '',
    unit: r.unit ?? null,
    odo: r.odo ?? '',
    fuel: r.fuel ?? '',
    isEv: r.isEv ?? false,
    damaged: r.damaged ?? false,
    rentalClass: r.rentalClass ?? '',
    notes: r.notes ?? '',
    checked: r.checked ?? true,
    sent: r.sent ?? false,
    at: r.at ?? 0,
    deleted: r.deleted ?? false,
  };
}

/** Reconcile this device's rows with the server's — the fix for cross-device flip loss.
 *
 *  The bug (found in the 2026-07-26 line-check, never hit live): the sync stored ONE payload and
 *  resolved conflicts by whole-list last-write-wins, while the server pull ran once per shift-day.
 *  So a device that was open before another device wrote would push its stale list and silently
 *  drop the other's flips — phone flips A, computer flips B, phone (still alive in the pocket)
 *  flips C and pushes [A,C]; B is gone. Offline-first lost the other direction the same way.
 *
 *  The mistake was modelling an append-mostly EVENT LOG as a document. Two devices adding
 *  different cars were never in conflict; whole-list LWW manufactured one. So conflicts resolve
 *  PER ROW by `at`, and rows neither side touched simply survive.
 *
 *  Deletes carry tombstones because a plain union would resurrect them from the other side's
 *  stale copy — `remove` is part of the API, so that had to be representable.
 *
 *  Order: this device's rows keep their positions (the list must not reshuffle under him
 *  mid-shift), and rows only the server had are appended. Idempotent and commutative — which is
 *  what makes re-pulling on refocus safe, and that's what actually closes the pickup window. */
export function mergeFlipRows(local: FlipRow[], server: FlipRow[]): FlipRow[] {
  const winner = new Map<string, FlipRow>();
  for (const r of local) winner.set(r.id, r);
  for (const r of server) {
    const mine = winner.get(r.id);
    // Strictly-newer wins, so a tie keeps the local row — deterministic, and a same-millisecond
    // edit on two devices is not a case worth a clock-skew tiebreaker.
    if (!mine || r.at > mine.at) winner.set(r.id, r);
  }
  const merged = local.map(r => winner.get(r.id) ?? r);
  const known = new Set(local.map(r => r.id));
  for (const r of server) if (!known.has(r.id)) merged.push(winner.get(r.id) ?? r);
  return merged;
}

/** Do two row lists carry the same rows at the same versions? Lets the hydrate skip a pointless
 *  write when a merge changed nothing — without it, two devices would ping-pong reconciliations. */
export function sameFlipRows(a: FlipRow[], b: FlipRow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => r.id === b[i].id && r.at === b[i].at);
}

/**
 * Aaron's own shift tally: how many of each rental class he turned around, most-flipped first.
 * Only rows whose tag carried a class are counted; `unclassed` is the rest, so the tally never
 * implies every flip was classed when some tags weren't legible (observation-boundary honesty).
 */
export function flipClassSummary(rows: FlipRow[]): { byClass: { rentalClass: string; count: number }[]; unclassed: number } {
  const counts = new Map<string, number>();
  let unclassed = 0;
  for (const r of rows) {
    const c = (r.rentalClass ?? '').trim().toUpperCase();
    if (!c) { unclassed++; continue; }
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const byClass = [...counts.entries()]
    .map(([rentalClass, count]) => ({ rentalClass, count }))
    .sort((a, b) => b.count - a.count || a.rentalClass.localeCompare(b.rentalClass));
  return { byClass, unclassed };
}

/** The copy-out text for a set of rows (the caller passes the checked-and-unsent ones). Empty
 *  string when there's nothing to send, so the caller can skip the clipboard write. */
export function buildFlipReport(rows: FlipRow[]): string {
  return rows.map(flipRowLine).join('\n');
}
