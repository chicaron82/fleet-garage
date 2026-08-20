import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { hapticLight } from '../../lib/haptics';
import { fmtRelativeDate } from '../../lib/lostFoundDate';

// The note on the car — the tier BELOW a hold (Aaron, 2026-08-20, from the lot).
//
// His reason, which corrected an assumption of mine worth keeping: *"I don't hold every single
// damage in FG. I'm the only user remember. So a damage could also have no record on it. Leaving a
// note addresses that at some point there was damage and it's getting sent fixed."* So `Clear` on
// this record never meant "undamaged" — it meant "nothing held in FG". A hold is a heavy
// instrument (photos, release approval, exception tracking) and plenty of true things about a car
// don't earn one; until now the cheapest thing FG could spend was a whole hold, so the small
// stuff went unrecorded. This makes a sentence affordable.
//
// SEPARATE from VehicleRecordFacts on purpose: that strip is wrapping chips (tag, keys, codes,
// last-seen) and a note is a *sentence* — a different shape that would fight the flex-wrap, and a
// different job. Facts are what the record KNOWS; a note is what he chose to SAY.
//
// Its own row, not tucked in the collapsed change log: a note you have to go find can't do the
// job of "don't go looking for this car, it's at Speedy."
//
// Clearing is NOT deletion — migration 118's trigger logs the note leaving, so the car keeps the
// history in its change trail. If the damage was never held, the note is the only trace it existed.
const MAX = 200;

export function VehicleNote({ vehicleId, note, noteAt }: {
  vehicleId: string;
  note?: string | null;
  noteAt?: string | null;
}) {
  const { setVehicleNote } = useVehicleHoldContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const open = () => { hapticLight(); setDraft(note ?? ''); setErr(false); setEditing(true); };

  const save = async (value: string | null) => {
    setBusy(true); setErr(false);
    try { await setVehicleNote(vehicleId, value); setEditing(false); }
    catch { setErr(true); }
    finally { setBusy(false); }
  };

  if (editing) {
    return (
      <div className="mt-2 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-2.5 space-y-2">
        <textarea
          autoFocus
          value={draft}
          maxLength={MAX}
          onChange={e => setDraft(e.target.value)}
          placeholder="e.g. sent to Speedy for windshield replacement"
          rows={2}
          className="w-full rounded-lg border border-amber-200 dark:border-amber-800/60 bg-white dark:bg-gray-900 px-2.5 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 outline-none resize-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(draft)}
            className="flex-1 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-50 py-2 text-xs font-semibold text-black cursor-pointer"
          >
            {busy ? 'Saving…' : 'Save note'}
          </button>
          {/* Clearing keeps the history — the change trail records the note leaving. */}
          {note && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(null)}
              className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 cursor-pointer disabled:opacity-50"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(false)}
            className="rounded-lg px-2 py-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {err && <p className="text-[11px] text-red-500">Couldn&apos;t save that — try again.</p>}
      </div>
    );
  }

  if (!note) {
    // Quiet when there's nothing to say — most cars have no note, and a loud empty state on every
    // record teaches him to scroll past the one car that does.
    return (
      <button
        type="button"
        onClick={open}
        className="mt-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
      >
        📝 Leave a note
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="mt-2 w-full text-left rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition cursor-pointer"
    >
      <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap break-words">📝 {note}</p>
      {noteAt && (
        <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
          Left {fmtRelativeDate(noteAt)} · tap to edit
        </p>
      )}
    </button>
  );
}
