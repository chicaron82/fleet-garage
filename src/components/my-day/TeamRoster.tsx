import { groupRoster, hhmm, type RoleGroup, type ShiftStanding } from '../../lib/rosterGrouping';
import { nextAttendance, type TeamMate } from '../../lib/myDay';
import { boxOf, crewWriteForAttendance, crewWriteForBox, hasBox, type BoxState, type CrewEntry } from '../../lib/rosterCrew';
import type { CrewState } from '../../lib/lotCrew';
import type { Attendance } from '../../types';

// "On with you today", grouped the way he thinks about his floor — Aaron, 2026-08-26:
// *"VSA in one group, drivers in another… it would show who's currently working at this point in
// time."* See lib/rosterGrouping for why the ENDED people stay on screen instead of disappearing.
//
// The frame stays TODAY. Time drives order and emphasis only, so one list answers both "who is
// still on with me" and, read from the couch at 18:26, "who is working right now".
//
// ⭐ A GRID, THREE ACROSS (2026-10-18): *"sometimes when i'm quickly tapping people as present what i wanted to tap next
// is moved because the first person's pill grew"*. Present added a ✓ and swapped the start for "til END" inside a
// wrapping row, so every pill after it shifted. Every pill now fills a fixed cell, and his next ruling took the marks
// out entirely: *"the colour already signifies the status"*. Present reads "→END".
//
// ⭐ THE BOX (VSAs and drivers, same day): ticked = on their usual job, unticked = pulled. It is the crew line
// (lot_crew), so Lot Lookout reads the same thing. Empty until present (*"stay empty until marked present"*).
// Its own tap target beside the name, so reaching for one never lands on the other.
export function TeamRoster({ team, setShiftAttendance, now = hhmm(), crewOf, onCrew }: {
  team: TeamMate[];
  setShiftAttendance: (id: string, attendance: Attendance | null) => Promise<void>;
  /** Injectable for tests and for a deterministic render; defaults to the wall clock. */
  now?: string;
  /** The crew line, by person. Without it (and onCrew) there is no box. */
  crewOf?: (userId: string) => CrewEntry | undefined;
  onCrew?: (userId: string, next: CrewState | 'clear') => void;
}) {
  if (team.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Nobody else scheduled.</p>;
  }
  const sections = groupRoster(team, now);
  const boxes = !!onCrew;

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Tap a name: scheduled → present → no-show.{boxes && ' The box: on their usual job.'}
      </p>
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
          <div className="grid grid-cols-3 gap-1.5">
            {section.mates.map(({ mate, standing }) => {
              const crew = mate.userId ? crewOf?.(mate.userId) : undefined;
              const withBox = boxes && hasBox(section.group) && !!mate.userId;
              return (
                <RosterPill
                  key={mate.id}
                  mate={mate}
                  standing={standing}
                  box={withBox ? boxOf(section.group, mate.attendance, crew) : null}
                  onTap={() => {
                    void setShiftAttendance(mate.id, nextAttendance(mate.attendance) ?? null);
                    const w = withBox ? crewWriteForAttendance(section.group, crew) : null;
                    if (w) onCrew!(mate.userId!, w);
                  }}
                  onBox={() => boxTap(section.group, mate, crew, onCrew)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function boxTap(group: RoleGroup, mate: TeamMate, crew: CrewEntry | undefined, onCrew?: (u: string, s: CrewState | 'clear') => void) {
  const w = crewWriteForBox(group, boxOf(group, mate.attendance, crew));
  if (w && mate.userId) onCrew?.(mate.userId, w);
}

function RosterPill({ mate, standing, box, onTap, onBox }: {
  mate: TeamMate; standing: ShiftStanding; box: BoxState | null; onTap: () => void; onBox: () => void;
}) {
  const att = mate.attendance;
  const tone = box === 'pulled'
    ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800'
    : att === 'present'
      ? 'bg-green-100 text-green-800 ring-1 ring-green-300 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800'
      : att === 'absent'
        ? 'bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  // ⚠️ DIMMED, NEVER REMOVED, and still a full-size tap target. The pill is the ONLY way to record
  // an attendance, so a teammate whose shift ended has to stay reachable — a forgotten no-show is
  // most often noticed after the person has gone home. Same rule as the odometer's clear.
  const faded = standing === 'done' ? 'opacity-45' : '';
  return (
    <div data-pill className={`min-w-0 h-7 flex items-center rounded-full overflow-hidden transition ${tone} ${faded}`}>
      <button
        type="button"
        onClick={onTap}
        className="flex-1 min-w-0 h-full flex items-center gap-0.5 pl-2 pr-0.5 text-xs text-left cursor-pointer"
      >
        <span className={`min-w-0 truncate ${att === 'absent' ? 'line-through' : ''}`}>{mate.displayName}</span>
        {/* Default shows START (who I begin the shift with). Marking present flips it to "→END" —
            the overlap question once I know they're actually here. Someone already gone reads "→"
            regardless: their start time stopped being the useful fact hours ago. */}
        <span className="shrink-0 tabular-nums text-[11px] opacity-60">
          {att === 'present' || standing === 'done' ? `→${mate.end}` : mate.start}
        </span>
      </button>
      {box && (
        <button type="button" onClick={onBox} aria-pressed={box === 'on'}
          aria-label={box === 'off' ? `${mate.displayName}: mark present first` : box === 'on' ? `${mate.displayName} on the usual job. Tap if pulled` : `${mate.displayName} pulled. Tap when back`}
          className="shrink-0 w-6 h-7 grid place-items-center cursor-pointer">
          <span aria-hidden="true" className={`w-4 h-4 rounded grid place-items-center border-[1.5px] ${
            box === 'on' ? 'bg-green-700 border-green-700' : box === 'pulled' ? 'bg-white dark:bg-gray-900 border-amber-700' : 'border-gray-300 dark:border-gray-600'}`}>
            {box === 'on' && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            )}
          </span>
        </button>
      )}
    </div>
  );
}
