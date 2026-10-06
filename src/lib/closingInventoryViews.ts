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

/**
 * The saved close disagrees with tonight's inventory — `null` when it doesn't, or when there is no inventory.
 *
 * ⭐ Why (Aaron, 2026-10-05, his first close in a while): the close form SEEDS its two counts from the inventory
 * while it is open, and nothing ever re-reads them after Submit. He saved the close at 22:23 (0 cleans — true
 * then), wrote MCM571 up as a clean at 22:55, and the saved close kept saying 0. *"doesn't it read the
 * inventory? because i logged one clean there"* It had read it — once, half an hour too early. The morning
 * card and the forecast game both read the SAVED close, so the clean he left them was invisible to both.
 *
 * ⚠️ An EMPTY sheet is never a disagreement: no write-up means "I didn't count", not "the lot was empty"
 * (same rule as `seedClosingCounts`, which returns '' for exactly this reason).
 */
export function closeDrift(
  saved: { carsRemaining: number; cleanNotPickedUp: number; loggedAt: string },
  seeded: { queueAtClose: string; cleanNotSent: string },
  lastInventoryChange: number,
): { dirties: number; cleans: number } | null {
  if (seeded.queueAtClose === '' && seeded.cleanNotSent === '') return null;
  // ⚠️⚠️ ONLY A CHANGE MADE AFTER THE SAVE (pass two, same night). The form lets him type over the seeded counts on
  // purpose — a half-finished sweep, the "· edited" marker — and comparing values alone could not tell that apart
  // from the inventory moving on. It would claim "the inventory changed" when it hadn't, and nag him to undo his
  // own correction. An entry's `at` moves on every add, edit and delete (deletes are timestamped tombstones), and a
  // re-save refreshes `logged_at`, so "newest sheet change is later than the save" is exactly the claim the notice makes.
  if (!(lastInventoryChange > Date.parse(saved.loggedAt))) return null;
  const dirties = Number(seeded.queueAtClose) || 0;
  const cleans = Number(seeded.cleanNotSent) || 0;
  if (dirties === saved.carsRemaining && cleans === saved.cleanNotPickedUp) return null;
  return { dirties, cleans };
}
