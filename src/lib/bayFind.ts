// Find a car in the bay log (2026-11-10, docs/ticket-bay-log-find-a-car.md). Aaron: *"Could we make vehicles searchable?
// An email came in looking for some vehicles and some I remember we clearly cleaned yesterday. MCN117 for instance"*.
// The pure half: the search key, the read-only window, and each appearance as a line he can read.
import { clockOf } from './lotBay';
import type { BayExit, BayLogRow } from './lotBayLog';
import { shiftDateStr } from './shiftDay';

/** Fewest characters a search runs on: fewer would flood the list with half the fleet. */
export const FIND_MIN = 3;
/** The read-only link's reach, his ruling: *"14 days on the read-only. Anything older I'll just screenshot"*. */
export const READ_ONLY_DAYS = 14;

/** What he typed as a plate key: letters and digits only, upper case. Null below FIND_MIN. ⚠️ Only [A-Z0-9] ever reaches
 *  the query, so nothing he types can change its shape (the key goes into a PostgREST `or` filter). */
export function findKey(typed: string): string | null {
  const key = typed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return key.length >= FIND_MIN ? key : null;
}

/** The first shift-day a window of `days` reaches, today included: 14 days back from Tue Nov 10 is Wed Oct 28. */
export function windowStart(days: number, now: Date = new Date()): string {
  return shiftDateStr(-(days - 1), now);
}

const noon = (day: string) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y!, m! - 1, d!, 12); };

/** Whole shift-days from `day` back to `today` (0 = today), for the ‹ › day record. */
export function daysBack(day: string, today: string): number {
  return Math.round((noon(today) - noon(day)) / 86_400_000);
}

const SAID: Record<BayExit, string> = { clean: 'Clean', erin: 'Erin', mhold: 'M hold', bhold: 'B hold', skip: 'Bumped' };
// The read-only link never says which hold (BayLogList's own read-only words).
const SAID_READ_ONLY: Record<BayExit, string> = { ...SAID, mhold: 'Held', bhold: 'Held' };

export interface BayAppearance {
  id: number; plate: string; car: string; day: string; back: number;
  /** "Mon, Nov 9", or "Today". */
  dayLabel: string;
  /** The exit time, or null while the car is still in the bay. */
  time: string | null;
  label: string; sentUp: boolean; note: string;
}

/** Each line, newest first, as it reads in a result. */
export function bayAppearances(rows: readonly BayLogRow[], today: string, { readOnly = false } = {}): BayAppearance[] {
  const said = readOnly ? SAID_READ_ONLY : SAID;
  return [...rows].sort((a, b) => b.started_at.localeCompare(a.started_at)).map(r => {
    const back = daysBack(r.shift_day, today);
    const [y, m, d] = r.shift_day.split('-').map(Number);
    const dayLabel = back === 0 ? 'Today' : back === 1 ? 'Yesterday'
      : new Date(y!, m! - 1, d!, 12).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
    return {
      id: r.id, plate: r.plate, car: r.car ?? '', day: r.shift_day, back, dayLabel,
      time: r.exit && r.exited_at ? clockOf(r.exited_at) : null,
      label: r.exit ? said[r.exit] : 'In the bay',
      sentUp: r.exit === 'clean' && r.sent_up === true,
      note: r.note ?? '',
    };
  });
}
