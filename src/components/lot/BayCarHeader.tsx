// The car on a bay card, the way the 🔍 popup shows it: its header (plate · Unit, name · colour, the codes line, the
// status; a tap opens the record) and, under it, the damage map. Used by the pick card (BayFindCar) and the In the
// bay card (BayInTheBay). Ticket: docs/ticket-bay-log-first-shift-friction.md.
//
// Aaron, after the Bay log's first full shift (2026-10-30): *"since I've primarily been using that module I don't see
// the damage map and did miss marking damage on a few"*, and *"Also displaying the same info as the find a car / Unit#
// model code, class code"*. The popup had both all along; the bay cards were built beside it and never got them.
//
// ⭐ The SAME components as the popup (ScanIdentityHeader, ScanDamageZones), not copies of their lines, so the bay and
// the popup cannot drift apart again. The live-hold count is the popup's own (scanHoldLines → consolidateDamage).
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { scanHoldLines } from '../../lib/scanHoldSummary';
import { consolidateDamage } from '../../lib/consolidateDamage';
import { formatUnitNumber } from '../../lib/formatUnitNumber';
import { ScanIdentityHeader } from '../scan-router/ScanIdentityHeader';
import { ScanDamageZones } from '../scan-router/ScanDamageZones';
import type { Vehicle } from '../../types';

/** Full width, like the popup: anything beside it squeezes the plate line until the unit number breaks in two. */
export function BayCarHeader({ vehicle, onOpen }: { vehicle: Vehicle; onOpen?: () => void }) {
  const { holds } = useVehicleHoldContext();
  const liveHolds = consolidateDamage(scanHoldLines(holds, vehicle.id)).length;
  return (
    <div className="min-w-0">
      <ScanIdentityHeader
        plateLine={`${vehicle.licensePlate}${vehicle.unitNumber ? ` · Unit ${formatUnitNumber(vehicle.unitNumber)}` : ''}`}
        vehicle={vehicle} liveHolds={liveHolds} onOpen={onOpen} />
      {/* Silent on a clear car; tap a panel for its photo. */}
      <ScanDamageZones holds={holds} vehicleId={vehicle.id} />
    </div>
  );
}
