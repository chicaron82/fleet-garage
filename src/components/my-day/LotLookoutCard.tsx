// FG's side of Lot Lookout on My Day: a GLANCE, since Lot Lookout became its own module (Aaron, 2026-10-15: *"What
// do you think of having lot outlook as an FG module?"*). What is in the bay, how the day's going, today's crew as
// numbers, and one way into the module.
//
// ⭐ The bay log replaced the airport here on 2026-10-29 (*"strictly erin st"*; ticket-lot-lookout-bay-log). And still
// no Erin St strip (2026-10-18): the Erin pill in the top bar is the count.
import { useBayLog } from '../../hooks/useBayLog';
import { useLotCrew } from '../../hooks/useLotCrew';
import { clockOf } from '../../lib/lotBay';
import { baySummary, inTheBay } from '../../lib/lotBayLog';
import { LotCrewLine } from '../lot/LotCrewLine';

export function LotLookoutCard({ cardClass, onOpen }: { cardClass: string; onOpen: () => void }) {
  const bay = useBayLog();
  const { crew } = useLotCrew({ signedIn: true });
  if (!bay.loaded || bay.error) return null;
  const open = inTheBay(bay.rows);
  const s = baySummary(bay.rows);

  return (
    <section className={`${cardClass} px-4 py-3.5 space-y-3`} aria-label="Lot Lookout">
      <button type="button" onClick={onOpen}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Lot Lookout · the bay</span>
          <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
            {open ? `In the bay: ${open.plate} since ${clockOf(open.started_at)}` : "The bay's empty"}
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {s.clean} clean today{s.stillToDo > 0 ? ` · ${s.stillToDo} still to do` : ''}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-gray-700 dark:text-gray-200">Open Lot Lookout ›</span>
      </button>

      {crew && <LotCrewLine summary={crew.summary} />}
    </section>
  );
}
