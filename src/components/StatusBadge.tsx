import type { VehicleStatus, HoldStatus, HoldType } from '../types';

const VEHICLE_CONFIG: Record<VehicleStatus, { label: string; className: string }> = {
  HELD:            { label: 'Held',          className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' },
  OUT_ON_EXCEPTION:{ label: 'On Exception',  className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50' },
  RETURNED:        { label: 'Returned',      className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' },
  PRE_EXISTING:    { label: 'Pre-existing',  className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50' },
  CLEAR:           { label: 'Clear',         className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50' },
};

const HOLD_CONFIG: Record<HoldStatus, { label: string; className: string }> = {
  ACTIVE:   { label: 'Active Hold', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' },
  RELEASED: { label: 'Released',   className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50' },
  RETURNED: { label: 'Returned',   className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' },
  REPAIRED: { label: 'Repaired',   className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50' },
};

const HOLD_TYPE_COLORS: Record<HoldType, string> = {
  damage:     'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  mechanical: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  detail:     'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
};

export function StatusBadge({ status, holdType }: { status: VehicleStatus | HoldStatus; holdType?: HoldType }) {
  const config =
    status in VEHICLE_CONFIG
      ? VEHICLE_CONFIG[status as VehicleStatus]
      : HOLD_CONFIG[status as HoldStatus];

  const className =
    holdType && (status === 'HELD' || status === 'ACTIVE')
      ? HOLD_TYPE_COLORS[holdType]
      : config.className;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${className}`}>
      {config.label}
    </span>
  );
}
