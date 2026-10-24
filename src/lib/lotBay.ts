// Lot Lookout, Erin St: the bay's count, pure. Cleans ready for the airport (tapped +1 / −1) and dirties waiting
// (typed now and then). (Ticket: docs/ticket-erin-st-cleans-ready-count.md; migration 153.)
//
// ⭐ WHY. Aaron, 2026-10-15: *"Something boss lady can see. Without the constant message. "What's the count?/How
// many clean and dirty?""*. The count answers the question so nobody has to text him mid-car.
//
// His rulings, same day:
//   • BOTH numbers are snapshots: *"The count would show that was the snapshot number was accurate at the
//     timestamp"*. So every count is shown with "as of HH:MM", never bare.
//   • Amber at 30 min, both counts: *"Especially with staggered drivers running. If nothing is being sent up for
//     over 30min. Either we have nothing or drivers are all stuck waiting at the airport"*. On cleans the amber is a
//     SIGNAL, not just an old number.
//   • −1 is USED, not "sent up": *"Erin St and the Regent location can poach cleans"*.
//   • The read-only view shows times, never initials: it is about the count, not about who is in the bay.
import { UNDO_MS } from './lotLookout';
import { businessDateOf } from './shiftDay';

export const BAY_STALE_MIN = 30;
/** Mirrors DIRTIES_MAX in api/_lib/lotRequest.ts (the server refuses past it; the page says so first). */
export const BAY_DIRTIES_MAX = 300;

export interface LotBay {
  cleans: number;
  cleansBy: string | null;
  cleansAt: string | null;
  /** null = never counted. */
  dirties: number | null;
  dirtiesBy: string | null;
  dirtiesAt: string | null;
  used: number;
  /** The shift-day `used` belongs to (YYYY-MM-DD). */
  usedOn: string | null;
}

// set / drain / fill / undo: the Erin pill's quick taps (migration 156).
export type BayTapKind = 'ready' | 'used' | 'fix' | 'dirties' | 'set' | 'drain' | 'fill' | 'undo';

export interface LotBayTap {
  id: number;
  kind: BayTapKind;
  value: number;
  prev: number | null;
  by: string | null;
  at: string;
}

export interface BayRow {
  cleans: number; cleans_by: string | null; cleans_at: string | null;
  dirties: number | null; dirties_by: string | null; dirties_at: string | null;
  used: number; used_on: string | null;
}

export function bayFromRow(r: BayRow): LotBay {
  return {
    cleans: r.cleans, cleansBy: r.cleans_by, cleansAt: r.cleans_at,
    dirties: r.dirties, dirtiesBy: r.dirties_by, dirtiesAt: r.dirties_at,
    used: r.used, usedOn: r.used_on,
  };
}

export function bayTapFromRow(r: { id: number; kind: string; value: number; prev: number | null; tapped_by: string | null; tapped_at: string }): LotBayTap {
  return { id: r.id, kind: r.kind as BayTapKind, value: r.value, prev: r.prev, by: r.tapped_by, at: r.tapped_at };
}

/** Cleans used this shift-day. Yesterday's `used` reads as 0, with no reset job. */
export function usedToday(bay: Pick<LotBay, 'used' | 'usedOn'>, nowMs: number): number {
  return bay.usedOn === businessDateOf(new Date(nowMs)) ? bay.used : 0;
}

/**
 * Erin's count from a closing inventory: Available are the cleans, Dirty the dirties. Body, Mechanical and Foreign
 * are in neither. Aaron, 2026-10-23, after the pill sat at 22/0 from a 20:48 tap while his inventory said 18 A / 6 D:
 * *"just A/D for clean/dirty"*.
 */
export function bayFromInventory(byStatus: { A: number; D: number }): { cleans: number; dirties: number } {
  return { cleans: byStatus.A, dirties: byStatus.D };
}

/** A count goes amber when it is over 30 min old, or was never set. */
export function isBayStale(at: string | null, nowMs: number): boolean {
  if (!at) return true;
  return nowMs - Date.parse(at) > BAY_STALE_MIN * 60_000;
}

const CLOCK = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Winnipeg', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "10:58", Winnipeg time, 24-hour: the "as of" on every count. */
export function clockOf(iso: string): string {
  return CLOCK.format(new Date(iso));
}

/** A −1 within 5 s of this phone's own +1 fixes a slip; it is not a car being used. */
export function isCleansFix(lastPlusAtMs: number | null, nowMs: number): boolean {
  return lastPlusAtMs != null && nowMs - lastPlusAtMs < UNDO_MS;
}

/** One line of the bay page's "Today" list. */
export function bayTapLine(t: Pick<LotBayTap, 'kind' | 'value'>): string {
  switch (t.kind) {
    case 'ready': return `+1 ready · ${t.value} now`;
    case 'used': return `−1 used · ${t.value} now`;
    case 'fix': return `−1 fixed a slip · ${t.value} now`;
    case 'dirties': return `Dirties set to ${t.value}`;
    case 'set': return `Cleans set to ${t.value}`;
    case 'drain': return `Drained with the drivers · ${t.value} now`;
    case 'fill': return `Filled from the drivers · ${t.value} dirties`;
    case 'undo': return `Undone · back to ${t.value}`;
  }
}
