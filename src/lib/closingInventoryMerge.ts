// Cross-device reconciliation for the closing sheet — the rules that let two devices hold the same
// sheet without either one destroying the other's work. Split from `closingInventory` at the 330-line
// cap, the same way `closingInventoryLot` was; both are re-exported there so callers still see ONE
// model. Consumed by useClosingInventory (hydrate/merge) and closingInventorySync (transport).
import type { InventoryEntry } from './closingInventory';

/** The rows anything outside the store/sync/hook is allowed to see — tombstones are internal. */
export function visibleEntries(all: readonly InventoryEntry[]): InventoryEntry[] {
  return all.filter(e => !e.deleted);
}

/**
 * ⭐⭐ MERGE PER ROW, NEVER WHOLE-LIST. Mirrors `mergeFlipRows` deliberately — same problem, same
 * shape, and the flip's version is the one that survived a real defect (`b93ccda`).
 *
 * ⚠️ Whole-list last-write-wins is not merely coarser here, it is DESTRUCTIVE: a PC opened at home
 * holds an empty sheet, and the moment it wrote, 24 cars scanned at the yard would be gone. Per-row,
 * an empty side simply contributes nothing.
 *
 * Order: this device's rows keep their positions — the sheet must not reshuffle under him mid-pile
 * — and rows only the server had are appended. Idempotent and commutative, which is what makes
 * re-pulling on every refocus safe.
 */
export function mergeEntries(local: readonly InventoryEntry[], server: readonly InventoryEntry[]): InventoryEntry[] {
  const winner = new Map<string, InventoryEntry>();
  for (const e of local) winner.set(e.id, e);
  for (const e of server) {
    const mine = winner.get(e.id);
    // Strictly-newer wins, so a tie keeps local. A same-millisecond edit on two devices is not a
    // case worth a clock-skew tiebreaker.
    if (!mine || e.at > mine.at) winner.set(e.id, e);
  }
  const merged = local.map(e => winner.get(e.id) ?? e);
  const known = new Set(local.map(e => e.id));
  for (const e of server) if (!known.has(e.id)) merged.push(winner.get(e.id) ?? e);
  return merged;
}

/** Same rows at the same versions? Lets a hydrate skip a pointless write, so two devices cannot
 *  ping-pong reconciliations at each other. */
export function sameEntries(a: readonly InventoryEntry[], b: readonly InventoryEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((e, i) => e.id === b[i].id && e.at === b[i].at);
}
