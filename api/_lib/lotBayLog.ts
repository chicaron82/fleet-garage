// Lot Lookout's bay log (migration 161), server rules, pure: what a Start, an exit and an exit's Undo may do. api/lot.ts
// stays a thin writer and these are tested without a database. Ticket: docs/ticket-lot-lookout-bay-log.md.
//
// His rulings, 2026-10-29: one car at a time (*"i can't start a new one when i'm still working on the previous one"*),
// four exits, and a skipped car is a bump, not a verdict (*"skip to do later"*), so its restart points back at it.

import { shiftBusinessDate } from './shiftDay.js';

// 'erin' (2026-11-04, migration 164): cleaned for Erin St's own row, so off the dirties and never onto the cleans.
export type BayExit = 'clean' | 'mhold' | 'bhold' | 'skip' | 'erin';
export const BAY_EXITS: readonly BayExit[] = ['clean', 'mhold', 'bhold', 'skip', 'erin'];

export type BayLogRequest =
  | { action: 'bayStart'; vehicleId: string; by: string }
  // `pull: false` = "Clean only, X waits": the exit lands and Next up's car stays loaded (2026-11-03, his run to the airport).
  | { action: 'bayExit'; id: number; exit: BayExit; by: string; odometer?: number; pull?: false }
  | { action: 'bayExitUndo'; id: number; by: string }
  | { action: 'bayStandbySet'; vehicleId: string; by: string }
  | { action: 'bayStandbyClear'; by: string }
  // "↩ Back to Next up": the car in the bay goes back in line, no exit logged. `replace`: he said yes to bumping the car
  // that was there. Ticket: docs/ticket-bay-clean-only-and-back-to-next-up.md.
  | { action: 'bayBumpToNextUp'; id: number; by: string; replace: boolean }
  // His note on a finished row (null clears it), and an M / B row linked to the hold already on the car (2026-11-04,
  // docs/ticket-bay-erin-exit-notes-existing-hold.md).
  | { action: 'bayNote'; id: number; note: string | null; by: string }
  | { action: 'bayLinkHold'; id: number; holdId: string; by: string };

export const BAY_LOG_ACTIONS: readonly BayLogRequest['action'][] = ['bayStart', 'bayExit', 'bayExitUndo', 'bayStandbySet', 'bayStandbyClear', 'bayBumpToNextUp', 'bayNote', 'bayLinkHold'];

/** A note's cap, the same as migration 164's check. */
export const NOTE_MAX = 140;

/** What he typed, as the row keeps it: one line, trimmed. Blank = no note (null). Too long = refused, never cut. */
export function cleanNote(v: unknown): string | null | { error: string } {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return { error: 'That note is not text.' };
  const s = v.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (s.length > NOTE_MAX) return { error: `Keep the note to ${NOTE_MAX} characters.` };
  return s;
}

/** Which holds an M / B row may be linked to: M is mechanical; B is damage, and hail is damage too. */
export function holdFitsExit(exit: BayExit | null, holdTypes: readonly string[]): boolean {
  if (exit === 'mhold') return holdTypes.includes('mechanical');
  if (exit === 'bhold') return holdTypes.includes('damage') || holdTypes.includes('hail');
  return false;
}

/** Why a row may NOT be linked to this hold, or null when it may. The phone only offers fitting holds; this is the
 *  server's own word, so a stale screen can never tie a row to another car's hold, a closed one, or the wrong kind. */
export function linkRefusal(
  row: { vehicle_id: string; exit: BayExit | null } | null,
  hold: { vehicle_id: string; status: string; hold_types: readonly string[] | null } | null,
): string | null {
  if (!row) return 'That row is gone.';
  if (row.exit !== 'mhold' && row.exit !== 'bhold') return 'Only an M hold or B hold row takes a hold.';
  if (!hold || hold.vehicle_id !== row.vehicle_id) return 'That hold is not on this car.';
  if (hold.status !== 'ACTIVE') return 'That hold is closed now. Flag a new one.';
  if (!holdFitsExit(row.exit, hold.hold_types ?? [])) return row.exit === 'mhold' ? 'That hold is not mechanical.' : 'That hold is not damage.';
  return null;
}

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
      if (!(BAY_EXITS as readonly unknown[]).includes(b.exit)) return { error: 'Clean, M hold, B hold, Erin or Skip?' };
      if (b.pull !== undefined && typeof b.pull !== 'boolean') return { error: 'Bring the next car in, or not?' };
      const pull = b.pull === false ? { pull: false as const } : {};
      // The reading he logged from the bay card as this car left (docs/ticket-bay-odo-in-card-and-next-up.md). Optional.
      if (b.odometer === undefined) return { action: 'bayExit', id, exit: b.exit as BayExit, by, ...pull };
      if (typeof b.odometer !== 'number' || !Number.isInteger(b.odometer) || b.odometer <= 0 || b.odometer > 9_999_999) return { error: 'That odo is not a reading.' };
      return { action: 'bayExit', id, exit: b.exit as BayExit, by, odometer: b.odometer, ...pull };
    }
    case 'bayExitUndo': {
      const id = rowId(b.id);
      if (id == null) return { error: 'Nothing to undo.' };
      return { action: 'bayExitUndo', id, by };
    }
    case 'bayStandbySet':
      if (typeof b.vehicleId !== 'string' || !ID_TEXT.test(b.vehicleId)) return { error: 'Pick the car first.' };
      return { action: 'bayStandbySet', vehicleId: b.vehicleId, by };
    case 'bayStandbyClear':
      return { action: 'bayStandbyClear', by };
    case 'bayBumpToNextUp': {
      const id = rowId(b.id);
      if (id == null) return { error: 'Which car?' };
      return { action: 'bayBumpToNextUp', id, by, replace: b.replace === true };
    }
    case 'bayNote': {
      const id = rowId(b.id);
      if (id == null) return { error: 'Which car?' };
      const note = cleanNote(b.note);
      if (note && typeof note === 'object') return note;
      return { action: 'bayNote', id, note, by };
    }
    case 'bayLinkHold': {
      const id = rowId(b.id);
      if (id == null) return { error: 'Which car?' };
      if (typeof b.holdId !== 'string' || !ID_TEXT.test(b.holdId)) return { error: 'Which hold?' };
      return { action: 'bayLinkHold', id, holdId: b.holdId, by };
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
