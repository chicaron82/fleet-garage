// Today's crew as two lines of numbers: on the read-only /lot/view and FG's My Day card. Never names, never a reason
// (his calls, 2026-10-15). "as of" is the last time anything was changed by hand today.
import { clockOf } from '../../lib/lotBay';
import { driverLine, vsaLine, type CrewSummary } from '../../lib/lotCrew';

export function LotCrewLine({ summary, changedAt, heading = true }: { summary: CrewSummary; changedAt: string | null; heading?: boolean }) {
  return (
    <section aria-label="Crew now" className="space-y-1">
      {heading && (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Crew now</h2>
          {changedAt && <span className="text-[11px] text-gray-500 dark:text-gray-400">changed {clockOf(changedAt)}</span>}
        </div>
      )}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <p className="px-3 py-2"><span className="font-semibold">VSAs</span> <span className="text-gray-700 dark:text-gray-300">{vsaLine(summary.vsa)}</span></p>
        <p className="px-3 py-2"><span className="font-semibold">Drivers</span> <span className="text-gray-700 dark:text-gray-300">{driverLine(summary.driver)}</span></p>
      </div>
    </section>
  );
}
