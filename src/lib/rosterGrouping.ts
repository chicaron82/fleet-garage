import type { UserRole } from '../types';
import type { TeamMate } from './myDay';

// How the "On with you today" roster is organised — Aaron, 2026-08-26, at home after an opening:
// *"what do you think about sorting who i'm working with? VSA in one group, drivers in another.
// then after their scheduled time they disappear… it would show who's currently working at this
// point in time."*
//
// ⚠️ HALF OF THAT IS RIGHT AND HALF WOULD BREAK SOMETHING. The grouping is right — a driver and a
// VSA are different kinds of teammate to him, and `profiles.role` already knows which is which. But
// making a pill DISAPPEAR at its end time was pushed back on, and he agreed:
//
//   1. **It deletes the correction path.** Those pills are the ONLY way to mark present/no-show. A
//      pill that vanishes at 15:16 takes an un-tapped attendance record with it — the same defect
//      as the odometer having no clear (`bc82c94`) and the key-count row before it: the escape
//      hatch disappears at exactly the moment it is needed.
//   2. **The label would start lying with the clock.** The card says "On with you today". If it
//      silently means "on right now", it answers a different question at 07:00 than at 18:26 —
//      which is precisely the sightings-chip defect (`9767cb7`), where an all-time count was welded
//      to a latest date and composed a claim neither half made.
//
// ⭐ So: REVEAL, DON'T CHOOSE. "Today" stays the frame; time becomes ORDER and EMPHASIS, never a
// filter. Everyone remains present and tappable, and both readings — "who's left with me" and "who
// is working right now" — are answerable off one list.

/** The three roster groups he actually thinks in. Everything that is not a VSA or a driver is
 *  `other` (managers, CSR, HIR) — real people on the roster, but not his line. */
export type RoleGroup = 'vsa' | 'driver' | 'other';

export function roleGroup(role: UserRole): RoleGroup {
  if (role === 'VSA' || role === 'Lead VSA') return 'vsa';
  if (role === 'Driver') return 'driver';
  return 'other';
}

export const ROLE_GROUP_LABEL: Record<RoleGroup, string> = {
  vsa: 'VSAs', driver: 'Drivers', other: 'Other',
};

/** Where a teammate sits relative to right now. */
export type ShiftStanding = 'now' | 'later' | 'done';

/**
 * ⚠️ MIDNIGHT IS THE CASE THAT BREAKS NAIVE STRING COMPARISON. Closers run til 23:00 and a clopen
 * can end past 00:00, so `end < start` means the shift crosses midnight and has NOT ended — a plain
 * `now >= end` would mark a 22:00–00:30 shift "done" all evening.
 *
 * Times are "HH:MM" 24h, which compares correctly as strings within a day; the crossover is the one
 * case that needs saying out loud.
 */
export function standingAt(mate: TeamMate, nowHHMM: string): ShiftStanding {
  const { start, end } = mate;
  if (!start || !end) return 'now';        // an unknown span is not evidence they've gone
  const crossesMidnight = end < start;
  if (crossesMidnight) return nowHHMM >= start || nowHHMM < end ? 'now' : 'later';
  if (nowHHMM < start) return 'later';
  return nowHHMM < end ? 'now' : 'done';
}

const ORDER: Record<ShiftStanding, number> = { now: 0, later: 1, done: 2 };

export interface RosterSection {
  group: RoleGroup;
  label: string;
  mates: { mate: TeamMate; standing: ShiftStanding }[];
  /** How many of this group are on the floor right now — the number he scans for. */
  onNow: number;
}

/**
 * Group by role, then order within each group by standing (on now → later → done).
 *
 * ⚠️ Ordering, NOT filtering. `done` mates stay in the list — dimmed by the renderer — so a
 * forgotten attendance tap is still reachable at 9pm.
 *
 * Groups come back in a fixed order (VSAs, Drivers, Other) rather than by size, so the list doesn't
 * reshuffle under his thumb as the day progresses. Empty groups are dropped.
 */
export function groupRoster(team: readonly TeamMate[], nowHHMM: string): RosterSection[] {
  const order: RoleGroup[] = ['vsa', 'driver', 'other'];
  return order.flatMap(group => {
    const mates = team
      .filter(m => roleGroup(m.role) === group)
      .map(mate => ({ mate, standing: standingAt(mate, nowHHMM) }))
      .sort((a, b) => ORDER[a.standing] - ORDER[b.standing]
        || a.mate.start.localeCompare(b.mate.start));
    if (mates.length === 0) return [];
    return [{
      group, label: ROLE_GROUP_LABEL[group], mates,
      onNow: mates.filter(m => m.standing === 'now').length,
    }];
  });
}

/** "HH:MM" for a Date — the roster's own time format, so comparisons stay string-simple. */
export function hhmm(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
