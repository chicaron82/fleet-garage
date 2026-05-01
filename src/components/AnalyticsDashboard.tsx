// src/components/AnalyticsDashboard.tsx
// Live / Demo toggle analytics — ZeeRah ticket, Apr 28 2026

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGarage } from '../context/GarageContext';
import { useFleetBalance, localDateStr } from '../hooks/useFleetBalance';
import { FleetBalanceEntryForm } from './FleetBalanceEntryForm';
import { USERS } from '../data/mock';

function canEnterFleetBalance(role: string): boolean {
  return ['Branch Manager', 'Operations Manager', 'Lead VSA'].includes(role);
}

const COMPANY_STANDARD = 3.0;

// ── Demo (mock) data ────────────────────────────────────────────────────────

const DEMO_HOLD_TYPES = [
  { label: 'Damage',     count: 14, color: 'bg-amber-400',  text: 'text-amber-700 dark:text-amber-400' },
  { label: 'Detail',     count: 6,  color: 'bg-teal-400',   text: 'text-teal-700 dark:text-teal-400' },
  { label: 'Mechanical', count: 5,  color: 'bg-blue-400',   text: 'text-blue-700 dark:text-blue-400' },
];

const DEMO_DAMAGE_TYPES = [
  { label: 'Scratch — paint surface',       count: 8 },
  { label: 'Windshield chip',               count: 5 },
  { label: 'Bumper damage — cosmetic',      count: 4 },
  { label: 'Scratch — to bare metal',       count: 3 },
  { label: 'Rim / hubcap damage',           count: 2 },
  { label: 'Dent — minor (no paint break)', count: 2 },
];

const DEMO_WEEK_ACTIVITY = [
  { day: 'Mon', holds: 3, releases: 1 },
  { day: 'Tue', holds: 2, releases: 2 },
  { day: 'Wed', holds: 5, releases: 1 },
  { day: 'Thu', holds: 1, releases: 3 },
  { day: 'Fri', holds: 4, releases: 2 },
  { day: 'Sat', holds: 2, releases: 0 },
  { day: 'Sun', holds: 1, releases: 1 },
];

const DEMO_GLANCE = { activeHolds: 25, onException: 8, returnedThisWeek: 3 };

const DEMO_EXCEPTION_SUMMARY = [
  { reason: 'Management decision — operational need', count: 4 },
  { reason: 'Damage documented — vehicle serviceable', count: 2 },
  { reason: 'Awaiting parts — vehicle cleared for limited use', count: 1 },
  { reason: 'Customer accepted known damage', count: 1 },
];

// Demo washbay — today's snapshot + multi-week history for 30-day avg
const DEMO_WASHBAY_TODAY = {
  carsIn: 64, carsCleaned: 57, throughput: 7.1,
  heldToday: 8, rentablesProcessed: 56, cleanNotPickedUp: 7, deliveredToAirport: 49,
  teamSize: 3, openingCarsOut: 50, netFlow: 14,
};
const DEMO_WASHBAY_HISTORY = [
  { throughput: 8.5, teamSize: 4 }, { throughput: 7.1, teamSize: 3 },
  { throughput: 9.2, teamSize: 4 }, { throughput: 7.8, teamSize: 3 },
  { throughput: 8.0, teamSize: 3 }, { throughput: 10.1, teamSize: 4 },
  { throughput: 7.4, teamSize: 3 }, { throughput: 8.8, teamSize: 4 },
  { throughput: 9.0, teamSize: 4 }, { throughput: 7.5, teamSize: 3 },
  { throughput: 8.3, teamSize: 3 }, { throughput: 9.6, teamSize: 4 },
  { throughput: 7.2, teamSize: 3 }, { throughput: 8.1, teamSize: 3 },
];
const DEMO_WASHBAY_30DAY_AVG = Math.round(
  (DEMO_WASHBAY_HISTORY.reduce((s, d) => s + d.throughput, 0) / DEMO_WASHBAY_HISTORY.length) * 10
) / 10;

