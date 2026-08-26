import { groupRoster, hhmm, type ShiftStanding } from '../../lib/rosterGrouping';
import { nextAttendance, type TeamMate } from '../../lib/myDay';
import type { Attendance } from '../../types';

// "On with you today", grouped the way he thinks about his floor — Aaron, 2026-08-26:
// *"VSA in one group, drivers in another… it would show who's currently working at this point in
// time."* See lib/rosterGrouping for why the ENDED people stay on screen instead of disappearing.
//
// The frame stays TODAY. Time drives order and emphasis only, so one list answers both "who is
// still on with me" and, read from the couch at 18:26, "who is working right now".
export function TeamRoster({ team, setShiftAttendance, now = hhmm() }: {
  team: TeamMate[];
  setShiftAttendance: (id: string, attendance: Attendance | null) => Promise<void>;
  /** Injectable for tests and for a deterministic render; defaults to the wall clock. */
  now?: string;
}) {
  if (team.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Nobody else scheduled.</p>;
  }
  const sections = groupRoster(team, now);

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-gray-400 dark:text-gray-500">Tap a name: scheduled → present → no-show.</p>
      {sections.map(section => (
        <div key={section.group}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {section.label}
            {/* The number he actually scans for. Said plainly rather than implied by what's visible,
                because "how many are still here" should not require counting pills. */}
            <span className="ml-1.5 font-medium normal-case tracking-normal">
              {section.onNow > 0 ? `· ${section.onNow} on now` : '· none on now'}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {section.mates.map(({ mate, standing }) => (
              <RosterPill
                key={mate.id}
                mate={mate}
                standing={standing}
                onTap={() => setShiftAttendance(mate.id, nextAttendance(mate.attendance) ?? null)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RosterPill({ mate, standing, onTap }: {
  mate: TeamMate; standing: ShiftStanding; onTap: () => void;
}) {
  const att = mate.attendance;
  const tone = att === 'present'
    ? 'bg-green-100 text-green-800 ring-1 ring-green-300 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800'
    : att === 'absent'
      ? 'bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  // ⚠️ DIMMED, NEVER REMOVED, and still a full-size tap target. The pill is the ONLY way to record
  // an attendance, so a teammate whose shift ended has to stay reachable — a forgotten no-show is
  // most often noticed after the person has gone home. Same rule as the odometer's clear.
  const faded = standing === 'done' ? 'opacity-45' : '';
  return (
    <button
      type="button"
      onClick={onTap}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition cursor-pointer ${tone} ${faded}`}
    >
      {att === 'present' && <span aria-hidden className="font-bold">✓</span>}
      {att === 'absent' && <span aria-hidden className="font-bold">✗</span>}
      <span className={att === 'absent' ? 'line-through' : ''}>{mate.displayName}</span>
      {/* Default shows START (who I begin the shift with). Marking present flips it to "til END" —
          the overlap question once I know they're actually here. Someone already gone reads "til"
          regardless: their start time stopped being the useful fact hours ago. */}
      <span className="tabular-nums opacity-60">
        {att === 'present' || standing === 'done' ? `til ${mate.end}` : mate.start}
      </span>
    </button>
  );
}
