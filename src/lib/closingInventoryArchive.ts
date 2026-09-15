// The closing inventory, KEPT — one row per car per close (migration 146).
//
// ⭐⭐ Why this exists, in his words (2026-09-14): *"the inventory is also free data. with it
// especially when we've been full and running a daily backlog we could see how long a clean has been
// sitting at erin st. 3 days. appeared as a clean 3 days in row 3 on inventory. dirty sitting
// un-cleaned for 2. damage sitting for x days still being recorded daily"*
//
// ⚠️⚠️ THE LIVE SHEET IS NOT A RECORD, AND NEVER WAS. `closing_inventories` (137) holds ONE row per
// user with the shift day inside the payload: a stale-day payload reads as nothing, and the next
// night's first save upserts over it. Three closes were entered the weekend of 2026-09-11/12/13 and
// at most the last one can still be in that row. `closingInventorySync` stays exactly as it is — it
// is the live working sheet and it is good at that. This module writes the archive beside it.
//
// ⚠️ GAPS ARE EXPECTED, by his decision: *"i know i don't close, and its not in my near future. but
// data is still data why not add it in when its available. i know there will be gaps."* So anything
// reading these rows counts **recorded closes**, never days — see `presentOnLastCloses`.
import { supabase, writeWithRefresh } from './supabase';
import { currentUserId } from './closingInventorySync';
import type { InventoryEntry, InventoryStatus } from './closingInventory';

/** One archived line. Mirrors the table in migration 146. */
export interface ArchiveRow {
  id: string;
  day: string;
  user_id: string;
  vehicle_id: string | null;
  plate: string;
  unit_number: string | null;
  owning_area: string | null;
  rental_class: string | null;
  status: InventoryStatus;
  lot_row: string;
  note: string;
  seq: number;
}

/**
 * ⭐ `seq` is the entry's index in the FULL array, tombstones included — which is stable because
 * `removeAt` marks rather than splices (see the hook). A visible-only index would renumber every
 * later row the moment he removes one, and the ring groups would drift against the paper.
 */
export function toArchiveRow(entry: InventoryEntry, day: string, userId: string, seq: number): ArchiveRow {
  return {
    id: entry.id,
    day,
    user_id: userId,
    vehicle_id: entry.vehicleId,
    plate: entry.plate,
    unit_number: entry.unitNumber,
    owning_area: entry.owningArea,
    rental_class: entry.rentalClass,
    status: entry.status,
    lot_row: entry.row,
    note: entry.note,
    seq,
  };
}

export interface ArchivePlan {
  upserts: ArchiveRow[];
  /** Ids tombstoned on the sheet — removed from the archive too, so it matches what he actually wrote. */
  deletes: string[];
  /** The new high-water mark: the largest `at` seen. Unchanged when nothing moved. */
  highWater: number;
}

/**
 * What to write, given everything already written up to `since`.
 *
 * ⭐ The sheet already stamps every row with `at` (epoch ms of its last edit) for the per-row merge,
 * so the archive gets its incremental write for free — no diffing, no second bookkeeping field.
 * A 57-car sheet pushes 57 rows once, then one row per edit, instead of 57 rows per keystroke.
 *
 * ⚠️ `at` is a CLIENT clock, which is fine here and would not be for ordering: a row is only ever
 * compared against this device's own previous mark, and a row that slips through late is caught by
 * the next write or the next mount (the plan is idempotent — every write is an upsert by id).
 */
export function planArchive(all: InventoryEntry[], day: string, userId: string, since: number): ArchivePlan {
  const upserts: ArchiveRow[] = [];
  const deletes: string[] = [];
  let highWater = since;
  all.forEach((entry, seq) => {
    if (entry.at > highWater) highWater = entry.at;
    if (entry.at <= since) return;
    if (entry.deleted) deletes.push(entry.id);
    else upserts.push(toArchiveRow(entry, day, userId, seq));
  });
  return { upserts, deletes, highWater };
}

/**
 * Persist the plan. Best-effort, exactly like `saveServerSheet` — the live sheet and the localStorage
 * cache are what he is working from, and a failed archive write must never cost him a scanned car.
 * Returns the high-water mark to carry forward, or `since` unchanged when nothing was written.
 */
export async function archiveSheet(
  all: InventoryEntry[], day: string, since: number,
): Promise<number> {
  try {
    const userId = await currentUserId();
    if (!userId) return since;                       // signed out / offline — retried on the next change
    const { upserts, deletes, highWater } = planArchive(all, day, userId, since);
    if (upserts.length === 0 && deletes.length === 0) return since;
    if (upserts.length > 0) {
      await writeWithRefresh(() => supabase
        .from('closing_inventory_entries')
        .upsert(upserts as unknown as never, { onConflict: 'id' }));
    }
    if (deletes.length > 0) {
      await writeWithRefresh(() => supabase
        .from('closing_inventory_entries')
        .delete()
        .in('id', deletes));
    }
    return highWater;
  } catch {
    // Offline or transient. Returning `since` means the same rows are retried on the next change,
    // which is safe precisely because every write here is an upsert by id.
    return since;
  }
}

/**
 * Drop a day's archived rows — what "Clear the sheet" means for the record.
 *
 * ⚠️ The archive must never outlive the sheet it mirrors. Without this, clearing a botched sheet and
 * starting over would leave the abandoned rows behind, and a dwell count would then be built on cars
 * he had explicitly removed. Divergence is worse than loss here: he would have no way to see it.
 */
export async function clearArchivedDay(day: string): Promise<void> {
  try {
    const userId = await currentUserId();
    if (!userId) return;
    await writeWithRefresh(() => supabase
      .from('closing_inventory_entries')
      .delete()
      .eq('day', day)
      .eq('user_id', userId));
  } catch { /* offline / transient — the sheet is already cleared where he can see it */ }
}
