import { useState } from 'react';
import { groupRoster, hhmm, type ShiftStanding } from '../../lib/rosterGrouping';
import { nextAttendance, type TeamMate } from '../../lib/myDay';
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
// ⭐ NO BOX (2026-10-24): the crew line is the schedule now (docs/ticket-crew-line-is-the-schedule.md: *"Keeping track is
// too much"*). The box beside each VSA's and driver's name (on their usual job / pulled) is gone; a name tap is
// attendance and nothing else.
export function TeamRoster({ team, setShiftAttendance, now = hhmm() }: {
  team: TeamMate[];
  setShiftAttendance: (id: string, attendance: Attendance | null) => Promise<void>;
  /** Injectable for tests and for a deterministic render; defaults to the wall clock. */
  now?: string;
}) {
  const [note, setNote] = useState('');
  if (team.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Nobody else scheduled.</p>;
  }
  const sections = groupRoster(team, now);

  // The schedule's setter THROWS when it can't save; fired and forgotten, a tap with no signal left the pill unmarked
  // with nothing said (line-check, 2026-10-18). So it is caught and said here.
  const tapName = async (mate: TeamMate) => {
    setNote('');
    try {
      await setShiftAttendance(mate.id, nextAttendance(mate.attendance) ?? null);
    } catch {
      setNote('No signal. Nobody was marked.');
    }
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Tap a name: scheduled → present → no-show.
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
            {section.mates.map(({ mate, standing }) => (
              <RosterPill key={mate.id} mate={mate} standing={standing} onTap={() => void tapName(mate)} />
            ))}
          </div>
        </div>
      ))}
      {note && <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">{note}</p>}
    </div>
  );
}

function RosterPill({ mate, standing, onTap }: { mate: TeamMate; standing: ShiftStanding; onTap: () => void }) {
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
    </div>
  );
}
