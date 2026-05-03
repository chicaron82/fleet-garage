import { SectionHeader, EmptyState } from '../lib/analytics';

interface LiveTripRow { trip_type: string; driver_id: string; }
interface DemoDriverRow { name: string; total: number; clean: number; dirty: number; other: number; }

interface Props {
  isDemo: boolean;
  liveTrips: LiveTripRow[];
  demoData: {
    total: number; clean: number; dirty: number; other: number;
    byDriver: DemoDriverRow[];
  };
}

const COL_COLORS = {
  total: 'text-gray-900 dark:text-gray-100',
  clean: 'text-green-600 dark:text-green-500',
  dirty: 'text-amber-500',
  other: 'text-gray-500 dark:text-gray-400',
};

export function AnalyticsTripsSummary({ isDemo, liveTrips, demoData }: Props) {
  const today = new Date()
    .toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    .toUpperCase();

  const live = {
    total: liveTrips.length,
    clean: liveTrips.filter(t => t.trip_type === 'clean').length,
    dirty: liveTrips.filter(t => t.trip_type === 'dirty').length,
    other: liveTrips.filter(t => t.trip_type !== 'clean' && t.trip_type !== 'dirty').length,
    drivers: new Set(liveTrips.map(t => t.driver_id)).size,
  };

  const counts = isDemo ? demoData : live;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
      <SectionHeader title={`Today's Trips · ${today}`} />

      {/* 4-col totals */}
      <div className="grid grid-cols-4 gap-3 text-center">
        {(
          [
            { label: 'Total', key: 'total' },
            { label: 'Clean', key: 'clean' },
            { label: 'Dirty', key: 'dirty' },
            { label: 'Other', key: 'other' },
          ] as const
        ).map(({ label, key }) => (
          <div key={key}>
            <p className={`text-2xl font-bold ${COL_COLORS[key]}`}>{counts[key]}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Per-driver breakdown */}
      {isDemo ? (
        <div className="border-t border-gray-100 dark:border-gray-800 mt-4 pt-4 space-y-1.5">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            <span>Driver</span>
            <span className="w-8 text-center">Total</span>
            <span className="w-8 text-center text-green-600 dark:text-green-500">Cln</span>
            <span className="w-8 text-center text-amber-500">Drt</span>
            <span className="w-8 text-center">Oth</span>
          </div>
          {demoData.byDriver.map(d => (
            <div key={d.name} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 items-center">
              <span className="text-sm text-gray-700 dark:text-gray-300">{d.name}</span>
              <span className="w-8 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{d.total}</span>
              <span className="w-8 text-center text-sm text-green-600 dark:text-green-500">{d.clean}</span>
              <span className="w-8 text-center text-sm text-amber-500">{d.dirty}</span>
              <span className="w-8 text-center text-sm text-gray-500 dark:text-gray-400">{d.other}</span>
            </div>
          ))}
        </div>
      ) : liveTrips.length === 0 ? (
        <div className="border-t border-gray-100 dark:border-gray-800 mt-4 pt-2">
          <EmptyState message="No trips logged today." />
        </div>
      ) : (
        <div className="border-t border-gray-100 dark:border-gray-800 mt-4 pt-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {live.drivers} driver{live.drivers !== 1 ? 's' : ''} active today
          </p>
        </div>
      )}
    </div>
  );
}
