// Lot Lookout's bay log (migration 161), server rules, pure: what a Start, an exit and an exit's Undo may do. api/lot.ts
// stays a thin writer and these are tested without a database. Ticket: docs/ticket-lot-lookout-bay-log.md.
//
// His rulings, 2026-10-29: one car at a time (*"i can't start a new one when i'm still working on the previous one"*),
// four exits, and a skipped car is a bump, not a verdict (*"skip to do later"*), so its restart points back at it.

import { shiftBusinessDate } from './shiftDay.js';
import { isEvModel } from './vehicleClassCodex.js';

// 'erin' (2026-11-04, migration 164): cleaned for Erin St's own row, so off the dirties and never onto the cleans.
export type BayExit = 'clean' | 'mhold' | 'bhold' | 'skip' | 'erin';
export const BAY_EXITS: readonly BayExit[] = ['clean', 'mhold', 'bhold', 'skip', 'erin'];

export type BayLogRequest =
  | { action: 'bayStart'; vehicleId: string; by: string }
  // `pull: false` = "Clean only, X waits": the exit lands and Next up's car stays loaded (2026-11-03, his run to the airport).
  // `sent: true` = ✈ Clean · sent up (migration 169): a Clean whose car went straight up, so a dirty off and no clean.
  | { action: 'bayExit'; id: number; exit: BayExit; by: string; odometer?: number; pull?: false; sent?: true }
  | { action: 'bayExitUndo'; id: number; by: string }
  | { action: 'bayStandbySet'; vehicleId: string; by: string }
  | { action: 'bayStandbyClear'; by: string }
  // "↩ Back to Next up": the car in the bay goes back in line, no exit logged. `replace`: he said yes to bumping the car
  // that was there. Ticket: docs/ticket-bay-clean-only-and-back-to-next-up.md.
  | { action: 'bayBumpToNextUp'; id: number; by: string; replace: boolean }
  // His note on a finished row (null clears it), and an M / B row linked to the hold already on the car (2026-11-04,
  // docs/ticket-bay-erin-exit-notes-existing-hold.md).
  | { action: 'bayNote'; id: number; note: string | null; by: string }
  | { action: 'bayLinkHold'; id: number; holdId: string; by: string }
  // A car cleaned while he was off the floor, added to the list as a Clean (migration 165,
  // docs/ticket-bay-add-a-car-cleaned.md), and its Undo.
  | { action: 'bayAdd'; vehicleId: string; by: string }
  | { action: 'bayAddUndo'; id: number; by: string }
  // His delete (2026-11-06, docs/ticket-bay-remove-a-row.md): *"We need a delete option for me"*.
  | { action: 'bayRemove'; id: number; by: string }
  // 2026-11-09 (migration 167, docs/ticket-bay-sent-up-and-change-exit.md): *"Editing a cleaned vehicle to M, B, or Erin
  // afterwards"*, and ✈ Sent up: *"something we cleaned was sent up right away and marking it as such"*.
  | { action: 'bayChangeExit'; id: number; exit: ChangeableExit; by: string }
  | { action: 'baySentUp'; id: number; sent: boolean; by: string }
  // A trip to the airport marks today's Clean for that plate ✈ (2026-11-09, docs/ticket-trip-marks-sent-up.md): *"if I
  // make a trip to the airport and it's a car that was cleaned today, it changes it to sent up"*.
  | { action: 'bayTripSentUp'; plate: string; by: string }
  // ✈ Send all up, and its Undo by the ids it marked (2026-11-10, docs/ticket-bay-total-and-send-all-up.md).
  | { action: 'baySendAllUp'; by: string }
  | { action: 'baySendAllUndo'; ids: number[]; by: string };

export const BAY_LOG_ACTIONS: readonly BayLogRequest['action'][] = ['bayStart', 'bayExit', 'bayExitUndo', 'bayStandbySet', 'bayStandbyClear', 'bayBumpToNextUp', 'bayNote', 'bayLinkHold', 'bayAdd', 'bayAddUndo', 'bayRemove', 'bayChangeExit', 'baySentUp', 'bayTripSentUp', 'baySendAllUp', 'baySendAllUndo'];

/** A trip's plate as the bay log writes it: trips hold "KUR 261", the log never has a space. Null when it is not one. */
export function tripPlate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const p = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return p.length >= 2 && p.length <= 10 ? p : null;
}

