// Static analytics — sample data for demo purposes

import { useAuth } from '../context/AuthContext';
import { useFleetBalance } from '../hooks/useFleetBalance';
import { FleetBalanceEntryForm } from './FleetBalanceEntryForm';

// Helper to check if user can enter fleet balance
function canEnterFleetBalance(role: string): boolean {
  return ['Branch Manager', 'Operations Manager', 'Lead VSA'].includes(role);
}

const HOLD_TYPES = [
  { label: 'Damage',     count: 14, color: 'bg-amber-400',  text: 'text-amber-700 dark:text-amber-400' },
  { label: 'Detail',     count: 6,  color: 'bg-teal-400',   text: 'text-teal-700 dark:text-teal-400' },
  { label: 'Mechanical', count: 5,  color: 'bg-blue-400',   text: 'text-blue-700 dark:text-blue-400' },
];

const DAMAGE_TYPES = [
  { label: 'Scratch — paint surface',           count: 8 },
  { label: 'Windshield chip',                   count: 5 },
  { label: 'Bumper damage — cosmetic',           count: 4 },
  { label: 'Scratch — to bare metal',           count: 3 },
  { label: 'Rim / hubcap damage',               count: 2 },
  { label: 'Dent — minor (no paint break)',     count: 2 },
];

const WEEK_ACTIVITY = [
  { day: 'Mon', holds: 3, releases: 1 },
  { day: 'Tue', holds: 2, releases: 2 },
  { day: 'Wed', holds: 5, releases: 1 },
  { day: 'Thu', holds: 1, releases: 3 },
  { day: 'Fri', holds: 4, releases: 2 },
  { day: 'Sat', holds: 2, releases: 0 },
  { day: 'Sun', holds: 1, releases: 1 },
];

