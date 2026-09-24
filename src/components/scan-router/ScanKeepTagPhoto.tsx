import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { classifyPlateDifference } from '../../lib/plateDifference';
import { useRoutedProp } from '../../hooks/useRoutedProp';
import type { Vehicle } from '../../types';

// "Keep this scan as the tag" — for a car flagged "Older plate" whose scan AGREES with the record.
//
// ⭐ Aaron, 2026-09-24: yes to the follow-up of a3e8a55. That fix keeps the scan's photo when a
// re-plate is adopted, but could not reach a car ALREADY flagged before it shipped (unit 5421649 →
// TM169N). For such a car, a scan whose plate matches the record is by definition a photo of the
// current tag — and the stale notice was telling him to "snap the one in your hand" as he held it.
//
// ⚠️ An ACTING component, so it lives beside ScanReplateOffer and not in ScanNotices, whose rule is
// that notices report and never act. One tap; a person decides, same as every photo replace.
//
// ⚠️⚠️ KEYED TO "STALE WHEN THIS SCAN ARRIVED", not to stale now. Adopting a re-plate sets `stale`
// AFTER the scan, for the second or two before its own retake clears it, and in that window the car
// looks exactly like one to offer on. A snapshot per scan nonce keeps the offer out of that window.
// docs/September/ticket-keep-a-matching-scan-as-the-tag.md
export function ScanKeepTagPhoto({ vehicle, tagPlate, tagPhoto, scanNonce, retakePhoto }: {
  vehicle: Vehicle;
  /** The plate as READ from the tag. */
  tagPlate: string | null | undefined;
  /** The photo this scan read the tag from. Null on the typed door → never offers. */
  tagPhoto: string | null | undefined;
  scanNonce: string | number;
  retakePhoto: (vehicleId: string, photo: string) => Promise<boolean>;
}) {
  const [staleAtScan, setStaleAtScan] = useState(vehicle.keytagAuditResult === 'stale');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  useRoutedProp(scanNonce, () => {
    setStaleAtScan(vehicle.keytagAuditResult === 'stale');
    setState('idle');
  });

  // Once tapped, the outcome renders whatever the car says now — the retake CLEARS `stale`, so the
  // live car stops qualifying the instant it succeeds (the same trap ScanReplateOffer fell into).
  if (state === 'idle' && !(
    staleAtScan && tagPhoto && classifyPlateDifference(tagPlate, vehicle.licensePlate) === 'same'
  )) return null;

  if (state === 'done') {
    return (
      <p className="text-xs font-semibold mt-1 text-green-700 dark:text-green-400">
        ✓ Tag photo updated — the older plate&apos;s photo is kept in the record&apos;s history.
      </p>
    );
  }

  return (
    <div className="mt-1.5 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
      <p className="text-[11px] text-amber-900 dark:text-amber-200">
        The photo on file is an older tag — this scan matches the record, so it&apos;s the current one.
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        <button
          type="button"
          disabled={state === 'busy'}
          onClick={async () => {
            if (!tagPhoto) return;
            hapticLight();
            setState('busy');
            setState(await retakePhoto(vehicle.id, tagPhoto) ? 'done' : 'failed');
          }}
          /* 44px — gloves on, same standard as the re-plate offer beside it. */
          className="h-11 px-3 rounded-lg bg-fg-yellow hover:bg-fg-yellow-hi disabled:opacity-40 text-xs font-semibold text-black cursor-pointer transition"
        >
          {state === 'busy' ? 'Saving…' : 'Keep this scan as the tag'}
        </button>
        {state === 'failed' && (
          <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
            Didn&apos;t save — try again.
          </span>
        )}
      </div>
    </div>
  );
}
