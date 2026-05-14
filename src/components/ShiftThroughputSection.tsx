import type { WashbayLog, HandoffNote } from '../types';

const COMPANY_STANDARD = 3.0;

interface DayData {
  label: string;
  morningRate: number | null;
  closingRate: number | null;
}

interface TodaySnapshot {
  morningCleaned: number | null;
  morningHours: number | null;
  morningRate: number | null;
  closingCleaned: number | null;
  closingHours: number | null;
  closingRate: number | null;
}

interface Props {
  washbayLogs: WashbayLog[];
  handoffNotes: HandoffNote[];
  isDemo: boolean;
  isPeakSeason: boolean;
}

const DEMO_DAYS: DayData[] = [
  { label: 'Mon', morningRate: 5.2, closingRate: 4.1 },
  { label: 'Tue', morningRate: 4.8, closingRate: 4.6 },
  { label: 'Wed', morningRate: 5.5, closingRate: 3.9 },
  { label: 'Thu', morningRate: 4.3, closingRate: 4.8 },
  { label: 'Fri', morningRate: 5.1, closingRate: 4.4 },
  { label: 'Sat', morningRate: 4.9, closingRate: null },
  { label: 'Sun', morningRate: null, closingRate: 4.2 },
];

const DEMO_TODAY: TodaySnapshot = {
  morningCleaned: 42, morningHours: 8.2, morningRate: 5.1,
  closingCleaned: null, closingHours: null, closingRate: null,
};

function buildLiveDays(
  washbayLogs: WashbayLog[],
  handoffNotes: HandoffNote[],
  isPeakSeason: boolean,
): DayData[] {
  const days: DayData[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA');
    const label = d.toLocaleDateString('en-CA', { weekday: 'short' });

    const log = washbayLogs.find(l => l.date === dateStr);
    const handoff = handoffNotes.find(n =>
      new Date(n.loggedAt).toLocaleDateString('en-CA') === dateStr
    );

    let morningRate: number | null = null;
    let morningCleaned: number | null = null;
    let morningHours: number | null = null;

    if (handoff && handoff.morningHours > 0) {
      morningCleaned = handoff.fullPages * 19 + handoff.lastPageEntries;
      morningHours = handoff.morningHours;
      morningRate = morningCleaned / morningHours;
    }

    let closingRate: number | null = null;
    if (log && morningCleaned != null && morningHours != null) {
      const fullDayCleaned = Math.max(0, log.fullPages * 19 + log.lastPageEntries - log.carsRemaining);
      const baseHours = isPeakSeason ? 16 : 15;
      const fullDayOpHours = baseHours + log.overtimeHours;
      const closingCleaned = fullDayCleaned - morningCleaned;
      const closingHours = fullDayOpHours - morningHours;
      if (closingHours > 0 && closingCleaned >= 0) {
        closingRate = closingCleaned / closingHours;
      }
    }

    days.push({ label, morningRate, closingRate });
  }
  return days;
}

function buildTodaySnapshot(
  washbayLogs: WashbayLog[],
  handoffNotes: HandoffNote[],
  isPeakSeason: boolean,
): TodaySnapshot {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const handoff = handoffNotes.find(n =>
    new Date(n.loggedAt).toLocaleDateString('en-CA') === todayStr
  );
  const log = washbayLogs.find(l => l.date === todayStr);

  let morningCleaned: number | null = null;
  let morningHours: number | null = null;
  let morningRate: number | null = null;

  if (handoff && handoff.morningHours > 0) {
    morningCleaned = handoff.fullPages * 19 + handoff.lastPageEntries;
    morningHours = handoff.morningHours;
    morningRate = morningCleaned / morningHours;
  }

  let closingCleaned: number | null = null;
  let closingHours: number | null = null;
  let closingRate: number | null = null;

  if (log && morningCleaned != null && morningHours != null) {
    const fullDayCleaned = Math.max(0, log.fullPages * 19 + log.lastPageEntries - log.carsRemaining);
    const baseHours = isPeakSeason ? 16 : 15;
    const fullDayOpHours = baseHours + log.overtimeHours;
    closingCleaned = fullDayCleaned - morningCleaned;
    closingHours = fullDayOpHours - morningHours;
    if (closingHours > 0 && closingCleaned >= 0) {
      closingRate = closingCleaned / closingHours;
    }
  }

  return { morningCleaned, morningHours, morningRate, closingCleaned, closingHours, closingRate };
}

