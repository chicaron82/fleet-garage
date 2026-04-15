import { useAuth } from '../context/AuthContext';
import { canRelease } from '../types';
import { MOCK_TRIPS } from '../data/trips';
import { USERS } from '../data/mock';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

export function TripsView() {
  const { user } = useAuth();
  if (!user) return null;

  const isManagement = canRelease(user.role);
  const myTrips = MOCK_TRIPS.filter(t => t.driverId === user.id);
  const displayTrips = isManagement ? MOCK_TRIPS : myTrips;

  // Group by driver for management view
  const grouped = isManagement
    ? displayTrips.reduce<Record<string, typeof displayTrips>>((acc, t) => {
        const name = USERS.find(u => u.id === t.driverId)?.name ?? 'Unknown';
        (acc[name] ??= []).push(t);
        return acc;
      }, {})
    : null;

  const cleanCount = displayTrips.filter(t => t.tripType === 'clean').length;
  const dirtyCount = displayTrips.filter(t => t.tripType === 'dirty').length;
  const customerCount = displayTrips.filter(t => t.tripType === 'customer').length;
  const transferCount = displayTrips.filter(t => t.tripType === 'transfer').length;
  const totalRuns = displayTrips.length;

  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">
          {isManagement ? 'All Trips Today' : "Today's Runs"}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">{today}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-3">
        <SummaryCard value={totalRuns} label="Total" color="text-gray-900 dark:text-gray-100" />
        <SummaryCard value={cleanCount} label="Clean" color="text-green-600 dark:text-green-500" />
        <SummaryCard value={dirtyCount} label="Dirty" color="text-amber-500" />
        <SummaryCard value={customerCount} label="Customer" color="text-blue-600 dark:text-blue-500" />
        <SummaryCard value={transferCount} label="Transfer" color="text-purple-600 dark:text-purple-500" />
      </div>

      {/* Trip list */}
      {isManagement ? (
        <div className="space-y-5">
          {Object.entries(grouped!).map(([driverName, trips]) => (
            <div key={driverName}>
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 transition-colors">
                {driverName} · {trips.length} run{trips.length !== 1 ? 's' : ''}
              </h2>
              <TripList trips={trips} />
            </div>
          ))}
        </div>
      ) : (
        <TripList trips={myTrips} />
      )}

      {displayTrips.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-center transition-colors">
          <p className="text-gray-400 dark:text-gray-500 text-sm">No runs logged today.</p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function TripList({ trips }: { trips: typeof MOCK_TRIPS }) {
  return (
    <div className="space-y-2">
      {trips.map(trip => (
        <div
          key={trip.id}
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm transition-colors">
                  {trip.vehicleUnit}
                </span>
                <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs transition-colors">
                  {trip.vehiclePlate}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                {trip.departLocation} → {trip.arriveLocation}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">
                {fmtTime(trip.departTime)} → {fmtTime(trip.arriveTime)} · Gas: {trip.gasLevel} · ODO: {trip.odometer.toLocaleString()}
              </p>
            </div>
            <TripBadge type={trip.tripType} />
          </div>
        </div>
      ))}
    </div>
  );
}

const TRIP_BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  clean:    { bg: 'bg-green-100 dark:bg-green-900/30',   text: 'text-green-700 dark:text-green-400',   label: 'Clean' },
  dirty:    { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400',   label: 'Dirty' },
  customer: { bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400',     label: 'Customer' },
  transfer: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Transfer' },
};

function TripBadge({ type }: { type: string }) {
  const style = TRIP_BADGE_STYLES[type] ?? TRIP_BADGE_STYLES.clean;
  return (
    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text} transition-colors`}>
      {style.label}
    </span>
  );
}