// ── Helpers ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
      {title}
    </h2>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-4">{message}</p>
  );
}

// ── WashbayLiveSection ───────────────────────────────────────────────────────

import type { Hold, WashbayLog } from '../types';
import type { FleetBalanceEntry } from '../hooks/useFleetBalance';

function WashbayLiveSection({ todayWashbayLog, todayBalanceEntry, activeHolds, liveWashbay30DayAvg }: {
  todayWashbayLog: WashbayLog | undefined;
  todayBalanceEntry: FleetBalanceEntry | undefined;
  activeHolds: Hold[];
  liveWashbay30DayAvg: number | null;
}) {
  if (!todayWashbayLog) {
    return <EmptyState message="No closing log submitted today. Log it in Lot Inventory → Closing Duties." />;
  }

  const ci  = todayWashbayLog.fullPages * 19 + todayWashbayLog.lastPageEntries;
  const cc  = Math.max(0, ci - todayWashbayLog.carsRemaining);
  const tp  = todayWashbayLog.shiftHours > 0 ? cc / todayWashbayLog.shiftHours : 0;
  const ht  = activeHolds.length;
  const rp  = Math.max(0, ci - ht);
  const da  = Math.max(0, rp - todayWashbayLog.cleanNotPickedUp);
  const d   = tp - COMPANY_STANDARD;
  const openingOut = todayBalanceEntry?.outCount ?? null;
  const netFlow    = openingOut !== null ? ci - openingOut : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Cars In',    value: ci },
          { label: 'Cleaned',    value: cc },
          { label: 'Throughput', value: `${tp.toFixed(1)}/hr` },
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
          { label: 'Cars in',              value: ci,  indent: false, minus: false },
          { label: `Held today (${ht})`,   value: ht,  indent: true,  minus: true  },
          { label: 'Rentables processed',  value: rp,  indent: false, minus: false },
          { label: 'Clean, not picked up', value: todayWashbayLog.cleanNotPickedUp, indent: true, minus: true },
          { label: 'Delivered to airport', value: da,  indent: false, minus: false },
        ].map(({ label, value, indent, minus }) => (
          <div key={label} className={`flex justify-between ${indent ? 'pl-4 text-gray-400 dark:text-gray-500' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
            <span className="text-xs">{minus ? '− ' : ''}{label}</span>
            <span className="text-xs tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {openingOut !== null && netFlow !== null && (
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Net Flow (vs Opening)</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {openingOut} out → {ci} in
            <span className={`ml-2 font-semibold ${netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              Net {netFlow >= 0 ? `+${netFlow}` : netFlow} today
            </span>
          </p>
        </div>
      )}

      <div className={`rounded-lg px-4 py-3 ${d >= 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50'}`}>
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">vs Company Standard</p>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">Today: <span className="font-bold">{tp.toFixed(1)}/hr</span></span>
          <span className="text-sm text-gray-500 dark:text-gray-400">Standard: {COMPANY_STANDARD.toFixed(1)}/hr</span>
        </div>
        {liveWashbay30DayAvg !== null && (
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm text-gray-600 dark:text-gray-400">30-day avg: <span className="font-bold text-gray-800 dark:text-gray-200">{liveWashbay30DayAvg.toFixed(1)}/hr</span></span>
            <span className={`text-sm font-semibold ${liveWashbay30DayAvg - COMPANY_STANDARD >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {liveWashbay30DayAvg - COMPANY_STANDARD >= 0 ? `+${(liveWashbay30DayAvg - COMPANY_STANDARD).toFixed(1)} above ✅` : `${(liveWashbay30DayAvg - COMPANY_STANDARD).toFixed(1)} below`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const { holds, vehicles, washbayLogs, getTodayWashbayLog } = useGarage();
  const { entries, loading, upsertEntry, getTodayEntry } = useFleetBalance();
  const [mode, setMode] = useState<'demo' | 'live'>('demo');

  if (!user) return null;

  const canEnter = canEnterFleetBalance(user.role);
  const todayEntry = getTodayEntry();

  const handleFleetBalanceSubmit = async (outCount: number, inCount: number): Promise<boolean> => {
    return await upsertEntry(localDateStr(), outCount, inCount, user.id);
  };

  // ── Live data derivations ──────────────────────────────────────────────────

  const activeHolds = holds.filter(h => h.status === 'ACTIVE');
  const onException = vehicles.filter(v => v.status === 'OUT_ON_EXCEPTION').length;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const returnedThisWeek = holds.filter(h =>
    h.status === 'RETURNED' && new Date(h.flaggedAt) >= oneWeekAgo
  ).length;

  // Holds by type — live
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

  // Top damage types — live (from active damage holds only)
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
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count }));
  })();

  // Hold activity this week — live
  const liveWeekActivity = (() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dayName = days[date.getDay()];
      const dateStr = date.toISOString().split('T')[0];
      const dayHolds = holds.filter(h => h.flaggedAt.startsWith(dateStr)).length;
      const dayReleases = holds.filter(h =>
        h.release && h.flaggedAt.startsWith(dateStr)
      ).length;
      return { day: dayName, holds: dayHolds, releases: dayReleases };
    });
    return result;
  })();

  // Exception release summary — live
  const liveExceptionSummary = (() => {
    const counts: Record<string, number> = {};
    holds
      .filter(h => h.release?.releaseType === 'EXCEPTION')
      .forEach(h => {
        const reason = h.release?.reason ?? 'Unknown';
        counts[reason] = (counts[reason] ?? 0) + 1;
      });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count }));
  })();

  // Live washbay — today's log + 30-day avg
  const todayWashbayLog    = getTodayWashbayLog();
  const todayBalanceEntry  = getTodayEntry();
  const liveWashbay30DayAvg = washbayLogs.length >= 3
    ? Math.round(
        (washbayLogs.reduce((s, l) => {
          const ci = l.fullPages * 19 + l.lastPageEntries;
          const cc = Math.max(0, ci - l.carsRemaining);
          return s + (l.shiftHours > 0 ? cc / l.shiftHours : 0);
        }, 0) / washbayLogs.length) * 10
      ) / 10
    : null;

  // ── Mode-selected data ─────────────────────────────────────────────────────

  const isDemo = mode === 'demo';

  const glance = isDemo
    ? DEMO_GLANCE
    : { activeHolds: activeHolds.length, onException, returnedThisWeek };

  const holdTypes = isDemo ? DEMO_HOLD_TYPES : liveHoldTypes;
  const totalHolds = holdTypes.reduce((s, t) => s + t.count, 0) || 1;

  const damageTypes = isDemo ? DEMO_DAMAGE_TYPES : liveDamageTypes;
  const weekActivity = isDemo ? DEMO_WEEK_ACTIVITY : liveWeekActivity;
  const maxActivity = Math.max(...weekActivity.map(d => d.holds + d.releases), 1);
  const exceptionSummary = isDemo ? DEMO_EXCEPTION_SUMMARY : liveExceptionSummary;

  // Fleet balance — always real (Supabase-backed regardless of toggle)
  const fleetBalanceData = Array.from({ length: 7 }, (_, i) => {
    const offsetDays = i - 6;
    const dateStr = localDateStr(offsetDays);
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dayName = d.toLocaleDateString('en-CA', { weekday: 'short' });
    const entry = entries.find(e => e.date === dateStr);
    return { day: dayName, date: dateStr, outCount: entry?.outCount, inCount: entry?.inCount, hasData: !!entry };
  });

  const daysWithData = fleetBalanceData.filter(d => d.hasData);
  const avgGap = daysWithData.length >= 3
    ? Math.round(daysWithData.reduce((sum, d) => sum + ((d.outCount ?? 0) - (d.inCount ?? 0)), 0) / daysWithData.length)
    : null;
  const worstGap = daysWithData.length >= 3
    ? Math.max(...daysWithData.map(d => (d.outCount ?? 0) - (d.inCount ?? 0)))
    : null;
  const returnRate = daysWithData.length >= 3 && avgGap !== null && avgGap > 0
    ? Math.round((daysWithData.reduce((sum, d) => sum + (d.inCount ?? 0), 0) / daysWithData.reduce((sum, d) => sum + (d.outCount ?? 0), 0)) * 100)
    : null;
  const maxFleetCount = Math.max(...fleetBalanceData.filter(d => d.hasData).flatMap(d => [d.outCount ?? 0, d.inCount ?? 0]), 10);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
            {isDemo ? 'Fleet hold summary · sample data' : 'Fleet hold summary · your data'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 transition-colors">
          <button
            type="button"
            onClick={() => setMode('demo')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              isDemo
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Demo
          </button>
          <button
            type="button"
            onClick={() => setMode('live')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
              !isDemo
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Live
          </button>
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
        <StatCard value={glance.activeHolds}       label="Active Holds"        color="text-gray-900 dark:text-gray-100" />
        <StatCard value={glance.onException}       label="On Exception"        color="text-amber-600 dark:text-amber-400" />
        <StatCard value={glance.returnedThisWeek}  label="Returned This Week"  color="text-green-600 dark:text-green-500" />
      </div>

      {/* Holds by type */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <SectionHeader title="Active Holds by Type" />
        {totalHolds === 0 || (activeHolds.length === 0 && !isDemo) ? (
          <EmptyState message="No active holds recorded yet." />
        ) : (
          <div className="space-y-3">
            {holdTypes.map(t => (
              <div key={t.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${t.text} transition-colors`}>{t.label}</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors">{t.count}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden transition-colors">
                  <div
                    className={`h-full rounded-full ${t.color} transition-all`}
                    style={{ width: `${(t.count / totalHolds) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top damage types */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <SectionHeader title={isDemo ? 'Top Damage Types (30 days)' : 'Top Damage Types — Active Holds'} />
        {damageTypes.length === 0 ? (
          <EmptyState message="No damage holds recorded yet." />
        ) : (
          <div className="space-y-2">
            {damageTypes.map((d, i) => (
              <div key={d.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-600 w-4 text-right tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors truncate">{d.label}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors shrink-0">{d.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fleet balance entry (always real) */}
      {canEnter && (
        <FleetBalanceEntryForm onSubmit={handleFleetBalanceSubmit} todayEntry={todayEntry} />
      )}

      {/* Fleet balance chart (always real) */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <SectionHeader title="Fleet Balance — Last 7 Days" />
        {loading ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
        ) : (
          <>
            <div className="flex items-end gap-2 h-28 mb-3">
              {fleetBalanceData.map(d => {
                const outHeight = d.hasData && maxFleetCount > 0 ? ((d.outCount ?? 0) / maxFleetCount) * 100 : 8;
                const inHeight  = d.hasData && maxFleetCount > 0 ? ((d.inCount  ?? 0) / maxFleetCount) * 100 : 8;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end gap-0.5 h-24">
                      <div
                        className={`flex-1 rounded-t transition-all ${d.hasData ? 'bg-amber-400' : 'bg-gray-100 dark:bg-gray-800'}`}
                        style={{ height: `${outHeight}%` }}
                      />
                      <div
                        className={`flex-1 rounded-t transition-all ${d.hasData ? 'bg-green-400' : 'bg-gray-100 dark:bg-gray-800'}`}
                        style={{ height: `${inHeight}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{d.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Out</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">In</span>
              </div>
            </div>
            {daysWithData.length < 3 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                Log at least 3 days of fleet balance to see trend stats.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                {avgGap !== null && (
                  <div className="text-center">
                    <p className={`text-lg font-bold ${avgGap > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {avgGap > 0 ? `+${avgGap}` : avgGap}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Avg gap/day</p>
                  </div>
                )}
                {worstGap !== null && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">+{worstGap}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Worst gap</p>
                  </div>
                )}
                {returnRate !== null && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{returnRate}%</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Return rate</p>
                  </div>
                )}
              </div>
            )}
            {todayEntry && (
              <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">{todayEntry.outCount}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">out</span>
                  <span className="mx-2 text-gray-300 dark:text-gray-700">·</span>
                  <span className="font-semibold">{todayEntry.inCount}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">in</span>
                  <span className="mx-2 text-gray-300 dark:text-gray-700">·</span>
                  <span className={`text-xs font-semibold ${
                    todayEntry.inCount - todayEntry.outCount > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    Net {todayEntry.inCount - todayEntry.outCount > 0 ? '+' : ''}{todayEntry.inCount - todayEntry.outCount}
                  </span>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Logged by {USERS.find(u => u.id === todayEntry.enteredById)?.name ?? todayEntry.enteredById}
                  {' · '}
                  {new Date(todayEntry.enteredAt).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
            {!todayEntry && !canEnterFleetBalance(user.role) && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
                No fleet numbers logged yet today.
              </p>
            )}
          </>
        )}
      </div>

      {/* Hold activity this week */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <SectionHeader title="Hold Activity — This Week" />
        <div className="flex items-end gap-2 h-24 mb-3">
          {weekActivity.map(d => {
            const holdH    = maxActivity > 0 ? (d.holds    / maxActivity) * 100 : 8;
            const releaseH = maxActivity > 0 ? (d.releases / maxActivity) * 100 : 8;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-20">
                  <div className="flex-1 bg-red-400 dark:bg-red-500 rounded-t transition-all" style={{ height: `${holdH}%` }} />
                  <div className="flex-1 bg-green-400 rounded-t transition-all"               style={{ height: `${releaseH}%` }} />
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">{d.day}</span>
              </div>
            );
          })}
        </div>
        {!isDemo && weekActivity.every(d => d.holds === 0 && d.releases === 0) && (
          <EmptyState message="No hold activity recorded this week yet." />
        )}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-400 dark:bg-red-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Holds</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Releases</span>
          </div>
        </div>
      </div>

      {/* Exception release summary */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <SectionHeader title="Exception Release Summary" />
        {exceptionSummary.length === 0 ? (
          <EmptyState message="No exception releases recorded yet." />
        ) : (
          <div className="space-y-2">
            {exceptionSummary.map((e, i) => (
              <div key={e.reason} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-600 w-4 text-right tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors truncate">{e.reason}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors shrink-0">{e.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Washbay Operations */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <SectionHeader title={`Washbay Operations · ${new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).toUpperCase()}`} />

        {isDemo ? (
          // ── Demo view ────────────────────────────────────────────────────────
          <div className="space-y-4">
            {/* Stat row */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{DEMO_WASHBAY_TODAY.carsIn}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Cars In</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{DEMO_WASHBAY_TODAY.carsCleaned}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Cleaned</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{DEMO_WASHBAY_TODAY.throughput.toFixed(1)}/hr</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Throughput</p>
              </div>
            </div>

            {/* Pipeline */}
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

            {/* Net flow */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Net Flow (vs Opening)</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {DEMO_WASHBAY_TODAY.openingCarsOut} out → {DEMO_WASHBAY_TODAY.carsIn} in
                <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                  Net +{DEMO_WASHBAY_TODAY.netFlow} today
                </span>
              </p>
            </div>

            {/* vs standard */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">vs Company Standard</p>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">YWG team: <span className="font-bold">{DEMO_WASHBAY_TODAY.throughput.toFixed(1)}/hr</span></span>
                <span className="text-sm text-gray-500 dark:text-gray-400">Standard: {COMPANY_STANDARD.toFixed(1)}/hr</span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">30-day avg: <span className="font-bold text-gray-800 dark:text-gray-200">{DEMO_WASHBAY_30DAY_AVG.toFixed(1)}/hr</span></span>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  +{(DEMO_WASHBAY_30DAY_AVG - COMPANY_STANDARD).toFixed(1)} above ✅
                </span>
              </div>
            </div>
          </div>
        ) : (
          // ── Live view ─────────────────────────────────────────────────────────
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
