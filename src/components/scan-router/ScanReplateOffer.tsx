import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { classifyPlateDifference } from '../../lib/plateDifference';
import { useRoutedProp } from '../../hooks/useRoutedProp';
import type { Vehicle } from '../../types';

// "New plates on this car?" — the one case where the TAG is more current than the record.
//
// Aaron, 2026-08-26, with a Suburban that came from Calgary on `0GK641` and got MB plates that day:
// *"i can change the plate info on the vehicle, but what about the tag?"* He could — by hand, on the
// record, after noticing. FG resolved the car correctly the whole time (the unit-number fallback
// catches it) and then quietly kept the Alberta plate, because the overlay's rule is *"once a vehicle
// RESOLVED, its record is authoritative for the plate."*
//
// ⭐ That rule is RIGHT for a misread — the cheap reader is ~87.5% on plates, so roughly one read in
// eight resolves correctly via the unit while carrying a wrong plate, and writing that back would
// print a plate the car does not have. It is EXACTLY BACKWARDS for a re-plate. lib/plateDifference
// tells the two apart; this offers the update only in the second case.
//
// ⚠️ OFFERS, NEVER APPLIES. FG's default everywhere is to protect a good record from a bad read —
// the forward-only odometer, first-good-read-wins on the VIN, attach-if-missing on the keytag photo.
// A re-plate is a real-world event, not a data correction, so a person confirms it. One tap.
export function ScanReplateOffer({ vehicle, tagPlate, scanNonce, adoptPlate }: {
  vehicle: Vehicle;
  /** The plate as READ from the tag, already normalized + MB-corrected upstream. */
  tagPlate: string | null | undefined;
  /** Per-scan nonce — a fresh scan of the same car must offer again, not stay "done". */
  scanNonce: string | number;
  adoptPlate: (vehicleId: string, tagPlate: string) => Promise<boolean>;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  useRoutedProp(scanNonce, () => setState('idle'));

  // Recomputed on every render rather than remembered: the classification is a pure function of two
  // strings that are already props, and a remembered verdict is one more thing that can go stale.
  if (classifyPlateDifference(tagPlate, vehicle.licensePlate) !== 'replate') return null;
  const next = (tagPlate ?? '').trim().toUpperCase();

  if (state === 'done') {
    return (
      <p className="text-xs font-semibold mt-1 text-green-700 dark:text-green-400">
        ✓ Plate updated to <span className="font-mono">{next}</span>
      </p>
    );
  }

  return (
    <div className="mt-1.5 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
      {/* Says what it SEES before it asks. "The tag says X, the record says Y" is checkable at a
          glance; "update plate?" is a question he'd have to reconstruct the reason for. */}
      <p className="text-[11px] text-amber-900 dark:text-amber-200">
        Tag reads <span className="font-mono font-semibold">{next}</span> — record has{' '}
        <span className="font-mono font-semibold">{vehicle.licensePlate}</span>.
        {' '}That&apos;s a different plate, not a misread.
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        <button
          type="button"
          disabled={state === 'busy'}
          onClick={async () => {
            hapticLight();
            setState('busy');
            setState(await adoptPlate(vehicle.id, next) ? 'done' : 'failed');
          }}
          /* 44px — gloves on, same standard as the key-count and odometer rows. */
          className="h-11 px-3 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 text-xs font-semibold text-black cursor-pointer transition"
        >
          {state === 'busy' ? 'Updating…' : 'New plates — update'}
        </button>
        {/* No "dismiss". Doing nothing already dismisses it, and the card is gone on the next scan;
            a second button would imply the choice is recorded somewhere, and it isn't. */}
        {state === 'failed' && (
          <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
            Didn&apos;t save — the record may have changed. Try again.
          </span>
        )}
      </div>
    </div>
  );
}
