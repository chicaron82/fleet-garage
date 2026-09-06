import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { suggestPlateByShape } from '../../lib/plateShapeResolve';
import { owningLabel } from '../../../api/_lib/owningArea';
import { VehicleName } from '../shared/VehicleName';

/**
 * ⭐⭐ "NOT IN THE FLEET" IS SOMETIMES A MISREAD, AND THE TAG SAYS SO.
 *
 * The key tag prints the owning area beside the plate. When the plate resolves to nothing but a
 * one-character fix — the fix that branch's OWN shape implies — lands on a real car, saying so is
 * the difference between him standing at a lot with a dead end and him having the answer.
 *
 * Aaron corrected three of my reads this way in one line (2026-09-06): *"8193 is calgary their
 * plates are 1AB234 so that OHH120, is really 0HH120"*. FG held that fact the whole time and only
 * consulted it in the audit, over records already saved.
 *
 * ⚠️ IT INFORMS, IT DOES NOT ACT. No adopt, no write, no navigation — the operator is holding the
 * physical tag, which is better evidence than anything here, and `fleetAudit`'s `0ES919` case proved
 * the data cannot say whether the PLATE or the OWNING CODE was the misread half. Naming the likely
 * car is useful; deciding for him is not.
 *
 * Renders nothing unless exactly one real vehicle is implied.
 */
export function PlateShapeHint({ plate, owningArea }: {
  plate: string | null | undefined;
  owningArea: string | null | undefined;
}) {
  const { vehicles } = useVehicleHoldContext();
  const hit = suggestPlateByShape(plate, owningArea, vehicles);
  if (!hit) return null;
  const car = vehicles.find(v => v.licensePlate.trim().toUpperCase() === hit.plate);
  if (!car) return null;

  const branch = owningLabel(owningArea);
  return (
    <div className="mt-1.5 rounded-lg border border-blue-300 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
      <p className="text-[11px] text-blue-900 dark:text-blue-200">
        The tag says <span className="font-mono font-semibold">{owningArea}</span>
        {branch ? ` (${branch})` : ''}, whose plates read{' '}
        <span className="font-mono font-semibold">{hit.shape.replace(/A/g, 'A').replace(/9/g, '9')}</span>.
        {' '}One character off is <span className="font-mono font-semibold">{hit.plate}</span> —{' '}
        <VehicleName vehicle={car} />, which FG does hold.
      </p>
      {/* No button. He has the tag in his hand; the plate or the owning number could be the misread
          half and only he can see which. This says what FG noticed, and stops. */}
      <p className="text-[10px] text-blue-700/80 dark:text-blue-300/70 mt-1">
        Check the tag — either the plate or the owning number was read wrong.
      </p>
    </div>
  );
}
