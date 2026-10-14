import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { evExceptionNowClause, isEvAssetsHold } from '../../lib/evExceptionNow';
import type { Hold } from '../../types';

// Under an EV-assets hold's own text: where the kit stands at the latest check. The text stays as
// approved; this line is the present tense (Aaron, 2026-10-13, LJF689 — see lib/evExceptionNow).
// Renders nothing for any other hold, and nothing while the kit still matches "both missing".
export function EvExceptionNow({ hold, className = '' }: { hold: Hold; className?: string }) {
  const { vehicles } = useVehicleHoldContext();
  const live = hold.status === 'ACTIVE' || (hold.status === 'RELEASED' && !hold.release?.actualReturn);
  if (!live || !isEvAssetsHold(hold)) return null;
  const vehicle = vehicles.find(v => v.id === hold.vehicleId);
  const clause = vehicle ? evExceptionNowClause(vehicle) : '';
  if (!clause) return null;
  return <p className={`text-xs font-semibold text-amber-700 dark:text-amber-400 ${className}`}>{clause}</p>;
}
