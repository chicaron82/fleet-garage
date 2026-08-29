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

export function HybridGapsSection() {
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
      {/* ⚠️ NOT TAPPABLE, and that is a scope decision rather than an oversight. MyShiftView takes
          no props and holds no navigation, so linking to a car would mean threading a navigate
          callback through a view that has none — more plumbing than the feature. The plate is the
          useful part; he opens a car the way he opens any car. Revisit if this list ever stops
          being short. */}
      <ul className="space-y-1.5">
        {gaps.map(g => (
          <li key={g.vehicle.id}>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{g.vehicle.licensePlate}</span>{' '}
            <VehicleName vehicle={g.vehicle} className="text-xs text-gray-600 dark:text-gray-400" />
            <span className="block text-[11px] text-amber-700 dark:text-amber-400">{describeHybridGap(g)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
