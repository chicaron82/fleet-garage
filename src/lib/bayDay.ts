// Lot Lookout's bay log, Phase 2 (docs/ticket-lot-lookout-bay-log.md): is the day he's looking at one of HIS logging
// days, and when did his shift run? Pure.
//
// His rulings (2026-10-29), verbatim where quoted:
//   • The record is HIS shift's: *"the data really revolves around my shift and when i work"*. A day he isn't working
//     has no record.
// The windows follow the crew line's own rules (api/_lib/lotCrew.ts): logged hours win where logged, a [+] block is a
// window too (migration 160), sick and absent are out, day-off and PTO aren't working.
//
// ⚰️ The VSA-count blocks under the day header (2026-10-29) were removed 2026-11-05 on his ask, everywhere: *"crew
// schedule is posted at the top of lot lookout and at the bottom. may i suggest we remove the top one?"*. The bottom's
// "Crew now" + named list says more. This file was bayCrewBlocks.ts until then.
import type { Shift } from '../types';

const WORKING = new Set(['opening', 'mid', 'closing']);
const CUTOVER = 4 * 60;   // the business day runs 04:00 → 04:00 (shiftDay.ts)

/** Minutes after the 04:00 cutover: '06:45' → 165, '01:00' (after midnight) → 1260. */
export function dayMinute(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h! * 60 + m!) - CUTOVER + 1440) % 1440;
}

function clock(min: number): string {
  const t = (min + CUTOVER) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

type Span = [number, number];

/** A shift's windows on its business day: logged hours win where logged, and each [+] block is its own window. */
export function windowsOf(s: Pick<Shift, 'startTime' | 'endTime' | 'actualStartTime' | 'actualEndTime' | 'extraBlocks'>): Span[] {
  const out: Span[] = [];
  const add = (start?: string, end?: string) => {
    if (!start || !end) return;
    const a = dayMinute(start);
    let b = dayMinute(end);
    if (b <= a) b += 1440;
    out.push([a, b]);
  };
  add(s.actualStartTime || s.startTime, s.actualEndTime || s.endTime);
  for (const x of s.extraBlocks ?? []) add(x.start, x.end);
  return out.sort((x, y) => x[0] - y[0]);
}

const isOn = (s: Pick<Shift, 'shiftType' | 'attendance'>) => WORKING.has(s.shiftType) && s.attendance !== 'absent';

export interface MyBayDay {
  /** He has a working shift that day (not off, PTO, sick or a no-show). False = not a logging day. */
  working: boolean;
  /** His window, first start to last end ("06:45"–"15:15"); null when his shift has no times. */
  window: { start: string; end: string } | null;
}

export function myBayDay(shifts: readonly Shift[], me: string): MyBayDay {
  const mine = shifts.find(s => s.userId === me && isOn(s));
  if (!mine) return { working: false, window: null };
  const wins = windowsOf(mine);
  if (!wins.length) return { working: true, window: null };
  return { working: true, window: { start: clock(wins[0]![0]), end: clock(Math.max(...wins.map(w => w[1]))) } };
}

/** What the day says about itself, or null when there's nothing to add. `now` is the wall clock, "HH:MM". A day he
 *  wasn't on has no record; today, once his window has closed, the log says when it ended. */
export function dayStatus(day: MyBayDay | null, isToday: boolean, now: string): string | null {
  if (!day) return null;
  if (!day.working) return isToday ? "You're not on today: no bay log." : 'Not a logging day: you were off.';
  if (isToday && day.window && dayMinute(now) >= dayMinute(day.window.end)) return `Bay log ended ${day.window.end}`;
  return null;
}
