// 30-day coverage-pattern panel for a single driver, expanded under their row in
// DriverCoverageSection. Pure presentational — given the computed HistoryData.

export interface HistoryRow { date: string; gap: number; cleans: number; }

export interface HistoryData {
  avgGapMinutes:   number;
  totalShifts:     number;
  shiftsWithGap20: number;
  shiftsWithCleans: number;
  correlation:     number;
  recent:          HistoryRow[];
}

export function HistoryPanel({ name, data }: { name: string; data: HistoryData | null }) {
  if (!data) {
    return (
      <div className="mt-2 mb-1 ml-4 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          Collecting data — check back after a few shifts.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 mb-1 ml-4 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 space-y-3">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
        {name} · 30-Day Pattern
      </p>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Avg gap',     value: `${data.avgGapMinutes}m` },
          { label: 'Shifts ≥20m', value: `${data.shiftsWithGap20}/${data.totalShifts}` },
          { label: 'Correlation', value: `${data.correlation} shifts` },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{value}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
          Recent shifts
        </p>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pb-1 border-b border-gray-200 dark:border-gray-700">
          <span>Date</span>
          <span className="w-10 text-center">Gap</span>
          <span className="w-12 text-center">Cleans</span>
        </div>
        {data.recent.map(row => (
          <div
            key={row.date}
            className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center py-1 border-b border-gray-100 dark:border-gray-800/50 last:border-0"
          >
            <span className="text-xs text-gray-600 dark:text-gray-400">{row.date}</span>
            <span className={`w-10 text-center text-xs tabular-nums ${row.gap >= 20 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {row.gap}m
            </span>
            <span className="w-12 text-center text-xs tabular-nums text-gray-700 dark:text-gray-300">
              {row.cleans > 0 ? row.cleans : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
