// The backfill run — one screen, one hold at a time, until the queue is empty.
//
// ⭐ THE JOURNEY AARON DESCRIBED, not the one the schema suggested: "easier to back fill them, which
// I can do on my spare time." The screen that matters is not a field inside one hold's editor — it
// is getting through a list of 251. Design for the backlog and the single-hold case falls out for
// free; the reverse is not true, which is why this exists as its own screen.
//
// ⚠️ The note's suggested panels are drawn as a DASHED OUTLINE and are not selected. He confirms by
// tapping. The rule is the one the plate ↔ owning check cost me: a machine that cannot be sure must
// surface the choice, because a pre-selected guess gets confirmed without being read.
import { useMemo, useRef, useState } from 'react';
import { VehicleName } from '../shared/VehicleName';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { zoneBackfillQueue, zonesSetAside, toggleZone, zoneLabel, orderZones, presetFor, vehicleDamageZones } from '../../lib/damageZones';
import { zonesFromNote } from '../../lib/zoneFromNote';
import { DamageZoneMap } from './DamageZoneMap';
import type { Hold } from '../../types';

/** A hold plus the unit number the mock-row guard needs. */
type QueueItem = Hold & { unitNumber: string | null };

const CARD = 'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900';

export function DamageZoneBackfillView({ onBack }: { onBack: () => void }) {
  const { holds, allVehicles, editHoldDamageZones, markZonesReviewed } = useVehicleHoldContext();

  // Snapshot the queue ONCE. Saving a hold removes it from the live list, and a queue that
  // re-derives would renumber and reshuffle under him mid-pass — "12 of 251" has to mean something.
  //
  // ⚠️ But once holds have LOADED, not on the first render. Snapshotting an empty array — which is
  // what a cold load of /damage-zones gives you — froze the run at "Nothing left to tag" until he
  // navigated away and back. He normally arrives via the dashboard card, which cannot render before
  // the holds exist, so the bug hid behind the happy path (found at /reflect 61).
  const snapshot = useRef<QueueItem[] | null>(null);
  const queue = useMemo(() => {
    if (snapshot.current) return snapshot.current;
    if (holds.length === 0) return [];              // still loading — take no snapshot yet
    snapshot.current = zoneBackfillQueue(holds.map(h => ({
      ...h,
      unitNumber: allVehicles.find(v => v.id === h.vehicleId)?.unitNumber ?? null,
    })), h => {
      const g = zonesFromNote(h.notes);
      return g.certain ? 0 : g.candidates.length > 0 ? 1 : 2;
    });
    return snapshot.current;
  }, [holds, allVehicles]);

  const [i, setI] = useState(0);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(0);
  // Armed by a first tap, same as the change-log undo. The objection that kept "nothing to mark" out
  // of the design was that a stray tap could bury a REAL damage hold — so it costs two taps, and the
  // done screen still names how many were set aside.
  const [armed, setArmed] = useState(false);
  const [aside, setAside] = useState(0);

  const hold = queue[i];
  const vehicle = allVehicles.find(v => v.id === hold?.vehicleId);
  const guess = useMemo(() => zonesFromNote(hold?.notes), [hold]);
  const preset = presetFor(hold?.holdTypes);

  // ⭐ What is ALREADY tagged on this car, from its OTHER holds. Without it, a car arriving for its
  // second damage record looks identical to one whose tag failed to save — which is exactly how it
  // read to Aaron. Seeing the panel he already recorded turns "did that not stick?" into "right,
  // this one is a different hold on the same car."
  const alreadyOnCar = useMemo(() => {
    if (!hold) return [];
    return vehicleDamageZones(holds.filter(h => h.vehicleId === hold.vehicleId && h.id !== hold.id)).zones;
  }, [holds, hold]);

  // Live, not snapshotted: a hold set aside during this run shows up in the total immediately.
  const setAsideTotal = useMemo(() => zonesSetAside(holds.map(h => ({
    ...h,
    unitNumber: allVehicles.find(v => v.id === h.vehicleId)?.unitNumber ?? null,
  }))).length, [holds, allVehicles]);

  const advance = () => { setI(n => n + 1); setDraft([]); setErr(''); setArmed(false); };

  /** "There is no panel for this one." Answers the queue's question; touches nothing else. */
  const noneApplies = async () => {
    setBusy(true); setErr('');
    try {
      await markZonesReviewed(hold.id);
      setAside(n => n + 1);
      advance();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const saveAndNext = async () => {
    if (draft.length === 0) { advance(); return; }
    setBusy(true); setErr('');
    try {
      await editHoldDamageZones(hold.id, draft);
      setDone(d => d + 1);
      advance();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  if (!hold) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-4 text-center">
        <p className="text-4xl">🧽</p>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {queue.length === 0 ? 'Nothing left to tag' : `Done — ${done} tagged this run`}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {queue.length === 0
            ? 'Every standing hold already has its panels recorded.'
            : `You went through ${queue.length} hold${queue.length === 1 ? '' : 's'}.`}
        </p>
        {/* ⚠️ Set-aside holds are SKIPPED, never hidden. The whole reason a dismiss was resisted for
            two days is that a real damage hold could vanish behind a tap — so the count is stated
            here, out loud, every time. Nothing quietly disappears from a queue on this screen. */}
        {setAsideTotal > 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {setAsideTotal} hold{setAsideTotal === 1 ? '' : 's'} set aside as having no panel on the
            diagram{aside > 0 ? ` (${aside} this run)` : ''} — still on the record, just not asked about again.
          </p>
        )}
        <button type="button" onClick={onBack}
                className="rounded-lg bg-yellow-500 hover:bg-yellow-400 px-4 py-2 text-sm font-semibold text-gray-900 cursor-pointer">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-5 space-y-4" data-testid="zone-backfill">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack}
                className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:underline cursor-pointer">
          ← Back
        </button>
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 tabular-nums">
          {i + 1} of {queue.length} · {done} tagged
        </p>
      </div>

      <section className={`${CARD} px-4 py-4 space-y-3`}>
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {vehicle?.unitNumber ?? 'Unknown unit'}
            {vehicle && <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">{vehicle.licensePlate}</span>}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{hold.damageDescription}</p>
          {vehicle && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              <VehicleName vehicle={vehicle} /> · {vehicle.color} · {hold.status}
            </p>
          )}
        </div>

        {/* His own note, and the photos. These ARE the source — the zone is only an index, and he
            hand-circles the damage in the picture. Tagging without seeing them would be guessing. */}
        {hold.notes.trim() && (
          <p className="text-sm italic text-gray-500 dark:text-gray-400">"{hold.notes.trim()}"</p>
        )}
        {(hold.photos ?? []).length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {(hold.photos ?? []).map(src => (
              <img key={src} loading="lazy" src={src} alt="" className="h-24 w-24 rounded-lg object-cover shrink-0" />
            ))}
          </div>
        )}

        {alreadyOnCar.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              Already on this car
            </span>
            {alreadyOnCar.map(id => (
              <span key={id}
                    className="rounded-full border border-gray-300 dark:border-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {zoneLabel(id)}
              </span>
            ))}
            <span className="text-[11px] text-gray-400 dark:text-gray-500">· this is a different hold</span>
          </div>
        )}

        {guess.candidates.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            From the note, this could be <strong>{guess.candidates.map(zoneLabel).join(' or ')}</strong> — tap to confirm.
          </p>
        )}

        <DamageZoneMap selected={draft} candidates={guess.candidates}
                       onToggle={id => setDraft(d => toggleZone(d, id))} disabled={busy} />

        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={saveAndNext} disabled={busy}
                  className="rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-gray-900 cursor-pointer">
            {busy ? 'Saving…' : draft.length > 0 ? `Save ${draft.length} & next` : 'Skip'}
          </button>
          {preset && draft.length === 0 && (
            <button type="button" onClick={() => setDraft(orderZones(preset.zones))} disabled={busy}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">
              {preset.label}
            </button>
          )}
          {guess.candidates.length > 0 && draft.length === 0 && (
            <button type="button" onClick={() => setDraft(orderZones(guess.candidates))} disabled={busy}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">
              Accept all {guess.candidates.length}
            </button>
          )}
          {/* ⭐ "No panel applies" — for the faults with nowhere to sit on Vehicle Inspection
              #9000501's diagram: a camera lens proud of its housing, a bed liner eaten by a spill.
              Skip leaves it in the queue forever; this answers the question. Two taps, because the
              risk this design had to earn its way past was a stray one burying real damage. */}
          {draft.length === 0 && (
            armed ? (
              <>
                <button type="button" onClick={() => void noneApplies()} disabled={busy}
                        className="rounded-lg bg-gray-800 dark:bg-gray-200 px-3 py-2 text-sm font-semibold text-white dark:text-gray-900 disabled:opacity-50 cursor-pointer">
                  {busy ? 'Saving…' : 'Confirm — no panel'}
                </button>
                <button type="button" onClick={() => setArmed(false)} disabled={busy}
                        className="text-xs text-gray-400 hover:underline cursor-pointer">Cancel</button>
              </>
            ) : (
              <button type="button" onClick={() => setArmed(true)} disabled={busy}
                      className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">
                No panel applies
              </button>
            )
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {draft.length > 0 ? draft.map(zoneLabel).join(' · ')
              : armed ? 'It stays on the record — the queue just stops asking'
              : 'Nothing tagged — Skip leaves it in the queue'}
          </span>
        </div>
        {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
      </section>
    </div>
  );
}
