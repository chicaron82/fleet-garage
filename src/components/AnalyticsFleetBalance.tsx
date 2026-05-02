import { SectionHeader } from '../lib/analytics';
import { FleetBalanceEntryForm } from './FleetBalanceEntryForm';
import { USERS } from '../data/mock';
import type { FleetBalanceEntry } from '../hooks/useFleetBalance';

interface BalanceDay {
  day: string; date: string;
  outCount?: number; inCount?: number;
  hasData: boolean;
}

export function AnalyticsFleetBalance({ fleetBalanceData, loading, todayEntry, canEnter, onSubmit }: {
  fleetBalanceData: BalanceDay[];
  loading: boolean;
  todayEntry: FleetBalanceEntry | undefined;
  canEnter: boolean;
  onSubmit: (outCount: number, inCount: number) => Promise<boolean>;
}) {
  const daysWithData = fleetBalanceData.filter(d => d.hasData);
  const maxFleetCount = Math.max(...fleetBalanceData.filter(d => d.hasData).flatMap(d => [d.outCount ?? 0, d.inCount ?? 0]), 10);

  const avgGap = daysWithData.length >= 3
    ? Math.round(daysWithData.reduce((sum, d) => sum + ((d.outCount ?? 0) - (d.inCount ?? 0)), 0) / daysWithData.length)
    : null;
  const worstGap = daysWithData.length >= 3
    ? Math.max(...daysWithData.map(d => (d.outCount ?? 0) - (d.inCount ?? 0)))
    : null;
  const returnRate = daysWithData.length >= 3 && avgGap !== null && avgGap > 0
    ? Math.round((daysWithData.reduce((sum, d) => sum + (d.inCount ?? 0), 0) / daysWithData.reduce((sum, d) => sum + (d.outCount ?? 0), 0)) * 100)
    : null;

  return (
    <>
      {canEnter && (
        <FleetBalanceEntryForm onSubmit={onSubmit} todayEntry={todayEntry} />
      )}

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

            {!todayEntry && !canEnter && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
                No fleet numbers logged yet today.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
