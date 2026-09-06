// The closing write-up as PLAIN TEXT, for pasting into an email to the counter.
//
// ⭐⭐ AARON ASKED FOR THIS BY POINTING AT SOMETHING THAT ALREADY WORKS: *"how bout a simpler copy to
// paste into an email? much like the airport flips for the counter."* So the grammar here is
// deliberately `flipRowLine`'s — **plate first, because the plate is the counter's search key, then
// only the fields that were actually filled**, joined by ` · `. A format they already read from him.
//
// ⭐ Where it DIVERGES from the flip, on his call: the flip is a flat list, this one is **grouped by
// status**, because that is the shape of the work — the keys are sorted into piles and he writes all
// the available together, then the dirty. At 57 cars a heading per pile is the difference between a
// readable email and a wall.
//
// ⚠️ A car with no rental class or no note simply loses that segment rather than printing a dash or
// a placeholder. Same rule as the flip: an empty field is absent, never rendered as empty.
import { formatUnitNumber, groupEntries, sheetNote, STATUS_LABELS, type InventoryEntry } from './closingInventory';

export interface InventoryReportMeta {
  /** The lot this sheet covers — "Erin St", not the branch code; the counter thinks in places. */
  location: string;
  /** Already formatted; this module does not own a clock. */
  dateLabel: string;
}

/**
 * One car: plate first (the counter's search key), then the form's own column order.
 *
 * ⭐⭐ ALL FOUR COLUMNS THE TAG FILLS, not a subset. Aaron, seeing the first version: *"missing some
 * fields, the owning 8199 and unit number 5422795."* He is right, and the omission contradicted this
 * feature's whole premise — the sheet asks for six things per car and the KEY TAG already prints
 * four of them, so a block that drops two is doing the same thing the scan path does when it reads a
 * tag and keeps none of it.
 *
 * ⚠️ The unit is GROUPED the way the tag prints it (`542 2795`), matching his paper and the photo
 * sheet. It costs a plain-digit search for the unit; the plate is the search key, and agreeing with
 * the artifact in his hand is worth more than agreeing with a Ctrl-F nobody has asked for.
 *
 * ⚠️ Anything the car does not have is ABSENT rather than a placeholder — the flip's rule, and the
 * reason a hand-entered car prints as a bare plate instead of a row of dashes.
 */
export function inventoryReportLine(entry: InventoryEntry): string {
  return [
    entry.plate.trim(),
    (entry.owningArea ?? '').trim(),
    formatUnitNumber(entry.unitNumber),
    (entry.rentalClass ?? '').trim(),
    sheetNote(entry),
  ].filter(Boolean).join(' · ');
}

/**
 * The whole block, ready for the clipboard.
 *
 * ⚠️ Returns an EMPTY STRING when there is nothing written up, exactly like `buildFlipReport` — so
 * the caller can skip the clipboard write instead of copying a header with no cars under it.
 */
export function buildInventoryReport(
  entries: readonly InventoryEntry[],
  meta: InventoryReportMeta,
): string {
  if (entries.length === 0) return '';

  const head = `${meta.location} closing inventory · ${meta.dateLabel} · ${entries.length} ${entries.length === 1 ? 'car' : 'cars'}`;

  // ⭐ The SAME grouping the on-screen sheet draws (`groupEntries`) — the empty-status rule and the
  // legend order both live there now. Aaron expected one document, so there is one rule.
  const groups = groupEntries(entries).map(g => [
    `${STATUS_LABELS[g.status].toUpperCase()} (${g.rows.length})`,
    ...g.rows.map(r => inventoryReportLine(r.entry)),
  ].join('\n'));

  return [head, ...groups].join('\n\n');
}