/** The exits a finished line may be changed between. Skip is part of a redo chain and never changes. */
export type ChangeableExit = Exclude<BayExit, 'skip'>;
export const CHANGEABLE_EXITS: readonly ChangeableExit[] = ['clean', 'erin', 'mhold', 'bhold'];

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
      if (b.sent !== undefined && typeof b.sent !== 'boolean') return { error: 'Sent up, or not?' };
      if (b.sent === true && b.exit !== 'clean') return { error: 'Only a Clean goes up as it leaves the bay.' };
      const sent = b.sent === true ? { sent: true as const } : {};
      // The reading he logged from the bay card as this car left (docs/ticket-bay-odo-in-card-and-next-up.md). Optional.
      if (b.odometer === undefined) return { action: 'bayExit', id, exit: b.exit as BayExit, by, ...pull, ...sent };
      if (typeof b.odometer !== 'number' || !Number.isInteger(b.odometer) || b.odometer <= 0 || b.odometer > 9_999_999) return { error: 'That odo is not a reading.' };
      return { action: 'bayExit', id, exit: b.exit as BayExit, by, odometer: b.odometer, ...pull, ...sent };
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
    case 'bayAdd':
      if (typeof b.vehicleId !== 'string' || !ID_TEXT.test(b.vehicleId)) return { error: 'Pick the car first.' };
      return { action: 'bayAdd', vehicleId: b.vehicleId, by };
    case 'bayAddUndo': {
      const id = rowId(b.id);
      if (id == null) return { error: 'Nothing to undo.' };
      return { action: 'bayAddUndo', id, by };
    }
    case 'bayRemove': {
      const id = rowId(b.id);
      if (id == null) return { error: 'Which car?' };
      return { action: 'bayRemove', id, by };
    }
    case 'bayChangeExit': {
      const id = rowId(b.id);
      if (id == null) return { error: 'Which car?' };
      if (!(CHANGEABLE_EXITS as readonly unknown[]).includes(b.exit)) return { error: 'Clean, Erin, M hold or B hold?' };
      return { action: 'bayChangeExit', id, exit: b.exit as ChangeableExit, by };
    }
    case 'baySentUp': {
      const id = rowId(b.id);
      if (id == null) return { error: 'Which car?' };
      if (typeof b.sent !== 'boolean') return { error: 'Sent up, or not?' };
      return { action: 'baySentUp', id, sent: b.sent, by };
    }
    case 'bayTripSentUp': {
      const plate = tripPlate(b.plate);
      if (!plate) return { error: 'Which plate?' };
      return { action: 'bayTripSentUp', plate, by };
    }
    case 'baySendAllUp':
      return { action: 'baySendAllUp', by };
    case 'baySendAllUndo': {
      // The ids Send all answered: a day's list, so a few dozen at most.
      if (!Array.isArray(b.ids) || b.ids.length === 0 || b.ids.length > 200) return { error: 'Nothing to undo.' };
      const ids = b.ids.map(rowId);
      if (ids.some(x => x == null)) return { error: 'Nothing to undo.' };
      return { action: 'baySendAllUndo', ids: ids as number[], by };
    }
    default:
      return { error: 'Unknown action.' };
  }
}

/**
 * What taking a finished row off today's list does to Erin St's count (Aaron, 2026-11-06: *"We need a delete option for
 * me"*; docs/ticket-bay-remove-a-row.md). The count goes back the way the exit moved it: a Clean's +1 comes off (a fix,
 * never "used"), and the dirty an exit took comes back. Skip moved nothing.
 *
 * ⭐ Unless he has SET that count by hand since the exit: then his count already covers the car, and moving it again would
 * throw it off. LUR367, the same day: Clean 16:40, his dirties recount 16:45, so its dirty stayed where he put it.
 */
export function removeCountPlan(row: { exit: BayExit; took_dirty: boolean; sent_at_exit?: boolean }, since: { cleansSet: boolean; dirtiesSet: boolean }): { cleans: 0 | -1; giveDirty: boolean } {
  if (row.exit === 'skip') return { cleans: 0, giveDirty: false };
  // ✈ Clean · sent up (migration 169) never added a clean, so there is none to take off: only its dirty comes back.
  const addedClean = row.exit === 'clean' && !row.sent_at_exit;
  return { cleans: addedClean && !since.cleansSet ? -1 : 0, giveDirty: row.took_dirty && !since.dirtiesSet };
}

/**
 * What changing a finished line's exit does to Erin St's cleans (2026-11-09, docs/ticket-bay-sent-up-and-change-exit.md).
 * Off a Clean: −1, a fix. Onto a Clean: +1, with NO dirty taken (the first exit already took it). Between Erin, M and B:
 * nothing, every one of them is the same dirty off and no clean. The dirties never move here.
 * ⭐ Unless he has SET the cleans by hand since the exit: his count already covers the car (removeCountPlan's rule).
 */
export function changeExitPlan(from: ChangeableExit, to: ChangeableExit, since: { cleansSet: boolean; sentAtExit?: boolean }): -1 | 0 | 1 {
  if (since.cleansSet || from === to) return 0;
  // ✈ Clean · sent up (migration 169) never added a clean: off it is the same dirty off and no clean, like Erin.
  if (from === 'clean') return since.sentAtExit ? 0 : -1;
  return to === 'clean' ? 1 : 0;
}

/** The line's first exit once changed, so it can read "was Clean"; null when the change lands back on the first. */
export function nextWasExit(was: BayExit | null, from: BayExit, to: BayExit): BayExit | null {
  const first = was ?? from;
  return first === to ? null : first;
}

/** The columns carLine reads, for every vehicles select that feeds it. */
export const CAR_LINE_COLS = 'year, make, model, color, is_hybrid, is_tesla, winter_tires';

/** "2026 Toyota RAV4 🔋 · Gray · Winter tires": the car as it was at Start, kept on the row so the list never re-reads it.
 *  ⭐ 2026-11-11, Aaron: *"will the read-only link show if a vehicle is hybrid and if it has winter tires?"* It didn't.
 *  The mark is FG's one rule (src/lib/vehicleName.ts powertrainBadge: ⚡ Tesla or a codex EV, 🔋 hybrid), applied here
 *  because api/ can't import src/. Winter tires print only when FG has them as fitted: false and unknown both stay
 *  quiet, since a blank can't tell all-seasons from nobody-checked. `car` is display only (nothing matches on it). */
export function carLine(v: {
  year?: number | null; make?: string | null; model?: string | null; color?: string | null;
  is_hybrid?: boolean | null; is_tesla?: boolean | null; winter_tires?: boolean | null;
}): string {
  const name = [v.year, v.make, v.model].filter(x => x != null && String(x).trim() !== '').join(' ');
  const badge = v.is_tesla || isEvModel(v.model) ? '⚡' : v.is_hybrid ? '🔋' : '';
  const color = (v.color ?? '').trim();
  return [[name, badge].filter(Boolean).join(' '), color, v.winter_tires === true ? 'Winter tires' : ''].filter(Boolean).join(' · ');
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
