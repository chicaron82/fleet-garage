import { VehicleName } from '../shared/VehicleName';
import { vehicleCodesLine } from '../../lib/vehicleName';
import { scanStatusLine, TONE_TEXT } from '../../lib/scanStatusLine';
import type { Vehicle } from '../../types';

// WHAT THE CAR IS — plate, unit, name, codes, status. The top of the scan card.
//
// ⭐ AND IT OPENS THE RECORD. Aaron, 2026-10-10: *"Tapping the car info on top opens the record
// instead of scrolling down to tap 'view unit'."* On a damaged car "View unit" sits under the hold
// lines, the damage map and the capture rows; the thing he is looking at when he wants the record is
// this block. A stray tap here only navigates — Back undoes it — which is the one kind of tap the
// scroll path is allowed to take (see ScanFactChips).
//
// Lifted out of ScanIdentityCard with that change (docs/October/ticket-scan-card-header-chips.md):
// the plate line sat outside the card's found/not-found branch and the rest inside it, so one tap
// target needed them in one place. `span`s rather than `p`s because a button holds phrasing content.
export function ScanIdentityHeader({ plateLine, vehicle, liveHolds, onOpen }: {
  /** The record's plate once a car resolved, else what was read — decided by the card. */
  plateLine: string;
  vehicle: Vehicle | null;
  liveHolds: number;
  /** Opens the record. Omitted, or no car resolved → plain text, nothing to open. */
  onOpen?: () => void;
}) {
  const lines = (
    <>
      <span className="block font-mono font-semibold text-gray-900 dark:text-gray-100">{plateLine}</span>
      {vehicle && (
        <>
          <span className="block text-xs text-gray-600 dark:text-gray-300">
            {/* ⚠️ Same miss as the record header, and worse here: this is the sheet he is
                reading STANDING AT THE CAR, deciding what it is. `VehicleName`'s own
                header calls that out by name — "above all the scan sheet" — and the scan
                sheet was still joining the fields by hand. */}
            <VehicleName vehicle={vehicle} />{vehicle.color ? ` · ${vehicle.color}` : ''}
          </span>
          {/* ⭐ THE TRANSCRIPTION LINE (2026-09-17, `ticket-scan-card-class-and-code.md`). Aaron
              reads this card as inspection-slip prep while the driver is still writing the tag info
              onto the gas sheet — *"so i don't have to wait for the driver to hand me the keytag"* —
              and the model code and class were the only two fields it did not give him. FG held both
              the whole time. MONO for the same reason the plate line above is mono: these get copied
              onto paper character-for-character, not read for comprehension. */}
          <span className="block font-mono text-xs text-gray-700 dark:text-gray-300 mt-0.5">
            {vehicleCodesLine(vehicle)}
          </span>
          {/* Derived from the vehicle's STATUS, never from the hold count — see
              scanStatusLine.ts. The count only adds a suffix. */}
          {(() => {
            const line = scanStatusLine(vehicle.status, liveHolds);
            return <span className={`block text-xs font-semibold mt-0.5 ${TONE_TEXT[line.tone]}`}>{line.text}</span>;
          })()}
        </>
      )}
    </>
  );

  if (!vehicle || !onOpen) return lines;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Open the record"
      className="w-full flex items-center gap-2 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
    >
      <span className="flex-1 min-w-0">{lines}</span>
      <span aria-hidden="true" className="text-xl leading-none text-gray-400 dark:text-gray-500">›</span>
    </button>
  );
}
