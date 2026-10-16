// Lot Lookout's top of screen: the four counts, the "low on cleans" verdict, freshness, and the colour legend.
// Shared by the public /lot page and FG's My Day card, so the two can never count differently.
import { agoLabel, CLEANS_LOW, type LotTotals } from '../../lib/lotLookout';

interface Props {
  totals: LotTotals;
  aisleCars: number;
  /** The legend is for the page someone taps on; FG's card leaves it out. */
  showLegend?: boolean;
}

export function LotSummary({ totals, aisleCars, showLegend = true }: Props) {
  const tile = 'px-1.5 py-2 text-center min-w-0 rounded-xl';
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-x divide-gray-200 dark:divide-gray-700">
        <div className={tile}>
          <b className="block text-2xl font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{totals.open}</b>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">open stalls</span>
          {totals.taken > 0 && (
            <span className="block text-[10px] font-bold text-gray-600 dark:text-gray-300">{totals.taken} taken</span>
          )}
        </div>
        <div className={tile}>
          <b className="block text-2xl font-extrabold tabular-nums text-green-700 dark:text-green-400">{totals.cleansSeen}</b>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">cleans seen</span>
        </div>
        <div className={`${tile} ${totals.nPulse ? 'lot-pulse' : ''}`}>
          <b className="block text-2xl font-extrabold tabular-nums text-red-700 dark:text-red-400">{totals.dirties}</b>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">dirties</span>
          {totals.misparked > 0 && (
            <span className="block text-[10px] font-bold text-red-700 dark:text-red-400">{totals.misparked} in clean stalls</span>
          )}
        </div>
        <div className={`${tile} ${totals.aislePulse ? 'lot-pulse' : ''}`}>
          <b className={`block text-2xl font-extrabold tabular-nums ${aisleCars > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{aisleCars}</b>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">in the aisle</span>
        </div>
      </div>

      <div
        role="status"
        // FG's alert shape (the Holds "Exception Returns" box): a tint, a border, a strong line and a quiet one.
        // Red stays red: on this board it means short of cleans (Aaron, 2026-10-15, "green for your recs").
        className={`flex flex-wrap justify-between items-baseline gap-2 rounded-xl border px-4 py-3 ${
          totals.low
            ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700/50'
            : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700/50'}`}
      >
        <span className={`text-sm font-semibold ${totals.low ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'}`}>
          {totals.low ? `Low on cleans: ${totals.cleansSeen} seen. Fill up if you can.` : `Not low: ${totals.cleansSeen} cleans seen`}
        </span>
        <span className={`text-xs ${totals.low ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{totals.low ? `under ${CLEANS_LOW}` : `${CLEANS_LOW} or more`}</span>
      </div>

      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>Last touched <strong className="font-semibold text-gray-900 dark:text-gray-100">{agoLabel(totals.lastTouchMin)}</strong></span>
        <span><strong className="font-semibold text-gray-900 dark:text-gray-100">{totals.notLooked}</strong> not looked at in 2h</span>
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm border-[1.5px] border-gray-400 bg-white" />Open</span>
          <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm bg-green-700" />Clean</span>
          <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm bg-red-700" />Dirty</span>
          <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm bg-gray-500" />Taken (hold the stall)</span>
          <span className="flex items-center gap-1">
            <i className="inline-block w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900" />
            <i className="inline-block w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900" />Faded: not looked at in 2h
          </span>
          <span className="flex items-center gap-1"><b className="text-red-700 dark:text-red-400">!</b> Return in a clean stall</span>
        </div>
      )}
    </div>
  );
}
