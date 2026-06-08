import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useVehicleHoldContext } from '../../context/VehicleHoldContext';
import { useWashbayContext } from '../../context/WashbayContext';
import { useIssueContext } from '../../context/IssueContext';
import { useSchedule } from '../../context/ScheduleContext';
import { localDateStr } from '../../hooks/useFleetBalance';
import { useFleetBalanceContext } from '../../context/FleetBalanceContext';
import { shiftDayStartISO, businessDateOf } from '../../lib/shiftDay';
import { canEnterFleetBalance, isManagement } from '../../lib/analytics';
import { StatCard } from './AnalyticsComponents';
import { AnalyticsTripsSummary } from './AnalyticsTripsSummary';
import { WashbayLiveSection } from '../washbay/WashbayLiveSection';
import { AnalyticsHoldsSummary } from './AnalyticsHoldsSummary';
import { AnalyticsActivityChart } from './AnalyticsActivityChart';
import { AnalyticsFleetBalance } from './AnalyticsFleetBalance';
import { TripAnalyticsSection } from './TripAnalyticsSection';
import { DriverCoverageSection } from './DriverCoverageSection';
import { TurnaroundSection } from './TurnaroundSection';
import { WashbayHistorySection } from '../washbay/WashbayHistorySection';
import { ShiftThroughputSection } from '../washbay/ShiftThroughputSection';
import { EVAssetStatusSection } from './EVAssetStatusSection';
import { ClassDispatchSection } from './ClassDispatchSection';
import { ShiftSummarySection } from './ShiftSummarySection';

interface TripRow { trip_type: string; driver_id: string; }