const maxActivity = Math.max(...WEEK_ACTIVITY.map(d => d.holds + d.releases));

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const { entries, loading, upsertEntry, getTodayEntry } = useFleetBalance();

  if (!user) return null;

  const totalHolds = HOLD_TYPES.reduce((s, t) => s + t.count, 0);
  const canEnter = canEnterFleetBalance(user.role);
  const todayEntry = getTodayEntry();

  const handleFleetBalanceSubmit = async (outCount: number, inCount: number): Promise<boolean> => {
    const today = new Date().toISOString().split('T')[0];
    return await upsertEntry(today, outCount, inCount, user.id);
  };

  // Generate last 7 days array
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const fleetBalanceData = last7Days.map((date) => {
    const entry = entries.find(e => e.date === date);
    const dayName = new Date(date).toLocaleDateString('en-CA', { weekday: 'short' });
    return {
      day: dayName,
      date,
      outCount: entry?.outCount,
      inCount: entry?.inCount,
      hasData: !!entry,
    };
  });

  const daysWithoutData = fleetBalanceData.filter(d => !d.hasData).length;
  const daysWithData = fleetBalanceData.filter(d => d.hasData);

  // Calculate mini stats only from days with data
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

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">
            Fleet hold summary · sample data
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
          Demo
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={totalHolds} label="Active Holds" color="text-gray-900 dark:text-gray-100" />
        <StatCard value={8} label="On Exception" color="text-amber-600 dark:text-amber-400" />
        <StatCard value={3} label="Returned This Week" color="text-green-600 dark:text-green-500" />
      </div>

      {/* Holds by type */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
          Active Holds by Type
        </h2>
        <div className="space-y-3">
          {HOLD_TYPES.map(t => (
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
      </div>

      {/* Top damage types */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
          Top Damage Types (30 days)
        </h2>
        <div className="space-y-2">
          {DAMAGE_TYPES.map((d, i) => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 dark:text-gray-600 w-4 text-right tabular-nums">{i + 1}</span>
              <div className="flex-1 flex items-center justify-between gap-2">
                <span className="text-sm text-gray-700 dark:text-gray-300 transition-colors truncate">{d.label}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors shrink-0">{d.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fleet Balance Entry Form (Management + Lead VSA only) */}
      {canEnter && (
        <FleetBalanceEntryForm
          onSubmit={handleFleetBalanceSubmit}
          todayEntry={todayEntry}
        />
      )}

      {/* Fleet Balance Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
          Fleet Balance — Last 7 Days
        </h2>
        {loading ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">Loading...</div>
        ) : (
          <>
            <div className="flex items-end gap-2 h-28 mb-3">
              {fleetBalanceData.map(d => {
                const outHeight = d.hasData && maxFleetCount > 0 ? ((d.outCount ?? 0) / maxFleetCount) * 100 : 8;
                const inHeight = d.hasData && maxFleetCount > 0 ? ((d.inCount ?? 0) / maxFleetCount) * 100 : 8;

                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '80px' }}>
                      {/* OUT bar */}
                      <div
                        className={`flex-1 rounded-t-md transition-all ${
                          d.hasData
                            ? 'bg-amber-400 dark:bg-amber-500'
                            : 'bg-gray-300 dark:bg-gray-700 border border-dashed border-gray-400 dark:border-gray-600'
                        }`}
                        style={{ height: `${outHeight}%` }}
                        title={d.hasData ? `OUT: ${d.outCount}` : 'No data'}
                      />
                      {/* IN bar */}
                      <div
                        className={`flex-1 rounded-t-md transition-all ${
                          d.hasData
                            ? 'bg-green-400 dark:bg-green-500'
                            : 'bg-gray-300 dark:bg-gray-700 border border-dashed border-gray-400 dark:border-gray-600'
                        }`}
                        style={{ height: `${inHeight}%` }}
                        title={d.hasData ? `IN: ${d.inCount}` : 'No data'}
                      />
                    </div>
                    <span className={`text-[10px] ${d.hasData ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
                      {d.day}
                    </span>
                    {!d.hasData && (
                      <span className="text-[9px] text-gray-400 dark:text-gray-600">N/A</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Gap</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {avgGap !== null ? avgGap : '—'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Worst Gap</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {worstGap !== null ? worstGap : '—'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Return Rate</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {returnRate !== null ? `${returnRate}%` : '—'}
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">OUT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">IN</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Data not provided callout */}
      {daysWithoutData > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-600 dark:text-gray-400 transition-colors">
          ℹ️ {daysWithoutData} day(s) this week have no fleet numbers logged.
          {canEnter && (
            <span className="block mt-1 text-xs text-gray-500 dark:text-gray-500">
              Branch Manager or Lead VSA can log today's numbers above.
            </span>
          )}
        </div>
      )}

      {/* Week activity */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
          Hold Activity — This Week
        </h2>
        <div className="flex items-end gap-2 h-28">
          {WEEK_ACTIVITY.map(d => {
            const total = d.holds + d.releases;
            const heightPct = maxActivity > 0 ? (total / maxActivity) * 100 : 0;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                  <div
                    className="w-full rounded-t-md bg-yellow-400 dark:bg-yellow-500 transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{d.day}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">New holds</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Releases</span>
          </div>
        </div>
      </div>

      {/* Exception summary */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
          Exception Release Summary
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800/40 transition-colors">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">8</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">Currently on exception</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800/40 transition-colors">
            <p className="text-2xl font-bold text-green-600 dark:text-green-500">3</p>
            <p className="text-xs text-green-700 dark:text-green-600 mt-0.5">Returned this week</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800/40 transition-colors">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">2</p>
            <p className="text-xs text-red-700 dark:text-red-500 mt-0.5">Past expected return</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/40 transition-colors">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">5</p>
            <p className="text-xs text-blue-700 dark:text-blue-500 mt-0.5">Avg days on exception</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center transition-colors">
      <p className={`text-2xl font-bold ${color} transition-colors`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-colors">{label}</p>
    </div>
  );
}
