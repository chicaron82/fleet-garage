import { COMPANY_STANDARD, EmptyState } from '../lib/analytics';
import type { Hold, WashbayLog } from '../types';
import type { FleetBalanceEntry } from '../hooks/useFleetBalance';

export function WashbayLiveSection({ todayWashbayLog, todayBalanceEntry, activeHolds, liveWashbay30DayAvg }: {
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
