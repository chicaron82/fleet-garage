import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { ScanReplateOffer } from './ScanReplateOffer';
import type { Vehicle } from '../../types';

/**
 * ⭐⭐ THE RE-PLATE OFFER, FOR ANY SURFACE THAT READS A TAG — one line instead of four props.
 *
 * Aaron, 2026-09-06, holding the tag of unit 5508783 (re-plated LJF682 → MCM565):
 * *"anything that involves scanning a tag that picks it up should work the same when it finds
 * something"*
 *
 * ⚠️ It did not. Six surfaces read a key tag and exactly ONE — the scan router — offered the
 * re-plate. The rest resolve the car by its unit number, do their job, and never mention that the
 * plate in his hand disagrees with the record. Worse than silent on two of them: Lost & Found and
 * the movement log key their rows on the PLATE STRING, so a re-plated car produces a row attached
 * to a plate FG connects to no vehicle — the LUR315 orphan shape, reproduced in the one gap
 * `newVehicleToRegisterOnScan` cannot reach (it fires only for `kind === 'new'`, and a re-plated
 * car resolves as `partial`: known, by unit).
 *
 * ⚠️ STILL AN OFFER, NEVER AN APPLY. `ScanReplateOffer` holds that rule and this only carries it
 * further — a re-plate is a real-world event, so a person confirms it. This wrapper adds no policy;
 * it resolves `adoptPlate` from context so a surface needs no knowledge of how plates are written.
 *
 * Renders nothing when there is no vehicle, no tag plate, or the difference reads as a MISREAD.
 */
export function KeytagReplateOffer({ vehicle, tagPlate, scanNonce }: {
  vehicle: Vehicle | null | undefined;
  tagPlate: string | null | undefined;
  scanNonce: string | number;
}) {
  const { adoptPlate } = useVehicleHoldContext();
  if (!vehicle) return null;
  return (
    <ScanReplateOffer
      vehicle={vehicle}
      tagPlate={tagPlate}
      scanNonce={scanNonce}
      adoptPlate={adoptPlate}
    />
  );
}
