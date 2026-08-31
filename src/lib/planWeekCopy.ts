// Copying one week of shifts onto another — the pure decision half.
//
// ⭐ Aaron, on shift, 2026-08-31: *"for the drivers schedule this week. could you repeat last weeks
// schedule / and could there be an option in FG to do that?"* The 14 drivers had a full week on
// Aug 24-30 and nothing at all for Aug 31-Sep 6, because their week is set weekly and mostly it is
// last week again. `FillScheduleModal` cannot do this: it generates a PATTERN (pick days-of-week,
// apply one shift type), which builds a shape from scratch and cannot carry fourteen different
// people's fourteen different shapes forward.
//
// ⭐⭐ AND HE SET THE BAR, LOWER THAN I WOULD HAVE BUILT TO: *"entering 3 manually beats entering
// everyone."* The copy does not have to be right about all fourteen people — it has to be right
// about the eleven who did not change. So there is NO exception intelligence in here: no anomaly
// detection, no guessing who is back from leave, no cleverness that can be wrong in a way he cannot
// see. He copies, then flips the handful — *"as for if drivers have something off i can still
// manually flip those."*
import type { Shift } from '../types';

/** A shift to create — the narrow slice a copy is allowed to carry. */
export interface WeekCopyCreate {
  userId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  shiftType: Shift['shiftType'];
  isStat: boolean;
}

export interface WeekCopySkip {
  userId: string;
  date: string;
  /** Said out loud in the preview — a skip nobody can explain reads as a bug. */
  reason: string;
}

export interface WeekCopyPlan {
  creates: WeekCopyCreate[];
  skips: WeekCopySkip[];
}

/** Shift an ISO date by whole days, via UTC so a DST boundary cannot move the day. */
export function shiftISODate(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The source fields a copy carries. Everything absent from here is absent ON PURPOSE — see below. */
type SourceShift = Pick<Shift, 'userId' | 'date' | 'startTime' | 'endTime' | 'shiftType'>;

/**
 * What copying `source` onto the week `dayOffset` days later would do.
 *
 * ⚠️⚠️ FILL ONLY, NEVER OVERWRITE. A day that already carries a row is skipped, always. Without
 * this, the first person to book PTO in the target week has it silently replaced by a copy of the
 * shift they took off — a bulk write nobody is watching, over the one row somebody actually chose.
 * It also makes the whole thing idempotent: run it twice, nothing doubles, and every manual flip he
 * makes afterwards survives every later run.
 *
 * ⚠️ WHAT TRAVELS IS NARROWER THAN THE ROW. Times and type travel. `notes`, `actualStartTime`,
 * `actualEndTime`, `attendance` and `ptoApproved` do NOT: those describe the week that HAPPENED, and
 * copying `attendance` forward would invent an observation of a week that has not occurred yet.
 *
 * ⚠️⚠️ AND `isStat` IS RE-DERIVED FOR THE TARGET DATE, never carried across — the sharpest edge in
 * the whole feature. Copy the Aug 31 week onto Sep 7 and Labour Day would arrive flagged false,
 * because the source Monday was not a stat. FG's own `isStatDay` only knows MB *legislated* stats
 * (`reference_fg_stat_vs_hertz_holidays`), so it would not self-heal either. A week-copy that
 * quietly un-stats a stat is worse than no week-copy at all.
 *
 * `isStat` is INJECTED rather than imported, the same way `scheduleImportBuild` takes it: keeps this
 * pure and the holiday map swappable.
 */
export function planWeekCopy(
  source: readonly SourceShift[],
  /** Every shift already present in the TARGET week — the fill-only guard reads this. */
  existingTarget: readonly Pick<Shift, 'userId' | 'date'>[],
  dayOffset: number,
  isStat: (date: string) => boolean,
): WeekCopyPlan {
  const taken = new Set(existingTarget.map(s => `${s.userId}|${s.date}`));
  const creates: WeekCopyCreate[] = [];
  const skips: WeekCopySkip[] = [];

  for (const s of source) {
    const date = shiftISODate(s.date, dayOffset);
    if (taken.has(`${s.userId}|${date}`)) {
      skips.push({ userId: s.userId, date, reason: 'already scheduled' });
      continue;
    }
    // ⚠️ Guard against the same source row appearing twice (a duplicate upstream would otherwise
    // become two identical target rows, which is exactly the mess fill-only exists to avoid).
    taken.add(`${s.userId}|${date}`);
    creates.push({
      userId: s.userId,
      date,
      startTime: s.startTime,
      endTime: s.endTime,
      shiftType: s.shiftType,
      isStat: isStat(date),
    });
  }
  return { creates, skips };
}

/**
 * The preview line, and it earns its place.
 *
 * ⚠️ Once a copy has run, every day in the target week has a row — so a SECOND run skips everything.
 * That is correct behaviour and it looks exactly like a broken button, so the count has to be
 * readable BEFORE the tap rather than silence after it.
 */
export function describeWeekCopy(plan: WeekCopyPlan): string {
  const c = plan.creates.length, s = plan.skips.length;
  if (c === 0 && s === 0) return 'Nothing in the source week to copy.';
  if (c === 0) return `Nothing to add — all ${s} day${s === 1 ? '' : 's'} already scheduled.`;
  const head = `Will add ${c} shift${c === 1 ? '' : 's'}`;
  return s === 0 ? head + '.' : `${head} · skipping ${s} already scheduled.`;
}

/** Stat days the copy will stamp — surfaced in the preview because it is the non-obvious part. */
export function statDatesIn(plan: WeekCopyPlan): string[] {
  return [...new Set(plan.creates.filter(c => c.isStat).map(c => c.date))].sort();
}
