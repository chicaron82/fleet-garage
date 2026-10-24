// Today's crew as two lines of numbers: on the read-only /lot/view and FG's My Day card. Never names, never a reason
// (his calls, 2026-10-15). Straight from the schedule since 2026-10-24, so there is no "changed at" to show.
import { crewLine, type CrewSummary } from '../../lib/lotCrew';

export function LotCrewLine({ summary, heading = true }: { summary: CrewSummary; heading?: boolean }) {
  return (
    <section aria-label="Crew now" className="space-y-1">
      {heading && (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Crew now</h2>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">from the schedule</span>
        </div>
      )}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <p className="px-3 py-2"><span className="font-semibold">VSAs</span> <span className="text-gray-700 dark:text-gray-300">{crewLine(summary.vsa)}</span></p>
        <p className="px-3 py-2"><span className="font-semibold">Drivers</span> <span className="text-gray-700 dark:text-gray-300">{crewLine(summary.driver)}</span></p>
      </div>
    </section>
  );
}
