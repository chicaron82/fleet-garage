// Cars the fleet's own data says are hybrids, that nobody has flagged.
//
// ⭐ SELF-HIDING, like its neighbours. Most days there is nothing here and the section does not
// exist; the point is that when something appears it appears WITHOUT him having to bump into the
// car. Aaron, 2026-08-29: *"that only applies to vehicles that i have personally come across. there
// are probably several more that are different and don't match exactly."*
//
// ⚠️ It offers no button. Flipping the flag from here would be FG deciding a powertrain from two
// fields, and the whole reason this list is short is that those two fields are usually right —
// "usually" is not a licence to write. He taps through to the car and decides.
import { useMemo } from 'react';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { hybridFlagGaps, describeHybridGap } from '../../lib/hybridGaps';
import { VehicleName } from '../shared/VehicleName';

export function HybridGapsSection({ onOpenVehicle }: {
  /** Optional, exactly like ChronicIssuesSection's — the row is a button when a caller can
   *  navigate and plain text when it can't, so the card never depends on being wired up. */
  onOpenVehicle?: (vehicleId: string) => void;
}) {
  const { allVehicles } = useVehicleHoldContext();
  const gaps = useMemo(() => hybridFlagGaps(allVehicles), [allVehicles]);
  if (gaps.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 px-4 py-3 space-y-2 transition-colors">
      <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
        🔋 {gaps.length} car{gaps.length === 1 ? '' : 's'} look{gaps.length === 1 ? 's' : ''} like a hybrid but isn't flagged
      </p>
      <p className="text-[11px] text-amber-700 dark:text-amber-400">
        Found from the fleet's own data, not from a scan — so these are cars you may never have handled.
      </p>
      {/* ⭐ TAPPABLE NOW — the "revisit if this list stops being short" clause, cashed in. The old
          note called the plumbing "more than the feature", and it was wrong about the cost on the
          wrong side of the ledger: what it actually cost was AARON, once per car, every time.
          Aaron, 2026-08-30, on LZM541: *"this isn't tappable. so i have to look this up to make the
          correction."* The card names a car and then makes him go find it by hand — a to-do list
          that can't open its own items.

          ⚠️ Still NO flag button. That part of the original note stands and is unrelated: flipping
          a powertrain from two fields would be FG deciding, and "usually right" is not a licence to
          write. He taps THROUGH to the car and decides there.

          The optional-callback shape is ChronicIssuesSection's, not a new one. */}
      <ul className="space-y-1.5">
        {gaps.map(g => {
          const inner = (
            <>
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{g.vehicle.licensePlate}</span>{' '}
              <VehicleName vehicle={g.vehicle} className="text-xs text-gray-600 dark:text-gray-400" />
              <span className="block text-[11px] text-amber-700 dark:text-amber-400">{describeHybridGap(g)}</span>
            </>
          );
          return (
            <li key={g.vehicle.id}>
              {onOpenVehicle ? (
                <button type="button" onClick={() => onOpenVehicle(g.vehicle.id)}
                  className="w-full text-left px-2 py-1 -mx-2 rounded-lg hover:bg-amber-100/70 dark:hover:bg-amber-900/30 transition cursor-pointer">
                  {inner}
                </button>
              ) : inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
