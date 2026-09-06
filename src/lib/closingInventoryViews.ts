// How the sheet is PRESENTED and handed onward — the piles the table and the report both draw, and
// the two counts the washbay log seeds from. Split from `closingInventory` at the 330-line cap (see
// `closingInventoryLot` for the same move); re-exported there, so callers still see one model.
import { summarise, type InventoryEntry, type InventoryStatus } from './closingInventory';

/** The form's own legend order — A D B M F — so every surface reads in the order the paper does. */
export const GROUP_ORDER: readonly InventoryStatus[] = ['A', 'D', 'B', 'M', 'F'];

/** A row with the position it holds in the SHEET, which is not the position it is drawn in. */
export interface GroupedRow { entry: InventoryEntry; index: number; }
export interface EntryGroup { status: InventoryStatus; rows: readonly GroupedRow[]; }

/**
 * The sheet in piles — ONE rule, shared by the on-screen table and the copied report.
 *
 * ⭐ Aaron, 2026-09-05, after his first real 24-car sweep: *"I thought it was going to sort both my
 * scans AND the version I copy to the email."* Grouping existed, but only in the report — so the
 * table he worked from and the text he sent were two different documents. The fix is not a second
 * sort; it is one rule both call, which is also why they cannot drift apart again.
 *
 * ⚠️⚠️ EVERY ROW CARRIES ITS ORIGINAL INDEX, and callers must use it. `onEdit`/`onRemove` address
 * the sheet by position, so handing them a DISPLAY position would edit or delete a different car
 * than the one under his thumb — silently, and `Undo last` only lifts the newest row, so a wrongly
 * deleted row 3 of 40 is gone. The index is the whole reason this returns pairs and not entries.
 *
 * ⚠️ An empty status prints NOTHING, the same rule the report already held: a "BODY (0)" heading
 * would read as a claim the lot was checked for body damage and found clean, which this cannot say.
 *
 * Scan order is preserved WITHIN each pile — the sort is by status only, never by plate or class.
 */
export function groupEntries(entries: readonly InventoryEntry[]): EntryGroup[] {
  const withIndex = entries.map((entry, index) => ({ entry, index }));
  return GROUP_ORDER
    .map(status => ({ status, rows: withIndex.filter(r => r.entry.status === status) }))
    .filter(g => g.rows.length > 0);
}

/**
 * ⭐⭐ THE CLOSING SHEET'S TWO CARRY-OVER COUNTS, for seeding the washbay log.
 *
 * Aaron, 2026-09-05, dry-running the scanner in the lot: *"now it's all scanned then the cleans and
 * dirty should be filled out here automatically right?"* They should — and he had to spell out why,
 * because the washbay log's field names hide it:
 *
 *   *"rentable on the lot that have been cleaned but not sent to the airport / dirties are returns
 *   from the airport that are now at Erin St. this is what the morning crew will be cleaning."*
 *
 * ⚠️ So **"clean, not picked up" has always meant NOT YET SENT UP** — never "a customer failed to
 * collect it". `washbayLineage` says it outright (*"clean cars not yet sent"*) and it is still the
 * easiest field in FG to misread, because the rental meaning of the words is right there and wrong.
 *
 * **A → the cleans**, sitting at Erin St waiting for a driver to take them up.
 * **D → the queue**, airport returns that are tomorrow morning's work.
 * **B and M belong to neither** — a held car is not washbay work in either direction.
 *
 * ⚠️ AN EMPTY SHEET SEEDS NOTHING, NOT ZERO. "I did not write up a lot" is not the claim "the lot
 * was empty", and a seeded 0 would put that claim into the throughput history and into tomorrow's
 * opening card, which reads both numbers back.
 *
 * ⚠️ Erin St only. The airport closes with its OWN two counts — available cleans parked up there
 * and dirty returns in the return stalls — and FG cannot see them. This is half a branch's picture.
 */
export function seedClosingCounts(entries: readonly InventoryEntry[]): {
  queueAtClose: string; cleanNotSent: string;
} {
  if (entries.length === 0) return { queueAtClose: '', cleanNotSent: '' };
  const by = summarise(entries).byStatus;
  return { queueAtClose: String(by.D), cleanNotSent: String(by.A) };
}
