import { useEffect, useMemo, useState } from 'react';
import { useLookupRecents } from './useLookupRecents';
import { exactCarId, type CarKeys } from '../lib/exactCarMatch';

/**
 * ⭐ HIS RECENT CARS, ON A SEARCH BOX THAT ISN'T VehicleLookup (2026-11-18,
 * docs/ticket-recent-cars-everywhere-and-restore-from-find.md).
 *
 * Aaron, in Fleet: *"it doesn't show my last search. So I have to retype it"*. Then: *"Anywhere else we missed that
 * doesn't show recent searches?"* Find a car and the bay log's three boxes had them; Fleet, Holds, New Hold and the
 * movement log didn't. It's one list (`lookup_recents`, per user), so a car looked up anywhere is waiting everywhere.
 *
 * - `showRecents`: focused AND empty, the same moment VehicleLookup shows them.
 * - A search that lands on exactly one car by its whole plate or unit counts as a look-up (exactCarId), so a filter box
 *   remembers too. Hosts with a real pick (New Hold, opening a car in Fleet) also call `record` on it.
 *
 * ⚠️ Not on the gas sheet, closing inventory or airport flip: each car there is a NEW one, and a recent invites the same
 * car onto the sheet twice (useLookupRecents' own header says so).
 */
export function useRecentCarsBox(term: string, cars: readonly CarKeys[]) {
  const { recents, record } = useLookupRecents(true);
  const [armed, setArmed] = useState(false);

  const matchId = useMemo(() => exactCarId(term, cars), [term, cars]);
  // The write is the async upsert; its only state change lands after the await.
  useEffect(() => { if (matchId) void record(matchId); }, [matchId, record]);

  return {
    recents,
    record,
    showRecents: armed && !term.trim() && recents.length > 0,
    onFocus: () => setArmed(true),
    // ⚠️ Delayed so a tap on a recent lands before the list closes under the thumb (VehicleLookup's same 200 ms).
    onBlur: () => { setTimeout(() => setArmed(false), 200); },
  };
}
