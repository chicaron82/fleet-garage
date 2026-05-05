import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { localDateStr } from '../../hooks/useFleetBalance';
import { DEMO_DRIVER_TRIP_STATS, SectionHeader, EmptyState } from '../../lib/analytics';
import { TRIP_DURATION_THRESHOLDS } from '../../lib/vsa-trip';

interface TripRow { driver_id: string; depart_time: string; arrive_time: string; }

interface DriverStatRow {
  driverId:       string;
  tripsToday:     number;
  avgMinutes:     number;
  weekAvgMinutes: number;
}

interface Props { isDemo: boolean; activeBranch: string; }

function avgMin(trips: TripRow[]): number {
  if (trips.length === 0) return 0;
  const total = trips.reduce((s, t) =>
    s + (new Date(t.arrive_time).getTime() - new Date(t.depart_time).getTime()) / 60000, 0
  );
  return Math.round(total / trips.length);
}

export function TripAnalyticsSection({ isDemo, activeBranch }: Props) {
  const [rows, setRows]       = useState<DriverStatRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    setLoading(true);
    const today   = localDateStr(0)  + 'T00:00:00';
    const weekAgo = localDateStr(-6) + 'T00:00:00';

    const buildQuery = (from: string) => {
      let q = supabase
        .from('vsa_trips')
        .select('driver_id, depart_time, arrive_time')
        .gte('depart_time', from);
      if (activeBranch !== 'ALL') q = q.eq('branch_id', activeBranch);
      return q;
    };

    Promise.all([buildQuery(today), buildQuery(weekAgo)]).then(([todayRes, weekRes]) => {
      const todayTrips = (todayRes.data ?? []) as TripRow[];
      const weekTrips  = (weekRes.data  ?? []) as TripRow[];

      const weekMap = new Map<string, TripRow[]>();
      for (const t of weekTrips) {
        if (!weekMap.has(t.driver_id)) weekMap.set(t.driver_id, []);
        weekMap.get(t.driver_id)!.push(t);
      }

      const todayMap = new Map<string, TripRow[]>();
      for (const t of todayTrips) {
        if (!todayMap.has(t.driver_id)) todayMap.set(t.driver_id, []);
        todayMap.get(t.driver_id)!.push(t);
      }

      const result: DriverStatRow[] = Array.from(todayMap.entries())
        .map(([driverId, todayList]) => ({
          driverId,
          tripsToday:     todayList.length,
          avgMinutes:     avgMin(todayList),
          weekAvgMinutes: avgMin(weekMap.get(driverId) ?? []),
        }))
        .sort((a, b) => b.tripsToday - a.tripsToday);

      setRows(result);
      setLoading(false);
    });
  }, [isDemo, activeBranch]);

  const displayRows     = isDemo ? DEMO_DRIVER_TRIP_STATS.drivers : rows;
  const totalTrips      = isDemo
    ? DEMO_DRIVER_TRIP_STATS.totalTrips
    : rows.reduce((s, r) => s + r.tripsToday, 0);
  const fleetAvgTrips   = isDemo
    ? DEMO_DRIVER_TRIP_STATS.fleetAvgTrips
    : displayRows.length > 0
      ? Math.round((totalTrips / displayRows.length) * 10) / 10
      : 0;
  const fleetAvgMinutes = isDemo
    ? DEMO_DRIVER_TRIP_STATS.fleetAvgMinutes
    : displayRows.length > 0
      ? Math.round(displayRows.reduce((s, r) => s + r.avgMinutes, 0) / displayRows.length)
      : 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
      <SectionHeader title="Trip Analytics · Today" />

      {loading && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">Loading…</p>
      )}

      {!loading && !isDemo && rows.length === 0 && (
        <EmptyState message="No trips logged today yet. Live data appears as drivers complete runs." />
      )}

      {!loading && (isDemo || rows.length > 0) && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Total trips today:{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{totalTrips}</span>
          </p>

          <div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pb-2 border-b border-gray-100 dark:border-gray-800">
              <span>Driver</span>
              <span className="w-12 text-center">Trips</span>
              <span className="w-16 text-center">Avg Time</span>
            </div>

            {displayRows.map(row => {
              const isAmber = row.avgMinutes > TRIP_DURATION_THRESHOLDS.amber;
              return (
                <div
                  key={row.driverId}
                  className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">{row.driverId}</span>
                  <span className="w-12 text-center text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {row.tripsToday}
                  </span>
                  <span className={`w-16 text-center text-sm font-semibold tabular-nums ${
                    isAmber ? 'text-amber-500' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {row.avgMinutes}m
                  </span>
                </div>
              );
            })}

            <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center pt-2 mt-1 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Fleet avg</span>
              <span className="w-12 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                {fleetAvgTrips}
              </span>
              <span className="w-16 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                {fleetAvgMinutes}m
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