function rateColor(rate: number): string {
  if (rate >= COMPANY_STANDARD) return 'text-green-600 dark:text-green-400';
  if (rate >= 2.5) return 'text-amber-500 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

export function ShiftThroughputSection({ washbayLogs, handoffNotes, isDemo, isPeakSeason }: Props) {
  const days = isDemo ? DEMO_DAYS : buildLiveDays(washbayLogs, handoffNotes, isPeakSeason);
  const today = isDemo ? DEMO_TODAY : buildTodaySnapshot(washbayLogs, handoffNotes, isPeakSeason);

  const morningRates = days.map(d => d.morningRate).filter((r): r is number => r != null);
  const closingRates = days.map(d => d.closingRate).filter((r): r is number => r != null);
  const morningAvg = morningRates.length > 0 ? morningRates.reduce((a, b) => a + b, 0) / morningRates.length : null;
  const closingAvg = closingRates.length > 0 ? closingRates.reduce((a, b) => a + b, 0) / closingRates.length : null;

  // Scale: minimum 6.0 so 3.0 reference line is always centred in chart
  const maxRate = Math.max(COMPANY_STANDARD * 2, ...morningRates, ...closingRates);
  const refLineBottom = (COMPANY_STANDARD / maxRate) * 100;

  const hasAnyData = morningRates.length > 0 || closingRates.length > 0;
  const hasTodayData = today.morningRate != null || today.closingRate != null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 transition-colors space-y-4">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
        Shift Throughput · Last 7 Days
      </h2>

      {/* Bar chart */}
      {hasAnyData ? (
        <div className="relative flex items-end gap-1.5 h-28">
          {/* Reference line at 3.0/hr */}
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
            style={{ bottom: `${refLineBottom}%` }}
          >
            <div className="flex-1 border-t border-dashed border-gray-300 dark:border-gray-600" />
            <span className="text-[9px] text-gray-400 dark:text-gray-500 px-1 bg-white dark:bg-gray-900 shrink-0 leading-none">
              3.0
            </span>
          </div>

          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5 h-24">
                {d.morningRate != null ? (
                  <div
                    className="flex-1 bg-amber-400 dark:bg-amber-500 rounded-t transition-all"
                    style={{ height: `${Math.max((d.morningRate / maxRate) * 100, 2)}%` }}
                  />
                ) : (
                  <div className="flex-1" />
                )}
                {d.closingRate != null ? (
                  <div
                    className="flex-1 bg-blue-400 dark:bg-blue-500 rounded-t transition-all"
                    style={{ height: `${Math.max((d.closingRate / maxRate) * 100, 2)}%` }}
                  />
                ) : (
                  <div className="flex-1" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{d.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
          No handoff or washbay data in the last 7 days.
        </p>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-400 dark:bg-amber-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Morning</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-400 dark:bg-blue-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Closing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t border-dashed border-gray-400 dark:border-gray-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Standard</span>
        </div>
      </div>

      {/* 7-day averages */}
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">
            Morning avg
          </p>
          {morningAvg != null ? (
            <p className={`text-base font-bold ${rateColor(morningAvg)}`}>{morningAvg.toFixed(1)}/hr</p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">—</p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">
            Closing avg
          </p>
          {closingAvg != null ? (
            <p className={`text-base font-bold ${rateColor(closingAvg)}`}>{closingAvg.toFixed(1)}/hr</p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">—</p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">
            Standard
          </p>
          <p className="text-base font-bold text-gray-400 dark:text-gray-500">3.0/hr</p>
        </div>
      </div>

      {/* Today's snapshot */}
      {hasTodayData && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Today</p>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Morning</span>
            {today.morningRate != null ? (
              <span>
                <span className={`font-semibold ${rateColor(today.morningRate)}`}>
                  {today.morningRate.toFixed(1)}/hr
                </span>
                <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">
                  · {today.morningCleaned} cars · {today.morningHours?.toFixed(1)}h
                </span>
              </span>
            ) : (
              <span className="text-gray-400 dark:text-gray-500 italic text-xs">Handoff not yet submitted</span>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Closing</span>
            {today.closingRate != null ? (
              <span>
                <span className={`font-semibold ${rateColor(today.closingRate)}`}>
                  {today.closingRate.toFixed(1)}/hr
                </span>
                <span className="text-gray-400 dark:text-gray-500 text-xs ml-1.5">
                  · {today.closingCleaned} cars · {today.closingHours?.toFixed(1)}h
                </span>
              </span>
            ) : (
              <span className="text-gray-400 dark:text-gray-500 italic text-xs">Washbay log not yet submitted</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
