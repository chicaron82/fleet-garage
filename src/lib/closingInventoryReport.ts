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
import { sheetNote, STATUS_LABELS, type InventoryEntry, type InventoryStatus } from './closingInventory';

export interface InventoryReportMeta {
  /** The lot this sheet covers — "Erin St", not the branch code; the counter thinks in places. */
  location: string;
  /** Already formatted; this module does not own a clock. */
  dateLabel: string;
}

/** The form's own legend order — A D B M F — so the email reads in the order the paper does. */
const GROUP_ORDER: readonly InventoryStatus[] = ['A', 'D', 'B', 'M', 'F'];

/** One car: plate first (the counter's search key), then only what was filled. */
export function inventoryReportLine(entry: InventoryEntry): string {
  return [entry.plate.trim(), (entry.rentalClass ?? '').trim(), sheetNote(entry)]
    .filter(Boolean)
    .join(' · ');
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

  const groups = GROUP_ORDER
    // ⚠️ A status nobody wrote up prints NOTHING — an empty "BODY (0)" heading would read as a claim
    // that the lot was checked for body damage and found clean, which this sheet cannot support.
    .map(status => ({ status, rows: entries.filter(e => e.status === status) }))
    .filter(g => g.rows.length > 0)
    .map(g => [
      `${STATUS_LABELS[g.status].toUpperCase()} (${g.rows.length})`,
      ...g.rows.map(inventoryReportLine),
    ].join('\n'));

  return [head, ...groups].join('\n\n');
}
