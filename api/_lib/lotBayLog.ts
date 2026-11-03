// Lot Lookout's bay log (migration 161), server rules, pure: what a Start, an exit and an exit's Undo may do. api/lot.ts
// stays a thin writer and these are tested without a database. Ticket: docs/ticket-lot-lookout-bay-log.md.
//
// His rulings, 2026-10-29: one car at a time (*"i can't start a new one when i'm still working on the previous one"*),
// four exits, and a skipped car is a bump, not a verdict (*"skip to do later"*), so its restart points back at it.

import { shiftBusinessDate } from './shiftDay.js';

export type BayExit = 'clean' | 'mhold' | 'bhold' | 'skip';
export const BAY_EXITS: readonly BayExit[] = ['clean', 'mhold', 'bhold', 'skip'];

export type BayLogRequest =
  | { action: 'bayStart'; vehicleId: string; by: string }
  | { action: 'bayExit'; id: number; exit: BayExit; by: string; odometer?: number }
  | { action: 'bayExitUndo'; id: number; by: string };

export const BAY_LOG_ACTIONS: readonly BayLogRequest['action'][] = ['bayStart', 'bayExit', 'bayExitUndo'];

/** The phone offers Undo for 5 s; the server allows a little more, so a slow signal never turns a real Undo away. */
export const EXIT_UNDO_MS = 20_000;

const ID_TEXT = /^[A-Za-z0-9_-]{1,64}$/;

function rowId(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null;
}

export function parseBayLog(b: Record<string, unknown>, by: string): BayLogRequest | { error: string } {
  switch (b.action) {
    case 'bayStart':
      if (typeof b.vehicleId !== 'string' || !ID_TEXT.test(b.vehicleId)) return { error: 'Pick the car first.' };
      return { action: 'bayStart', vehicleId: b.vehicleId, by };
    case 'bayExit': {
      const id = rowId(b.id);
      if (id == null) return { error: 'Which car?' };
      if (!(BAY_EXITS as readonly unknown[]).includes(b.exit)) return { error: 'Clean, M hold, B hold or Skip?' };
      // The reading he logged from the bay card as this car left (docs/ticket-bay-odo-in-card-and-next-up.md). Optional.
      if (b.odometer === undefined) return { action: 'bayExit', id, exit: b.exit as BayExit, by };
      if (typeof b.odometer !== 'number' || !Number.isInteger(b.odometer) || b.odometer <= 0 || b.odometer > 9_999_999) return { error: 'That odo is not a reading.' };
      return { action: 'bayExit', id, exit: b.exit as BayExit, by, odometer: b.odometer };
    }
    case 'bayExitUndo': {
      const id = rowId(b.id);
      if (id == null) return { error: 'Nothing to undo.' };
      return { action: 'bayExitUndo', id, by };
    }
    default:
      return { error: 'Unknown action.' };
  }
}

/** "2026 Toyota Corolla Cross · Gray": the car as it was at Start, kept on the row so the list never re-reads it. */
export function carLine(v: { year?: number | null; make?: string | null; model?: string | null; color?: string | null }): string {
  const name = [v.year, v.make, v.model].filter(x => x != null && String(x).trim() !== '').join(' ');
  const color = (v.color ?? '').trim();
  return [name, color].filter(Boolean).join(' · ');
}

/** The odo a Start writes on the bay row: the car's reading only when it was taken on this shift-day, else null.
 *  Since 2026-10-31 Start no longer waits on today's odo (docs/ticket-bay-log-first-shift-friction.md): Aaron, on a
 *  passenger-side day, *"I don't see the odo until I take it out to park"*. So the record's reading may be yesterday's,
 *  and the In the bay card would print it as if read today. A row says "odo" only for a reading from today. */
export function startOdometer(v: { odometer?: number | null; odometer_at?: string | null }, today: string): number | null {
  if (v.odometer == null || !v.odometer_at) return null;
  const t = new Date(v.odometer_at);
  if (Number.isNaN(t.getTime())) return null;
  return shiftBusinessDate(t) === today ? v.odometer : null;
}

/** May this exit still be taken back? Only within the window, and only an exit that happened. */
export function undoAllowed(exitedAt: string | null, nowMs: number): boolean {
  if (!exitedAt) return false;
  const t = Date.parse(exitedAt);
  return !Number.isNaN(t) && nowMs - t <= EXIT_UNDO_MS;
}

export interface DayRow { id: number; vehicle_id: string; exit: BayExit | null; redo_of: number | null; started_at: string }

/** The skipped row a restart of this car redoes: its latest skip today that no later row has redone yet. */
export function redoOf(today: readonly DayRow[], vehicleId: string): number | null {
  const redone = new Set(today.map(r => r.redo_of).filter((x): x is number => x != null));
  const skips = today
    .filter(r => r.vehicle_id === vehicleId && r.exit === 'skip' && !redone.has(r.id))
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
  return skips[0]?.id ?? null;
}
