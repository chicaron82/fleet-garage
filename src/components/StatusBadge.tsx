import type { VehicleStatus, HoldStatus } from '../types';

const VEHICLE_CONFIG: Record<VehicleStatus, { label: string; className: string }> = {
  HELD:            { label: 'Held',          className: 'bg-red-50 text-red-700 border-red-200' },
  OUT_ON_EXCEPTION:{ label: 'On Exception', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  RETURNED:        { label: 'Returned',      className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const HOLD_CONFIG: Record<HoldStatus, { label: string; className: string }> = {
  ACTIVE:   { label: 'Active Hold', className: 'bg-red-50 text-red-700 border-red-200' },
  RELEASED: { label: 'Released',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
  RETURNED: { label: 'Returned',   className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export function StatusBadge({ status }: { status: VehicleStatus | HoldStatus }) {
  const config =
    status in VEHICLE_CONFIG
      ? VEHICLE_CONFIG[status as VehicleStatus]
      : HOLD_CONFIG[status as HoldStatus];

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}
