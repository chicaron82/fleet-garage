import { vehicleLabel, powertrainBadge, type NamedVehicle, type NameOrder } from '../../lib/vehicleName';

/** The identity line, rendered. All the reasoning lives in `lib/vehicleName` — this file is the
 *  span and the badge, nothing more (the pure half is split out so it is testable and so fast
 *  refresh keeps working). */
export function VehicleName({ vehicle, order = 'year-first', className }: {
  vehicle: NamedVehicle;
  order?: NameOrder;
  className?: string;
}) {
  const badge = powertrainBadge(vehicle);
  return (
    <span className={className}>
      {vehicleLabel(vehicle, order)}
      {badge && (
        // title, not a visible label: the row is already tight and the mark is the point. Not
        // aria-hidden — a screen reader saying "hybrid" is exactly the information sighted users get.
        <span className="ml-1" title={badge === '⚡' ? 'Battery-electric' : 'Hybrid'}>{badge}</span>
      )}
    </span>
  );
}
