// Today's crew as two lines of numbers: on the read-only /lot/view and FG's My Day card. Never names, never a reason
// (his calls, 2026-10-15). Straight from the schedule since 2026-10-24, so there is no "changed at" to show.
import { crewLine, type CrewSummary } from '../../lib/lotCrew';

/** `big`: the read-only desktop's left column (docs/ticket-lot-view-desktop-layout.md), larger from `lg` up only. */
export function LotCrewLine({ summary, heading = true, big = false }: { summary: CrewSummary; heading?: boolean; big?: boolean }) {
  const row = big ? 'px-3 py-2 lg:px-5 lg:py-3.5' : 'px-3 py-2';
  // The read-only column's sizer (lotFit.css) tightens the big rows when the window is short.
  const fit = big ? { 'data-fit-row': '' } : {};
  return (
    <section aria-label="Crew now" className="space-y-1">
      {heading && (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Crew now</h2>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">from the schedule</span>
        </div>
      )}
      <div className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700 text-sm ${big ? 'lg:text-lg' : ''}`}>
        {/* No VSA on = nobody in the bay (Aaron, 2026-11-19: *"VSA's none right now showing a bit more urgency"*).
            Same words, louder: the schedule's fact, never a reason. Drivers stay quiet. */}
        {summary.vsa.on === 0 ? (
          <p {...fit} data-urgent className={`${row} flex items-center gap-2 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200 first:rounded-t-2xl`}>
            <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 animate-pulse" />
            <span><span className="font-semibold">VSAs</span> <span className="font-bold">{crewLine(summary.vsa)}</span></span>
          </p>
        ) : (
          <p {...fit} className={row}><span className="font-semibold">VSAs</span> <span className="text-gray-700 dark:text-gray-300">{crewLine(summary.vsa)}</span></p>
        )}
        <p {...fit} className={row}><span className="font-semibold">Drivers</span> <span className="text-gray-700 dark:text-gray-300">{crewLine(summary.driver)}</span></p>
      </div>
    </section>
  );
}
