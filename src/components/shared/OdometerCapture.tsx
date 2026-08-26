import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { parseOdometer, describeOdometer } from '../../lib/odometer';
import { useRoutedProp } from '../../hooks/useRoutedProp';

// The odometer, captured where he's already standing (2026-08-25).
//
// Migration 123 added the column and gave it exactly ONE writer: the airport flip. So a number he
// reads off a dash a dozen times a shift could only reach FG through a surface he uses at the
// airport — and the flip's own sync hadn't fired since Aug 5, which is why the column stood at
// **0 of 683 cars** while `VehicleRecordFacts` faithfully rendered a slot for it on every record.
// A capability reachable from one surface that doesn't fire is, in practice, absent.
//
// Aaron, holding a 2022 Tesla's screen reading 110,451 km: *"let's do the odometer."* The scan is
// the right home — he is at the dash with the tag in his hand, and FG is already recording the
// sighting, the owning area, the class code, the key count and now the VIN in that same beat.
//
// ⚠️ Renders the LAST READING WITH ITS DATE, never a naked number (migration 123's rule). A bare
// "47,200 km" ages into a lie; a figure from April describes a car that has since done a summer of
// rentals. And a lower reading than the one on file is a misread or the wrong car — `recordOdometer`
// refuses it server-side rather than rewriting a good record, so this says so BEFORE he taps.
export function OdometerCapture({ vehicleId, resetKey, currentKm, currentAt, onSave }: {
  vehicleId: string;
  /** What counts as "a new subject", decided by the CALLER — because the two homes mean different
   *  things by it. The SCAN passes its per-scan nonce, because a scan is an EVENT and re-scanning
   *  the same car must still clear the box. The RECORD CARD passes the vehicle id, because there is
   *  no repeat event there — the card simply shows one car, and switching cars is the only reset
   *  worth having. Same control, two honest reset semantics, no second copy. */
  resetKey: string | number;
  currentKm?: number | null;
  currentAt?: string | null;
  onSave: (vehicleId: string, km: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useRoutedProp(resetKey, () => { setDraft(''); setSaved(false); });

  const km = parseOdometer(draft);
  // The write refuses a lower reading; saying so here turns a silent no-op into a caught typo.
  const goesBackwards = km !== null && currentKm != null && km < currentKm;

  const save = async () => {
    if (km === null || goesBackwards) return;
    hapticLight();
    await onSave(vehicleId, km);
    setSaved(true);
  };

  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        🧭 {currentKm != null ? describeOdometer(currentKm, currentAt) : 'Odometer not logged'} —
      </span>
      {saved ? (
        <span className="text-xs font-semibold text-green-700 dark:text-green-400">✓ {km?.toLocaleString()} km saved</span>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void save(); }}
            inputMode="numeric"
            placeholder="km on the dash"
            aria-label="Odometer reading"
            className="w-32 h-11 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fg-yellow"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={km === null || goesBackwards}
            /* 44px, gloves on — the same standard as the key-count row beside it. */
            className="h-11 px-4 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-black cursor-pointer transition"
          >
            Log
          </button>
        </div>
      )}
      {goesBackwards && (
        <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
          Lower than the {currentKm?.toLocaleString()} km on file — check the reading.
        </span>
      )}
    </div>
  );
}