export function AnalyticsView() {
  const { user, activeBranch } = useAuth();
  const { holds, vehicles } = useVehicleHoldContext();
  const { washbayLogs, handoffNotes, getTodayWashbayLog, shiftCheckpoints } = useWashbayContext();
  const { facilityIssues } = useIssueContext();
  const { isPeakSeason } = useSchedule();
  const { entries, loading, upsertEntry, getTodayEntry, getProjection } = useFleetBalanceContext();
  const [activeTab, setActiveTab] = useState<'holds' | 'productivity' | 'my-shift'>('holds');
  const [todayTrips, setTodayTrips] = useState<TripRow[]>([]);

  useEffect(() => {
    let query = supabase
      .from('vsa_trips')
      .select('trip_type, driver_id')
      .gte('depart_time', shiftDayStartISO(localDateStr(0)));
    if (activeBranch !== 'ALL') query = query.eq('branch_id', activeBranch);
    query.then(({ data }) => setTodayTrips((data ?? []) as TripRow[]));
  }, [activeBranch]);

  if (!user) return null;

  const canEnter = canEnterFleetBalance(user.role);

  // ── Data derivations ───────────────────────────────────────────────────────

  const todayISO    = localDateStr(0);
  const activeHolds = holds.filter(h => h.status === 'ACTIVE' && businessDateOf(h.flaggedAt) === todayISO);
  const onException = vehicles.filter(v => v.status === 'OUT_ON_EXCEPTION').length;
  const oneWeekAgo  = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const returnedThisWeek = holds.filter(h =>
    h.status === 'RETURNED' && new Date(h.flaggedAt) >= oneWeekAgo
  ).length;

  const holdTypes = (() => {
    const damage     = activeHolds.filter(h => h.holdTypes.includes('damage')).length;
    const detail     = activeHolds.filter(h => h.holdTypes.includes('detail')).length;
    const mechanical = activeHolds.filter(h => h.holdTypes.includes('mechanical')).length;
    const total = damage + detail + mechanical || 1;
    return [
      { label: 'Damage',     count: damage,     color: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400',  pct: damage / total },
      { label: 'Detail',     count: detail,     color: 'bg-teal-400',  text: 'text-teal-700 dark:text-teal-400',   pct: detail / total },
      { label: 'Mechanical', count: mechanical, color: 'bg-blue-400',  text: 'text-blue-700 dark:text-blue-400',   pct: mechanical / total },
    ];
  })();

  const damageTypes = (() => {
    const counts: Record<string, number> = {};
    activeHolds
      .filter(h => h.holdTypes.includes('damage'))
      .forEach(h => {
        h.damageDescription.split(',').forEach(part => {
          const key = part.trim();
          if (key) counts[key] = (counts[key] ?? 0) + 1;
        });
      });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([label, count]) => ({ label, count }));
  })();

  const weekActivity = (() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, i) => {
      const offsetDays = i - 6;
      const dateStr = localDateStr(offsetDays);
      const date = new Date(); date.setDate(date.getDate() + offsetDays);
      return {
        day:      days[date.getDay()],
        holds:    holds.filter(h => businessDateOf(h.flaggedAt) === dateStr).length,
        releases: holds.filter(h => h.release && businessDateOf(h.flaggedAt) === dateStr).length,
      };
    });
  })();

  const glance           = { activeHolds: activeHolds.length, onException, returnedThisWeek };
  const totalHolds       = holdTypes.reduce((s, t) => s + t.count, 0) || 1;
  const exceptionSummary = (() => {
    const counts: Record<string, number> = {};
    holds.filter(h => h.release?.releaseType === 'EXCEPTION').forEach(h => {
      const reason = h.release?.reason ?? 'Unknown';
      counts[reason] = (counts[reason] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }));
  })();

  const todayWashbayLog     = getTodayWashbayLog();
  const yesterdayWashbayLog = washbayLogs.find(l => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return l.date === d.toLocaleDateString('en-CA');
  });
  const todayBalanceEntry   = getTodayEntry();
  const projection          = getProjection();
  const liveWashbay30DayAvg = washbayLogs.length >= 3
    ? Math.round((washbayLogs.reduce((s, l) => {
        const ci = l.fullPages * 19 + l.lastPageEntries;
        const cc = Math.max(0, ci - l.carsRemaining);
        return s + (l.shiftHours > 0 ? cc / l.shiftHours : 0);
      }, 0) / washbayLogs.length) * 10) / 10
    : null;

  const fleetBalanceData = Array.from({ length: 7 }, (_, i) => {
    const offsetDays = i - 6;
    const dateStr = localDateStr(offsetDays);
    const d = new Date(); d.setDate(d.getDate() + offsetDays);
    const dayName = d.toLocaleDateString('en-CA', { weekday: 'short' });
    const entry = entries.find(e => e.date === dateStr);
    return { day: dayName, date: dateStr, outCount: entry?.outCount, inCount: entry?.inCount, hasData: !!entry };
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">Fleet hold summary · your data</p>
      </div>

      {/* High-severity facility issue banner */}
      {(() => {
        const count = facilityIssues.filter(i => !i.clearedAt && i.severity === 'high').length;
        if (count === 0) return null;
        return (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            <span className="shrink-0">🔴</span>
            <p>
              <strong>{count}</strong> high-severity facility issue{count > 1 ? 's require' : ' requires'} attention.
            </p>
          </div>
        );
      })()}

      {/* Tab toggle */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1 transition-colors">
        {([
          { key: 'holds',        label: 'Holds' },
          { key: 'productivity', label: 'Productivity' },
          { key: 'my-shift',     label: 'My Shift' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Holds tab */}
      {activeTab === 'holds' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard value={glance.activeHolds}      label="Active Holds"       color="text-gray-900 dark:text-gray-100" />
            <StatCard value={glance.onException}      label="On Exception"       color="text-amber-600 dark:text-amber-400" />
            <StatCard value={glance.returnedThisWeek} label="Returned This Week" color="text-green-600 dark:text-green-500" />
          </div>

          <AnalyticsHoldsSummary
            holdTypes={holdTypes}
            totalHolds={totalHolds}
            damageTypes={damageTypes}
            hasLiveHolds={activeHolds.length > 0}
          />

          <AnalyticsActivityChart
            weekActivity={weekActivity}
            exceptionSummary={exceptionSummary}
          />
        </>
      )}

      {/* Productivity tab */}
      {activeTab === 'productivity' && (
        <>
          <AnalyticsFleetBalance
            fleetBalanceData={fleetBalanceData}
            loading={loading}
            todayEntry={todayBalanceEntry}
            canEnter={canEnter}
            onSubmit={(outCount, inCount) => upsertEntry(localDateStr(), outCount, inCount, user.id)}
            projection={projection}
          />

          <AnalyticsTripsSummary liveTrips={todayTrips} />

          {/* Washbay Operations */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
              {`Washbay Operations · ${new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).toUpperCase()}`}
            </h2>
            <WashbayLiveSection
              todayWashbayLog={todayWashbayLog}
              yesterdayWashbayLog={yesterdayWashbayLog}
              todayBalanceEntry={todayBalanceEntry}
              activeHolds={activeHolds}
              liveWashbay30DayAvg={liveWashbay30DayAvg}
              isPeakSeason={isPeakSeason}
              weekdayAvgBalance={projection}
            />
          </div>

          {isManagement(user.role) && (
            <ClassDispatchSection activeBranch={activeBranch} />
          )}

          {isManagement(user.role) && (
            <EVAssetStatusSection activeBranch={activeBranch} />
          )}

          {isManagement(user.role) && (
            <WashbayHistorySection washbayLogs={washbayLogs} handoffNotes={handoffNotes} />
          )}

          {isManagement(user.role) && (
            <ShiftThroughputSection
              washbayLogs={washbayLogs}
              handoffNotes={handoffNotes}
              checkpoints={shiftCheckpoints}
            />
          )}

          <TripAnalyticsSection activeBranch={activeBranch} />

          {isManagement(user.role) && (
            <TurnaroundSection activeBranch={activeBranch} />
          )}

          {isManagement(user.role) && (
            <DriverCoverageSection activeBranch={activeBranch} />
          )}
        </>
      )}

      {/* My Shift tab */}
      {activeTab === 'my-shift' && (
        <ShiftSummarySection activeBranch={activeBranch} />
      )}

    </div>
  );
}
