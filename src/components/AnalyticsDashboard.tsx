import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useGarage } from '../context/GarageContext';
import { useFleetBalance, localDateStr } from '../hooks/useFleetBalance';
import {
  canEnterFleetBalance, StatCard,
  DEMO_HOLD_TYPES, DEMO_DAMAGE_TYPES, DEMO_WEEK_ACTIVITY,
  DEMO_GLANCE, DEMO_EXCEPTION_SUMMARY, DEMO_TRIPS_TODAY,
  DEMO_WASHBAY_TODAY, DEMO_WASHBAY_30DAY_AVG, COMPANY_STANDARD,
} from '../lib/analytics';
import { AnalyticsTripsSummary } from './AnalyticsTripsSummary';
import { WashbayLiveSection } from './WashbayLiveSection';
import { AnalyticsHoldsSummary } from './AnalyticsHoldsSummary';
import { AnalyticsActivityChart } from './AnalyticsActivityChart';
import { AnalyticsFleetBalance } from './AnalyticsFleetBalance';

interface TripRow { trip_type: string; driver_id: string; }

export function AnalyticsDashboard() {
  const { user, activeBranch } = useAuth();
  const { holds, vehicles, washbayLogs, getTodayWashbayLog } = useGarage();
  const { entries, loading, upsertEntry, getTodayEntry } = useFleetBalance();
  const [mode, setMode] = useState<'demo' | 'live'>('live');
  const [todayTrips, setTodayTrips] = useState<TripRow[]>([]);

  useEffect(() => {
    if (mode !== 'live') return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let query = supabase
      .from('vsa_trips')
      .select('trip_type, driver_id')
      .gte('depart_time', todayStart.toISOString());
    if (activeBranch !== 'ALL') query = query.eq('branch_id', activeBranch);
    query.then(({ data }) => setTodayTrips((data ?? []) as TripRow[]));
  }, [mode, activeBranch]);

  if (!user) return null;

  const isDemo  = mode === 'demo';
  const canEnter = canEnterFleetBalance(user.role);

  // ── Live data derivations ──────────────────────────────────────────────────

  const activeHolds  = holds.filter(h => h.status === 'ACTIVE');
  const onException  = vehicles.filter(v => v.status === 'OUT_ON_EXCEPTION').length;
  const oneWeekAgo   = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const returnedThisWeek = holds.filter(h =>
    h.status === 'RETURNED' && new Date(h.flaggedAt) >= oneWeekAgo
  ).length;

  const liveHoldTypes = (() => {
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

  const liveDamageTypes = (() => {
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

  const liveWeekActivity = (() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, i) => {
      const offsetDays = i - 6;
      const dateStr = localDateStr(offsetDays);
      const date = new Date(); date.setDate(date.getDate() + offsetDays);
      const dayName = days[date.getDay()];
      return {
        day:      dayName,
        holds:    holds.filter(h => h.flaggedAt.startsWith(dateStr)).length,
        releases: holds.filter(h => h.release && h.flaggedAt.startsWith(dateStr)).length,
      };
    });
  })();

  const liveExceptionSummary = (() => {
    const counts: Record<string, number> = {};
    holds.filter(h => h.release?.releaseType === 'EXCEPTION').forEach(h => {
      const reason = h.release?.reason ?? 'Unknown';
      counts[reason] = (counts[reason] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }));
  })();

  const todayWashbayLog   = getTodayWashbayLog();
  const todayBalanceEntry = getTodayEntry();
  const liveWashbay30DayAvg = washbayLogs.length >= 3
    ? Math.round((washbayLogs.reduce((s, l) => {
        const ci = l.fullPages * 19 + l.lastPageEntries;
        const cc = Math.max(0, ci - l.carsRemaining);
        return s + (l.shiftHours > 0 ? cc / l.shiftHours : 0);
      }, 0) / washbayLogs.length) * 10) / 10
    : null;

  // ── Mode-selected data ─────────────────────────────────────────────────────

  const glance       = isDemo ? DEMO_GLANCE : { activeHolds: activeHolds.length, onException, returnedThisWeek };
  const holdTypes    = isDemo ? DEMO_HOLD_TYPES : liveHoldTypes;
  const totalHolds   = holdTypes.reduce((s, t) => s + t.count, 0) || 1;
  const damageTypes  = isDemo ? DEMO_DAMAGE_TYPES : liveDamageTypes;
  const weekActivity = isDemo ? DEMO_WEEK_ACTIVITY : liveWeekActivity;
  const exceptionSummary = isDemo ? DEMO_EXCEPTION_SUMMARY : liveExceptionSummary;

  // Fleet balance — always real
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

      {/* Header + mode toggle */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
            {isDemo ? 'Fleet hold summary · sample data' : 'Fleet hold summary · your data'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 transition-colors">
          {(['demo', 'live'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors capitalize ${
                mode === m
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Live mode banner */}
      {!isDemo && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl px-4 py-3 transition-colors">
          <p className="text-xs font-semibold text-green-800 dark:text-green-300">
            📡 Live Data — showing what's been collected so far
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            Fleet balance always reflects real entries regardless of mode.
          </p>
        </div>
      )}

      {/* Glance cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={glance.activeHolds}      label="Active Holds"       color="text-gray-900 dark:text-gray-100" />
        <StatCard value={glance.onException}      label="On Exception"       color="text-amber-600 dark:text-amber-400" />
        <StatCard value={glance.returnedThisWeek} label="Returned This Week" color="text-green-600 dark:text-green-500" />
      </div>

      <AnalyticsHoldsSummary
        holdTypes={holdTypes}
        totalHolds={totalHolds}
        damageTypes={damageTypes}
        isDemo={isDemo}
        hasLiveHolds={activeHolds.length > 0}
      />

      <AnalyticsActivityChart
        weekActivity={weekActivity}
        exceptionSummary={exceptionSummary}
        isDemo={isDemo}
      />

      <AnalyticsFleetBalance
        fleetBalanceData={fleetBalanceData}
        loading={loading}
        todayEntry={todayBalanceEntry}
        canEnter={canEnter}
        onSubmit={(outCount, inCount) => upsertEntry(localDateStr(), outCount, inCount, user.id)}
      />

      <AnalyticsTripsSummary
        isDemo={isDemo}
        liveTrips={todayTrips}
        demoData={DEMO_TRIPS_TODAY}
      />

      {/* Washbay Operations */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
          {`Washbay Operations · ${new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).toUpperCase()}`}
        </h2>
        {isDemo ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Cars In',    value: DEMO_WASHBAY_TODAY.carsIn },
                { label: 'Cleaned',    value: DEMO_WASHBAY_TODAY.carsCleaned },
                { label: 'Throughput', value: `${DEMO_WASHBAY_TODAY.throughput.toFixed(1)}/hr` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1 pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Pipeline</p>
              {[
                { label: 'Cars in',              value: DEMO_WASHBAY_TODAY.carsIn,               indent: false },
                { label: `Held today (${DEMO_WASHBAY_TODAY.heldToday})`, value: DEMO_WASHBAY_TODAY.heldToday, indent: true, minus: true },
                { label: 'Rentables processed',  value: DEMO_WASHBAY_TODAY.rentablesProcessed,   indent: false },
                { label: 'Clean, not picked up', value: DEMO_WASHBAY_TODAY.cleanNotPickedUp,     indent: true, minus: true },
                { label: 'Delivered to airport', value: DEMO_WASHBAY_TODAY.deliveredToAirport,   indent: false },
              ].map(({ label, value, indent, minus }) => (
                <div key={label} className={`flex justify-between ${indent ? 'pl-4 text-gray-400 dark:text-gray-500' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                  <span className="text-xs">{minus ? '− ' : ''}{label}</span>
                  <span className="text-xs tabular-nums">{value}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Net Flow (vs Opening)</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {DEMO_WASHBAY_TODAY.openingCarsOut} out → {DEMO_WASHBAY_TODAY.carsIn} in
                <span className="ml-2 font-semibold text-green-600 dark:text-green-400">Net +{DEMO_WASHBAY_TODAY.netFlow} today</span>
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">vs Company Standard</p>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">YWG team: <span className="font-bold">{DEMO_WASHBAY_TODAY.throughput.toFixed(1)}/hr</span></span>
                <span className="text-sm text-gray-500 dark:text-gray-400">Standard: {COMPANY_STANDARD.toFixed(1)}/hr</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">30-day avg: <span className="font-bold text-gray-800 dark:text-gray-200">{DEMO_WASHBAY_30DAY_AVG.toFixed(1)}/hr</span></span>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">+{(DEMO_WASHBAY_30DAY_AVG - COMPANY_STANDARD).toFixed(1)} above ✅</span>
              </div>
            </div>
          </div>
        ) : (
          <WashbayLiveSection
            todayWashbayLog={todayWashbayLog}
            todayBalanceEntry={todayBalanceEntry}
            activeHolds={activeHolds}
            liveWashbay30DayAvg={liveWashbay30DayAvg}
          />
        )}
      </div>

    </div>
  );
}
