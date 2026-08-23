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
import { useMemo, useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { zoneBackfillQueue, toggleZone, zoneLabel, orderZones, presetFor, vehicleDamageZones } from '../../lib/damageZones';
import { zonesFromNote } from '../../lib/zoneFromNote';
import { DamageZoneMap } from './DamageZoneMap';

const CARD = 'rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900';

export function DamageZoneBackfillView({ onBack }: { onBack: () => void }) {
  const { holds, allVehicles, editHoldDamageZones } = useVehicleHoldContext();

  // Snapshot the queue ONCE. Saving a hold removes it from the live list, and a queue that
  // re-derives would renumber and reshuffle under him mid-pass — "12 of 251" has to mean something.
  const queue = useMemo(
    () => zoneBackfillQueue(holds, h => {
      const g = zonesFromNote(h.notes);
      return g.certain ? 0 : g.candidates.length > 0 ? 1 : 2;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [i, setI] = useState(0);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(0);

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

  const advance = () => { setI(n => n + 1); setDraft([]); setErr(''); };

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
              {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color} · {hold.status}
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
              <img key={src} src={src} alt="" className="h-24 w-24 rounded-lg object-cover shrink-0" />
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
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {draft.length === 0 ? 'Nothing tagged — Skip leaves it untouched' : draft.map(zoneLabel).join(' · ')}
          </span>
        </div>
        {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
      </section>
    </div>
  );
}
