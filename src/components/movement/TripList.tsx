import { getTripDurationMinutes, isTripFlagged } from '../../lib/trip-utils';
import type { TripRun } from '../../data/trips';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

export function SummaryCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
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

interface TripListProps {
  trips: TripRun[];
  isManagement: boolean;
}

export function TripList({ trips, isManagement }: TripListProps) {
  return (
    <div className="space-y-2">
      {trips.map(trip => {
        const duration = getTripDurationMinutes(trip);
        const flagged  = isTripFlagged(trip);
        return (
          <div key={trip.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm transition-colors">{trip.vehicleUnit}</span>
                    <span className="text-gray-400 dark:text-gray-600 text-xs">·</span>
                    {trip.vehicleMake ? (
                      <span className="text-gray-700 dark:text-gray-300 text-sm transition-colors">
                        {trip.vehicleYear} {trip.vehicleMake} {trip.vehicleModel} <span className="text-gray-500 dark:text-gray-400">· {trip.vehicleColor}</span>
                      </span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 text-xs transition-colors">{trip.vehiclePlate}</span>
                    )}
                  </div>
                  {trip.vehicleMake && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="opacity-0 font-semibold text-sm">{trip.vehicleUnit}</span>
                      <span className="opacity-0 text-xs">·</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs transition-colors">Plate: {trip.vehiclePlate}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">
                  {trip.departLocation === trip.arriveLocation
                    ? trip.departLocation
                    : `${trip.departLocation} → ${trip.arriveLocation}`}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors">
                  {fmtTime(trip.departTime)} → {fmtTime(trip.arriveTime)}
                  <span className={flagged ? 'text-amber-600 dark:text-amber-500 font-semibold' : ''}>
                    {' '}· {duration}m
                  </span>
                  {'gasLevel' in trip && trip.gasLevel ? ` · Gas: ${trip.gasLevel}` : ''}
                  {trip.queueAtDeparture ? ` · Queue: ${trip.queueAtDeparture}` : ''}
                  {trip.fuelOnArrival ? ` · Fuel: ${trip.fuelOnArrival}` : ''}
                </p>
                {trip.isVsaInterruption && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                      trip.authorization === 'PERSONAL'
                        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    } transition-colors`}>
                      {trip.authorization === 'PERSONAL' ? '🌀 Proactive Run' : '⚠️ VSA Interruption'}
                    </span>
                    {trip.oneWay && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors">
                        ⬛ One-way
                      </span>
                    )}
                  </div>
                )}
                {isManagement && flagged && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 transition-colors">
                      ⚠️ Long trip · {duration}m
                    </span>
                  </div>
                )}
                {trip.notes && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2 transition-colors">"{trip.notes}"</p>
                )}
              </div>
              <TripBadge type={trip.tripType} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
