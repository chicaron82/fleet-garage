import { describeConflict, type WorkDayConflict } from '../../lib/workDays';
import { useWorkDayConflicts } from '../../hooks/useWorkDayConflicts';

/**
 * "Scheduled on a day they can't work" — one sentence per shift. Red, because Aaron called it an
 * ERROR (*"Grant can only work Tues and Thurs. if scheduled any other day, its an error"*), not a
 * heads-up like the amber clopen banner beside it. Renders nothing when there are none.
 *
 * ⚠️ Says it; never refuses it. The fix is the schedule (or the sheet), and that is his call.
 */
export function WorkDayConflictsNotice({ conflicts, lead }: { conflicts: readonly WorkDayConflict[]; lead: string }) {
  if (conflicts.length === 0) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 dark:border-red-900/60 dark:bg-red-900/15">
      <p className="text-xs font-semibold text-red-800 dark:text-red-300">
        ⛔ {lead} — {conflicts.length} shift{conflicts.length === 1 ? '' : 's'} on a day they can't work:
      </p>
      <ul className="mt-0.5 space-y-0.5 text-xs text-red-700 dark:text-red-400">
        {conflicts.map(c => <li key={`${c.name}-${c.date}`}>{describeConflict(c)}</li>)}
      </ul>
    </div>
  );
}

/** The Schedule screen's copy: stored shifts, today → six weeks out. */
export function WorkDayConflictsBanner() {
  const conflicts = useWorkDayConflicts();
  return <WorkDayConflictsNotice conflicts={conflicts} lead="Schedule error" />;
}
