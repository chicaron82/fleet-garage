import type { UserRole, VehicleStatus } from '../../types';
import { hapticLight } from '../../lib/haptics';

const ACTIVE_CARD_STYLES: Record<VehicleStatus, string> = {
  HELD:               'ring-2 ring-red-500 bg-red-50 dark:bg-red-950/30 border-transparent',
  OUT_ON_EXCEPTION:   'ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-950/30 border-transparent',
  PRE_EXISTING:       'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30 border-transparent',
  RETURNED:           'ring-2 ring-gray-400 bg-gray-100 dark:bg-gray-800/50 border-transparent',
  CLEAR:              'ring-2 ring-green-500 bg-green-50 dark:bg-green-950/30 border-transparent',
  SALE_CAR:           'ring-2 ring-teal-500 bg-teal-50 dark:bg-teal-950/30 border-transparent',
  AUCTION_SHORT_TERM: 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950/30 border-transparent',
};

interface CardProps {
  value: number;
  label: string;
  color: string;
  status?: VehicleStatus;
  activeFilter?: VehicleStatus | null;
  onFilterChange?: (status: VehicleStatus) => void;
}

function Card({ value, label, color, status, activeFilter, onFilterChange }: CardProps) {
  const isInteractive = !!onFilterChange && !!status;
  const isActive = isInteractive && activeFilter === status;

  if (!isInteractive) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      </div>
    );
  }

  const baseClasses = 'rounded-xl border p-4 text-center transition-all cursor-pointer';
  const stateClasses = isActive
    ? ACTIVE_CARD_STYLES[status!]
    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm';

  return (
    <button
      type="button"
      onClick={() => { hapticLight(); onFilterChange!(status!); }}
      aria-pressed={isActive}
      className={`${baseClasses} ${stateClasses}`}
    >
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </button>
  );
}

interface DashboardSummaryCardsProps {
  role: UserRole;
  held: number;
  onException: number;
  preExisting: number;
  returned: number;
  cleared: number;
  activeFilter: VehicleStatus | null;
  onFilterChange: (status: VehicleStatus) => void;
}

export function DashboardSummaryCards({
  role,
  held,
  onException,
  preExisting,
  returned,
  cleared,
  activeFilter,
  onFilterChange,
}: DashboardSummaryCardsProps) {
  // VSA & Lead VSA — no cards, just search and flag
  if (role === 'VSA' || role === 'Lead VSA') return null;

  // CSR & HIR — returned count only (display, no filter — single card has no drill-down value)
  if (role === 'CSR' || role === 'HIR') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xs">
        <Card value={returned} label="Returned" color="text-gray-500 dark:text-gray-400" />
      </div>
    );
  }

  // Management — full dashboard, tap any card to filter the list below
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <Card value={held}        label="Currently Held" color="text-red-600 dark:text-red-500"       status="HELD"             activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Card value={onException} label="On Exception"   color="text-amber-500"                       status="OUT_ON_EXCEPTION" activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Card value={preExisting} label="Pre-existing"   color="text-blue-600 dark:text-blue-500"     status="PRE_EXISTING"     activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Card value={returned}    label="Returned"       color="text-gray-500 dark:text-gray-400"     status="RETURNED"         activeFilter={activeFilter} onFilterChange={onFilterChange} />
      <Card value={cleared}     label="Repaired"       color="text-green-600 dark:text-green-500"   status="CLEAR"            activeFilter={activeFilter} onFilterChange={onFilterChange} />
    </div>
  );
}
