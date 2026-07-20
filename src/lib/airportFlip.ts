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
  /** Free text — "7/8", "F", "1/2" — whatever he reads off the gauge. */
  fuel: string;
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
}

/** One counter line: plate first (their search key), then only the fields that were filled. */
export function flipRowLine(row: FlipRow): string {
  // Nullish-guarded on every text field: a row hydrated from sessionStorage written by an OLDER
  // build can lack a field added since (notes shipped after the first rows were saved → a bare
  // `.trim()` crashed the whole My Shift render, 2026-07-17). Belt to normalizeFlipRow's suspenders.
  const parts = [(row.plate ?? '').trim()];
  if ((row.odo ?? '').trim()) parts.push(`odo ${(row.odo ?? '').trim()}`);
  if ((row.fuel ?? '').trim()) parts.push(`fuel ${(row.fuel ?? '').trim()}`);
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
    damaged: r.damaged ?? false,
    rentalClass: r.rentalClass ?? '',
    notes: r.notes ?? '',
    checked: r.checked ?? true,
    sent: r.sent ?? false,
  };
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
