// Erin St's count as one strip: cleans ready and dirties waiting, each with its "as of" time. Shown above the
// airport board on /lot (a driver sees what is waiting at Erin St) and on the read-only /lot/view.
//
// ⚠️ Times, never initials: it is about the count, not about who is in the bay (Aaron, 2026-10-15). And never a
// bare number: his ruling is that each count is a snapshot, true as of its time. Amber past 30 min.
import { clockOf, isBayStale, type LotBay } from '../../lib/lotBay';
import { agoLabel, minutesAgo } from '../../lib/lotLookout';

function Stamp({ at, nowMs }: { at: string | null; nowMs: number }) {
  if (!at) return <span className="block text-[11px] font-semibold text-amber-700 dark:text-amber-400">not counted yet</span>;
  const old = isBayStale(at, nowMs);
  return (
    <span className={`block text-[11px] ${old ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
      as of {clockOf(at)} · {agoLabel(minutesAgo(at, nowMs))}
    </span>
  );
}

export function LotBayStrip({ bay, nowMs }: { bay: LotBay; nowMs: number }) {
  const cleansOld = isBayStale(bay.cleansAt, nowMs);
  const dirtiesOld = isBayStale(bay.dirtiesAt, nowMs);
  return (
    <section aria-label="Erin St" className="space-y-1">
      <h2 className="px-0.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Erin St</h2>
      <div className="grid grid-cols-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-x divide-gray-200 dark:divide-gray-700">
        <div className="px-3 py-2 min-w-0">
          <b className={`block text-2xl font-extrabold tabular-nums ${cleansOld ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>{bay.cleans}</b>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">cleans ready for the airport</span>
          <Stamp at={bay.cleansAt} nowMs={nowMs} />
        </div>
        <div className="px-3 py-2 min-w-0">
          <b className={`block text-2xl font-extrabold tabular-nums ${dirtiesOld ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'}`}>{bay.dirties ?? '–'}</b>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">dirties waiting</span>
          <Stamp at={bay.dirtiesAt} nowMs={nowMs} />
        </div>
      </div>
    </section>
  );
}
