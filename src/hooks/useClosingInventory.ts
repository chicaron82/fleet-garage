// The closing-inventory SESSION — the state a write-up accumulates while he works down a pile of
// keys. All the rules live in `lib/closingInventory`; this only remembers what has been scanned and
// what the next scan should inherit.
//
// ⭐⭐ THE TWO CARRIES ARE THE WHOLE POINT, and they are not the same thing:
//   • STATUS carries because the keys are sorted into piles — a run of one status is the normal
//     shape of the work, and two people split clean from dirty.
//   • ROW carries only for an AVAILABLE car, because a row is a PLACE. On his Sept 1 sheet he writes
//     `R-5` once and brackets it down the rows beneath.
//
// ⚠️ And the row he is carrying is NOT where the available cars are. He caught exactly that on his
// phone — *"I have available cars in 3 different rows but only shows the last row I used."* The
// carry is what the next car inherits; `rowTally` is where they actually are. Both are exposed, and
// they are never conflated.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { businessDateOf } from '../lib/shiftDay';
import { loadSession, saveSession, clearSession } from '../lib/closingInventoryStore';
import {
  entryFromScan, entryFromTag, handEntry, rowTally, summarise,
  type ActiveHold, type InventoryEntry, type InventoryStatus, type TagIdentity,
} from '../lib/closingInventory';
import type { Vehicle } from '../types';

export interface ClosingInventoryState {
  entries: InventoryEntry[];
  /** What the NEXT scan inherits. Null before he has chosen anything. */
  carriedStatus: InventoryStatus | null;
  carriedRow: string;
  /** Where the available cars actually ARE, per row, against capacity. */
  tally: ReturnType<typeof rowTally>;
  counts: ReturnType<typeof summarise>;
  /** Available cars already placed, by row — feeds the row SUGGESTION so a full row rolls on. */
  filled: Record<string, number>;
  addScan: (v: Vehicle, holds: readonly ActiveHold[]) => ReturnType<typeof entryFromScan>;
  /** The same for a car FG has never seen — built from the TAG, no fleet record needed. */
  addTag: (tag: TagIdentity) => ReturnType<typeof entryFromTag>;
  commit: (entry: InventoryEntry) => void;
  addByHand: (plate: string, status: InventoryStatus) => void;
  updateAt: (index: number, patch: Partial<InventoryEntry>) => void;
  removeAt: (index: number) => void;
  /** ⭐ Take the last row back off — a MIS-ENTRY, which is a different thing from removeAt's
   *  "a driver took that car". Same effect on the sheet, different reason. */
  undoLast: () => void;
  setCarriedRow: (row: string) => void;
  clear: () => void;
}

export function useClosingInventory(): ClosingInventoryState {
  /**
   * ⚠️⚠️ THE SHEET IS PERSISTED, AND THE REASON IS A BUG THAT ALREADY HAPPENED ONE SECTION DOWN.
   * The airport flip kept its session in `sessionStorage`, which dies with the PROCESS rather than
   * the shift — Android reclaimed the backgrounded PWA and Aaron's card showed 2 flips where he had
   * recorded about 7 (2026-07-19). This surface was carrying the same risk in a worse place: plain
   * `useState`, nothing persisted, on a write-up that runs to 57 cars.
   *
   * ⭐ Lazy init, so the sheet is on screen in the first paint rather than flashing empty and
   * filling in — a restored sheet that appears late reads as a lost one.
   */
  const today = businessDateOf(new Date());
  const [restored] = useState(() => loadSession(today));
  const [entries, setEntries] = useState<InventoryEntry[]>(restored.entries);
  const [carriedStatus, setCarriedStatus] = useState<InventoryStatus | null>(restored.carriedStatus);
  const [carriedRow, setCarriedRow] = useState(restored.carriedRow);

  // ⚠️ Writes on every change rather than on an unmount or a beforeunload: the failure this exists
  // for is the app being KILLED, which runs no cleanup. A save that only happens on a tidy exit
  // protects the case that was never in danger.
  useEffect(() => {
    saveSession(today, { entries, carriedStatus, carriedRow });
  }, [today, entries, carriedStatus, carriedRow]);

  /** Available cars per row, for the row suggestion's roll-to-next-row behaviour. */
  const filled = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of entries) {
      if (e.status !== 'A' || !e.row) continue;
      out[e.row] = (out[e.row] ?? 0) + 1;
    }
    return out;
  }, [entries]);

  const tally = useMemo(() => rowTally(entries), [entries]);
  const counts = useMemo(() => summarise(entries), [entries]);

  /**
   * Build the row a scan produces — WITHOUT committing it. He still has to look at it.
   *
   * ⚠️ Deliberately not a setState: a scan that turns out to be a sale car gets skipped, and a
   * status FG could not derive needs his tap before there is anything to add.
   */
  const addScan = useCallback(
    (v: Vehicle, holds: readonly ActiveHold[]) =>
      entryFromScan(v, holds, { status: carriedStatus, row: carriedRow, filled }),
    [carriedStatus, carriedRow, filled],
  );

  /**
   * ⭐⭐ The same, for a car FG has never seen — built from the TAG rather than a fleet record.
   *
   * Aaron: *"a plate that FG hasn't seen, why wouldn't FG just record the tag anyway."* The scanner
   * reads owning area, unit, licence and class off the tag; none of that needs a `vehicles` row to
   * land on the sheet, and telling him to write it on paper threw all four away.
   */
  const addTag = useCallback(
    (tag: TagIdentity) => entryFromTag(tag, { status: carriedStatus, row: carriedRow, filled }),
    [carriedStatus, carriedRow, filled],
  );

  /** Accept a row onto the sheet, and let it set the carries for whatever comes next. */
  const commit = useCallback((entry: InventoryEntry) => {
    setEntries(prev => [...prev, entry]);
    setCarriedStatus(entry.status);
    // ⚠️ Only an AVAILABLE car updates the row carry. A dirty car's note is a reason, not a place,
    // so letting it clear the carried row would make him re-pick R-5 mid-pile.
    if (entry.status === 'A' && entry.row) setCarriedRow(entry.row);
  }, []);

  /** ⭐ The paper never refuses a car — a plate he can read goes on the sheet with no vehicle. */
  const addByHand = useCallback((plate: string, status: InventoryStatus) => {
    const e = handEntry(plate, status);
    setEntries(prev => [...prev, e]);
    setCarriedStatus(status);
  }, []);

  const updateAt = useCallback((index: number, patch: Partial<InventoryEntry>) => {
    setEntries(prev => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }, []);

  const removeAt = useCallback((index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * ⭐⭐ UNDO-LAST AND REMOVE-AT ARE NOT THE SAME OPERATION, and the mock had only the first.
   * Undo is *"I entered that wrong"*; remove is *"sometimes drivers need a vehicle that i've already
   * written up"* — the world changed. Both shrink the sheet; only one is a correction.
   *
   * ⚠️ The CARRIES are deliberately left alone. He is mid-pile either way, and resetting the status
   * he is carrying because he fixed a typo would make him re-pick it for the next car.
   */
  const undoLast = useCallback(() => {
    setEntries(prev => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    setCarriedStatus(null);
    setCarriedRow('');
    // ⚠️ Clear the STORE too, not just the state — otherwise "Clear the sheet" would be undone by
    // the next reload, which is the most confusing possible outcome of a destructive button.
    clearSession();
  }, []);

  return {
    entries, carriedStatus, carriedRow, tally, counts, filled,
    addScan, addTag, commit, addByHand, updateAt, removeAt, undoLast, setCarriedRow, clear,
  };
}
