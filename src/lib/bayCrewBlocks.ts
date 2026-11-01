// Lot Lookout's bay log, Phase 2 (docs/ticket-lot-lookout-bay-log.md): the day record's crew, pure.
//
// His rulings (2026-10-29), verbatim where quoted:
//   • The record is HIS shift's: *"the data really revolves around my shift and when i work"*. A day he isn't working
//     has no record.
//   • VSA count by time block within his shift. The SCHEDULE decides WHEN, attendance decides WHETHER: absent drops
//     someone, unmarked still counts. *"don't need arrival times. since i can't keep track of anything after i leave"*.
//   • Numbers only, never names.
// The windows follow the crew line's own rules (api/_lib/lotCrew.ts): logged hours win where logged, a [+] block is a
// window too (migration 160), sick and absent are out, day-off and PTO aren't working.
import type { Shift, UserRole } from '../types';

const WORKING = new Set(['opening', 'mid', 'closing']);
const VSA_ROLES = new Set<UserRole>(['VSA', 'Lead VSA']);
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

export interface CrewBlock { start: string; end: string; vsas: number }
export interface BayDayCrew {
  /** He has a working shift that day (not off, PTO, sick or a no-show). False = not a logging day. */
  working: boolean;
  /** His window, first start to last end ("06:45"–"15:15"); null when his shift has no times. */
  window: { start: string; end: string } | null;
  /** The VSAs on, block by block across his window(s). A block starts wherever the count changes. */
  blocks: CrewBlock[];
}

/** `role` resolves a user id to their role, or null when unknown (an unknown person is never counted as a VSA). */
export function bayDayCrew(
  shifts: readonly Shift[], me: string, role: (userId: string) => UserRole | null,
): BayDayCrew {
  const mine = shifts.find(s => s.userId === me && isOn(s));
  if (!mine) return { working: false, window: null, blocks: [] };
  const myWins = windowsOf(mine);
  if (!myWins.length) return { working: true, window: null, blocks: [] };
  const vsaWins = shifts.filter(s => isOn(s) && (s.userId === me || VSA_ROLES.has(role(s.userId) as UserRole))).map(windowsOf);
  const raw: { s: number; e: number; vsas: number }[] = [];
  for (const [a, b] of myWins) {
    const cuts = new Set([a, b]);
    for (const ws of vsaWins) for (const [s, e] of ws) { if (s > a && s < b) cuts.add(s); if (e > a && e < b) cuts.add(e); }
    const pts = [...cuts].sort((x, y) => x - y);
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i]!, e = pts[i + 1]!;
      const vsas = vsaWins.filter(ws => ws.some(([x, y]) => x <= s && y >= e)).length;
      const last = raw[raw.length - 1];
      if (last && last.vsas === vsas && last.e === s) last.e = e;   // same count across a cut someone else made
      else raw.push({ s, e, vsas });
    }
  }
  return {
    working: true,
    window: { start: clock(myWins[0]![0]), end: clock(Math.max(...myWins.map(w => w[1]))) },
    blocks: raw.map(r => ({ start: clock(r.s), end: clock(r.e), vsas: r.vsas })),
  };
}

/** What the day says about itself, or null when there's nothing to add. `now` is the wall clock, "HH:MM". A day he
 *  wasn't on has no record; today, once his window has closed, the log says when it ended. */
export function dayStatus(crew: BayDayCrew | null, isToday: boolean, now: string): string | null {
  if (!crew) return null;
  if (!crew.working) return isToday ? "You're not on today: no bay log." : 'Not a logging day: you were off.';
  if (isToday && crew.window && dayMinute(now) >= dayMinute(crew.window.end)) return `Bay log ended ${crew.window.end}`;
  return null;
}
