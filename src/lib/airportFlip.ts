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
  const parts = [row.plate.trim()];
  if (row.odo.trim()) parts.push(`odo ${row.odo.trim()}`);
  if (row.fuel.trim()) parts.push(`fuel ${row.fuel.trim()}`);
  if (row.damaged) parts.push('⚠️ damage');
  if (row.notes.trim()) parts.push(row.notes.trim());
  return parts.join(' · ');
}

/** The copy-out text for a set of rows (the caller passes the checked-and-unsent ones). Empty
 *  string when there's nothing to send, so the caller can skip the clipboard write. */
export function buildFlipReport(rows: FlipRow[]): string {
  return rows.map(flipRowLine).join('\n');
}
