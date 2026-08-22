// A hold's damage zones on the record card: the at-a-glance chips, and the diagram behind an
// "Edit" tap. Kept out of HoldRecordCard because that file sits at the 330-line cap.
//
// ⭐ THE READ-BACK IS HALF THE FEATURE. Data you can write but never see is worse than not
// collecting it — the chips are why tagging 441 holds is worth an evening. They show even when
// nothing is tagged, because "no zones recorded" is itself the thing the backfill is hunting.
import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { orderZones, toggleZone, zoneLabel } from '../../lib/damageZones';
import { DamageZoneMap } from './DamageZoneMap';
import type { Hold } from '../../types';

export function HoldDamageZones({ hold }: { hold: Hold }) {
  const { editHoldDamageZones } = useVehicleHoldContext();
  const saved = orderZones(hold.damageZones ?? []);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(saved);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Staged, not live: a tap is cheap and a write is not, and he will tap several panels in a row.
  // Opening the editor re-seeds from the row rather than trusting stale draft state.
  const startEdit = () => { setDraft(saved); setErr(''); setOpen(true); };
  const changed = draft.join('|') !== saved.join('|');

  const save = async () => {
    if (!changed) { setOpen(false); return; }
    setBusy(true); setErr('');
    try {
      await editHoldDamageZones(hold.id, draft);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the damage zones.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2" data-testid="hold-damage-zones">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Where
        </span>
        {saved.length === 0 ? (
          <span className="text-xs text-gray-400 dark:text-gray-500 italic">Not recorded</span>
        ) : (
          saved.map(id => (
            <span key={id}
                  className="rounded-full border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              {zoneLabel(id)}
            </span>
          ))
        )}
        <button type="button" onClick={open ? () => setOpen(false) : startEdit}
                className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 hover:underline cursor-pointer">
          {open ? 'Cancel' : saved.length === 0 ? 'Add' : 'Edit'}
        </button>
      </div>

      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
          {/* His own words, right beside the diagram — 101 of 441 holds already say where the
              damage is in the notes, and reading it while tapping is the whole backfill. */}
          {hold.notes.trim() && (
            <p className="mb-1 text-xs italic text-gray-500 dark:text-gray-400">"{hold.notes.trim()}"</p>
          )}
          <DamageZoneMap selected={draft} onToggle={id => setDraft(d => toggleZone(d, id))} disabled={busy} />
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={save} disabled={busy}
                    className="rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-gray-900 cursor-pointer">
              {busy ? 'Saving…' : changed ? 'Save' : 'Done'}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {draft.length === 0 ? 'No panels tagged' : `${draft.length} tagged`}
            </span>
          </div>
          {err && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{err}</p>}
        </div>
      )}
    </div>
  );
}
