// Copying the closing inventory out sets Erin's count to its A/D. Aaron, 2026-10-23: he finished the write-up at 22:37
// with 18 A / 6 D while the top bar still said 22/0 from his 20:48 tap (cars kept going up after it). *"shouldn't my
// header count also match my clean and dirty?"* The sheet is the last count anyone made of the lot, car by car.
//
// ⭐ Copy is the trigger because it is the sheet's only way out: he copies when he's done, so it costs no tap. Each
// change says so with an Undo, the same note the Erin pill's sheet shows.
import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { bayFromInventory } from '../lib/lotBay';
import { initialsOf } from '../lib/lotLookout';
import { useBayTapsSignedIn } from './useBayTaps';
import { useLotBay } from './useLotBay';
import { useUndoNote } from './useUndoNote';

export function useErinFromInventory() {
  const erin = useLotBay();
  const { user } = useAuth();
  const [note, show, clearNote] = useUndoNote();
  const { setBoth } = useBayTapsSignedIn(erin, show, initialsOf(user?.name ?? null));

  const syncErin = useCallback((byStatus: { A: number; D: number }) => {
    const { cleans, dirties } = bayFromInventory(byStatus);
    void setBoth(cleans, dirties);
  }, [setBoth]);

  return { note, clearNote, syncErin };
}
