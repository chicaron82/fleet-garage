// A finished line on the bay list, changed after the fact (migration 167, docs/ticket-bay-sent-up-and-change-exit.md).
// Aaron, 2026-11-09: *"Editing a cleaned vehicle to M, B, or Erin afterwards"*, and of a clean that went straight back
// up: *"FG doesn't need to know about an ASAP vehicle. Just that something we cleaned was sent up right away and marking
// it as such"*. Its own file because lotBayLogDb.ts is at its line cap; the rules are pure in lotBayLog.ts / lotBay.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import { changedExitCount } from './lotBay.js';
import { moveCountSafely } from './lotCount.js';
import { changeExitPlan, nextWasExit, type BayExit, type ChangeableExit } from './lotBayLog.js';
import { BAY_LOG_COLS, BayLogRefusal } from './lotBayLogDb.js';

const SAID: Record<BayExit, string> = { clean: 'a Clean', erin: 'an Erin car', mhold: 'on M hold', bhold: 'on B hold', skip: 'bumped' };

/**
 * Today's finished line gets another exit. The row first, guarded on the exit it was read with, then the cleans by
 * changeExitPlan. It keeps its exit time; `was_exit` remembers the first exit so the list says "was Clean". A hold link
 * goes (it fitted the old exit), and so does ✈ sent up once it is no longer a Clean.
 */
export async function changeExit(db: SupabaseClient, id: number, to: ChangeableExit, by: string, nowIso: string, today: string) {
  const { data: was, error: readErr } = await db.from('lot_bay_log').select('plate, exit, exited_at, shift_day, was_exit, sent_at_exit').eq('id', id).maybeSingle();
  if (readErr) throw readErr;
  if (!was) throw new BayLogRefusal('That car is off the list now.');
  if (!was.exit || !was.exited_at) throw new BayLogRefusal(`${was.plate} is still in the bay. Give it an exit first.`);
  if (was.exit === 'skip') throw new BayLogRefusal('A bumped car keeps its line. Its redo gets the exit.');
  if (was.shift_day !== today) throw new BayLogRefusal('Only today\'s list can change a car.');
  if (was.exit === to) throw new BayLogRefusal(`${was.plate} is already ${SAID[to]}.`);
  // His hand count since the exit: a typed cleans SET already covers this car.
  const { data: taps, error: tapErr } = await db.from('lot_bay_taps').select('kind').gt('tapped_at', was.exited_at).in('kind', ['set']);
  if (tapErr) throw tapErr;
  const delta = changeExitPlan(was.exit as ChangeableExit, to, { cleansSet: (taps ?? []).length > 0, sentAtExit: was.sent_at_exit === true });
  // Off a ✈ Clean · sent up it is no longer one (migration 169); onto a Clean from M/B/Erin it is a plain Clean, +1.
  const { data: row, error } = await db.from('lot_bay_log')
    .update({ exit: to, was_exit: nextWasExit(was.was_exit as BayExit | null, was.exit as BayExit, to), hold_id: null, sent_at_exit: false, ...(to === 'clean' ? {} : { sent_up: false }) })
    .eq('id', id).eq('exit', was.exit).eq('exited_at', was.exited_at)
    .select(BAY_LOG_COLS).maybeSingle();
  if (error) throw error;
  if (!row) throw new BayLogRefusal('That car already changed.');
  let bay: unknown = null;
  if (delta !== 0) {
    const moved = await moveCountSafely(db, r => changedExitCount(r, delta, by, nowIso));
    // A busy count says so; the line already changed, so the words say where things stand.
    if (moved.kind === 'refused') throw new BayLogRefusal(`${was.plate} changed, but the cleans count did not move. Check it.`);
    if (moved.kind === 'saved') bay = moved.saved;
  }
  return { row, bay };
}

/** ✈ Sent up, or taken back. A Clean only; no time of its own, and no count moves. Any day's list, as a note is.
 *  ⚠️ A Clean that LEFT as ✈ Clean · sent up (migration 169) keeps its mark: un-marking it would leave a car on the
 *  clean board with no clean ever counted. Its fixes are the Undo, Remove or Change. */
export async function setSentUp(db: SupabaseClient, id: number, sent: boolean) {
  const { data: row, error } = await db.from('lot_bay_log').update({ sent_up: sent }).eq('id', id).eq('exit', 'clean')
    .eq('sent_at_exit', false).select(BAY_LOG_COLS).maybeSingle();
  if (error) throw error;
  if (!row) throw new BayLogRefusal('Only a Clean goes up from the list, and one sent up as it left the bay stays sent up.');
  return { row };
}

/**
 * A trip to the airport marks the car's Clean on today's list ✈ (2026-11-09, docs/ticket-trip-marks-sent-up.md): *"if I
 * make a trip to the airport and it's a car that was cleaned today, it changes it to sent up"*. The plate's NEWEST line
 * today, only when it is a Clean not yet marked. Anything else is quiet (`row: null`, never a refusal): most trips are
 * cars not on today's list, and a hand ✈ is his. Moves no count; the trip's −1 is its own call. The phone keeps the row
 * id so the trip's Reset can take back only what it marked.
 */
export async function sentUpByTrip(db: SupabaseClient, plate: string, today: string) {
  const { data: lines, error: readErr } = await db.from('lot_bay_log').select('id, exit, sent_up, exited_at')
    .eq('plate', plate).eq('shift_day', today).not('exited_at', 'is', null).order('exited_at', { ascending: false });
  if (readErr) throw readErr;
  const newest = (lines ?? [])[0] as { id: number; exit: string | null; sent_up: boolean | null } | undefined;
  if (!newest || newest.exit !== 'clean' || newest.sent_up) return { row: null };
  const { data: row, error } = await db.from('lot_bay_log').update({ sent_up: true })
    .eq('id', newest.id).eq('exit', 'clean').eq('sent_up', false).select(BAY_LOG_COLS).maybeSingle();
  if (error) throw error;
  return { row: row ?? null };
}
