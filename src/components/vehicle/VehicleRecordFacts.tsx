import { useState } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { hapticLight } from '../../lib/haptics';
import { useVehicleSightings } from '../../hooks/useVehicleSightings';
import { describeLastSeen, isStaleSighting } from '../../lib/sightings';
import { keyOptionsFor, keyNoun } from '../../lib/keyCount';

// What the record knows about this car's physical handover: the key tag it was READ from, and how
// many keys are on the ring. Both live here (rather than inline in VehicleHistory, which sits at
// the line cap) so the vehicle card has somewhere to grow as more of these facts land.
//
// The tag: Aaron's ask (2026-07-21) — "if it was entered/read wrong can open it up to see what was
// on the tag and correct the details." A vision read can mis-see a plate or unit; without the tag
// there's no way to check a suspect record short of finding the physical car. Tap to enlarge, then
// use the ✏️ identity edit beside it to fix.
//
// The keys: the EXPECTED count the check-in diffs against — and EDITABLE here, because it was
// see-only and a flip count overwrites it. Without a correction path, one miscount at a return
// silently becomes the car's new truth and there's no way back (and no way to rehearse a shortfall
// without permanently lowering a baseline). Same principle as the tag: see it, and be able to fix it.
// Options come from the car, not from a constant: a Tesla carries exactly one keycard, so the
// other three were never answerable. See lib/keyCount.

// The codes: both of the tag's vocabularies for "what kind of car is this" — the 4-char MODEL code
// off the tag's corner (CRHX) and the rental CLASS the branch groups it under (Q4). Aaron asked for
// the model code here (2026-08-20) because it was only ever visible while REGISTERING: the moment
// the car was on record, the code that identified it disappeared from view. The rental class had
// the identical defect — stored, editable in the ✏️ modal, invisible on the card — so it comes too
// rather than leaving an arbitrary half.
//
// Display-only: editing both already lives in the identity modal, and a second edit path for one
// field is how two surfaces start disagreeing. Silent when absent — 155 of the fleet legitimately
// have no code, and a "set me" prompt on every one of them is noise, not a nudge.

export function VehicleRecordFacts({ vehicleId, plate, keytagPhotoUrl, keyCount, isTesla, classCode, rentalClass }: {
  vehicleId: string;
  /** Drives the "last seen" lookup — sightings are keyed on plate, not id (see migrations/114). */
  plate?: string | null;
  keytagPhotoUrl?: string | null;
  keyCount?: number | null;
  /** Drives what the key picker may offer — a Tesla has one card and no alternatives. */
  isTesla?: boolean;
  /** The tag's 4-char model code (CRHX). Null for the ~155 cars whose tag never gave one. */
  classCode?: string | null;
  /** The branch's rental grouping (Q4, B4, C…) — a different axis from the model code. */
  rentalClass?: string | null;
}) {
  const { recordKeyCount } = useVehicleHoldContext();
  const sightings = useVehicleSightings(plate);
  const [zoom, setZoom] = useState(false);
  const [editingKeys, setEditingKeys] = useState(false);

  const setCount = (n: number) => {
    hapticLight();
    setEditingKeys(false);
    void recordKeyCount(vehicleId, n);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {keytagPhotoUrl && (
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          <img src={keytagPhotoUrl} alt="Key tag" className="w-8 h-8 rounded object-cover border border-gray-200 dark:border-gray-700" />
          <span className="text-xs text-gray-500 dark:text-gray-400">🏷️ Key tag as read — tap to check</span>
        </button>
      )}

      {editingKeys ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{isTesla ? '⚡' : '🔑'}</span>
          {keyOptionsFor(isTesla === true).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold border transition cursor-pointer ${keyCount === n ? 'bg-fg-yellow border-fg-yellow text-black' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}
            >
              {n}
            </button>
          ))}
          <button type="button" onClick={() => setEditingKeys(false)} className="ml-0.5 text-xs text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { hapticLight(); setEditingKeys(true); }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          {isTesla ? '⚡' : '🔑'} {keyCount
            ? `${keyCount} ${keyNoun(isTesla === true, keyCount)}`
            : isTesla ? 'Keycard — set' : 'Keys — set'} ✏️
        </button>
      )}

      {(classCode || rentalClass) && (
        <span
          className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 font-mono"
          title={[
            classCode ? `Model code ${classCode} — what the tag's corner reads` : null,
            rentalClass ? `Rental class ${rentalClass} — how the branch groups it` : null,
          ].filter(Boolean).join('\n')}
        >
          🚘 {[classCode, rentalClass].filter(Boolean).join(' · ')}
        </span>
      )}

      {/* Last seen — a SCAN is the only event in FG that means "he was standing at this car with
          the tag in his hand". Read-only: it's a record of what happened, not a field to set.
          Going-forward only (nothing logged scans before 2026-08-16), so "never scanned" is the
          honest day-one state for most of the fleet and reads as *not yet*, not as broken. */}
      <span
        className={`rounded-lg border px-2.5 py-1.5 text-xs ${
          isStaleSighting(sightings)
            ? 'border-amber-300 dark:border-amber-700/60 text-amber-700 dark:text-amber-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
        }`}
        title={sightings.lastSeenAt ? `Last scanned ${new Date(sightings.lastSeenAt).toLocaleString('en-CA')}` : 'No key-tag scan on record yet'}
      >
        👁️ {sightings.neverSeen
          ? 'Never scanned'
          : `Seen ${sightings.count}× · last ${describeLastSeen(sightings.lastSeenAt)}`}
      </span>

      {zoom && keytagPhotoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setZoom(false)}>
          <div className="absolute inset-0 bg-black/80" />
          <img src={keytagPhotoUrl} alt="Key tag" className="relative max-h-[85dvh] max-w-full rounded-lg object-contain" />
          <button
            type="button"
            aria-label="Close"
            onClick={() => setZoom(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl cursor-pointer"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
