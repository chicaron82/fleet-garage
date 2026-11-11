// Lot Lookout's bay log (migration 161), the database side for api/lot.ts: Start a car, give it an exit, take an exit
// back. The rules are pure in lotBayLog.ts; Erin St's count moves through lotBay.ts's own rule, so a Clean exit is the
// same +1 (and takes the same dirty) as a tap on the count. Ticket: docs/ticket-lot-lookout-bay-log.md.
// M hold and B hold take one off the dirties (heldExitChange; docs/ticket-bay-hold-exit-takes-a-dirty.md). Skip moves
// nothing. `took_dirty` records either kind of take, so an Undo or a lost race gives back only what was taken.
// Erin (2026-11-04, migration 164) takes a dirty the same way, under its own tap kind, and never adds a clean. Notes and
// the link to a hold already on the car: setNote, linkHold (docs/ticket-bay-erin-exit-notes-existing-hold.md).
import type { SupabaseClient } from '@supabase/supabase-js';
import { bayChange, heldExitChange, type BayChange, type BayRequest, type BayRow } from './lotBay.js';
import { moveCountSafely } from './lotCount.js';
import { CAR_LINE_COLS, carLine, linkRefusal, redoOf, removeCountPlan, startOdometer, undoAllowed, type BayExit, type DayRow } from './lotBayLog.js';

export const BAY_LOG_COLS = 'id, vehicle_id, plate, unit_number, car, odometer, started_at, exit, exited_at, took_dirty, redo_of, shift_day, note, hold_id, added, sent_up, was_exit, sent_at_exit';

/** A refusal the phone shows as it is (409), as opposed to a thrown error (500). */
export class BayLogRefusal extends Error {}

const STANDBY_COLS = 'vehicle_id, plate, unit_number, car, shift_day';

const isHold = (exit: BayExit | null) => exit === 'mhold' || exit === 'bhold';
/** The exits that take a dirty and add no clean, and the tap each one logs. */
const dirtyOnly = (exit: BayExit | null): 'held' | 'erin' | null => (isHold(exit) ? 'held' : exit === 'erin' ? 'erin' : null);

/** Erin St's count, moved by the count's own rule: a tap's request, or a hold exit's change (null = nothing to move). */
// Through moveCountSafely, like a tap on the count: an exit and a tap landing together used to save one of them.
async function moveCount(db: SupabaseClient, req: BayRequest | ((row: BayRow) => BayChange | null), nowIso: string, today: string) {
  const moved = await moveCountSafely(db, row => (typeof req === 'function' ? req(row) : bayChange(row, req, nowIso, today)));
  if (moved.kind === 'refused') throw new BayLogRefusal(moved.error);
  if (moved.kind === 'none') return { saved: null, tookDirty: false };
  const saved = moved.saved as { dirties?: number | null };
  return { saved, tookDirty: (saved.dirties ?? 0) < (moved.row.dirties ?? 0) };
}

/** `pulledBy`: the exit that pulled this car in off Next up, so its Undo can rewind both (migration 163). */
export async function startCar(db: SupabaseClient, vehicleId: string, by: string, nowIso: string, today: string, pulledBy?: number) {
  const { data: open, error: openErr } = await db.from('lot_bay_log').select('plate').is('exit', null).maybeSingle();
  if (openErr) throw openErr;
  if (open) throw new BayLogRefusal(`${open.plate} is still in the bay. Give it an exit first.`);
  const { data: v, error: vErr } = await db.from('vehicles')
    .select(`id, license_plate, unit_number, ${CAR_LINE_COLS}, odometer, odometer_at`).eq('id', vehicleId).maybeSingle();
  if (vErr) throw vErr;
  if (!v) throw new BayLogRefusal('That car is not in FG.');
  const { data: day, error: dayErr } = await db.from('lot_bay_log')
    .select('id, vehicle_id, exit, redo_of, started_at').eq('shift_day', today);
  if (dayErr) throw dayErr;
  const { data: row, error } = await db.from('lot_bay_log').insert({
    vehicle_id: v.id, plate: v.license_plate, unit_number: v.unit_number, car: carLine(v), odometer: startOdometer(v, today),
    started_at: nowIso, started_by: by, shift_day: today, redo_of: redoOf((day ?? []) as DayRow[], v.id),
    ...(pulledBy ? { pulled_by: pulledBy } : {}),
  }).select(BAY_LOG_COLS).single();
  // 23505: the one-car index. Another phone started a car between the check above and this insert.
  if (error?.code === '23505') throw new BayLogRefusal('Another car went into the bay just now.');
  if (error) throw error;
  // Started by any door, it is no longer next. Best-effort: the car IS in, and a leftover slot says so plainly.
  await db.from('lot_bay_standby').delete().eq('vehicle_id', v.id);
  return { row, bay: null };
}

/** After an exit, the car lined up comes in. The exit already landed, so nothing here may undo it or fail it: a pull that
 *  cannot happen leaves the car on Next up and says so (`nextError`), and the empty bay offers its Start. */
async function pullNext(db: SupabaseClient, exitedId: number, by: string, nowIso: string, today: string): Promise<{ next?: unknown; nextError?: string }> {
  let plate = 'The next car';
  try {
    const { data: sb, error } = await db.from('lot_bay_standby').select('vehicle_id, plate, shift_day').eq('id', 1).maybeSingle();
    if (error) throw error;
    if (!sb) return {};
    plate = sb.plate;
    // Loaded before the 04:00 cutover: yesterday's plan, never today's car.
    if (sb.shift_day !== today) {
      await db.from('lot_bay_standby').delete().eq('id', 1);
      return {};
    }
    const { row } = await startCar(db, sb.vehicle_id, by, nowIso, today, exitedId);
    return { next: row };
  } catch (e) {
    return { nextError: e instanceof BayLogRefusal ? `${plate} did not come in: ${e.message}` : `${plate} did not come in. It is still on deck.` };
  }
}

/** Line a car up. One slot, so this replaces whatever was there. */
export async function setStandby(db: SupabaseClient, vehicleId: string, by: string, nowIso: string, today: string) {
  const { data: open, error: openErr } = await db.from('lot_bay_log').select('vehicle_id').is('exit', null).maybeSingle();
  if (openErr) throw openErr;
  // An EMPTY bay may hold a car on deck (2026-11-03): *"[Start Clean][On Deck] ... On deck loads it as the next vehicle"*.
  // This used to refuse ("The bay's empty. Start this car instead."), which was the airport-run morning exactly: the next
  // car's key in hand, nobody free to clean it. The empty bay card offers its Start.
  if (open?.vehicle_id === vehicleId) throw new BayLogRefusal('That car is in the bay now.');
  const { data: v, error: vErr } = await db.from('vehicles')
    .select(`id, license_plate, unit_number, ${CAR_LINE_COLS}`).eq('id', vehicleId).maybeSingle();
  if (vErr) throw vErr;
  if (!v) throw new BayLogRefusal('That car is not in FG.');
  const { data: standby, error } = await db.from('lot_bay_standby').upsert({
    id: 1, vehicle_id: v.id, plate: v.license_plate, unit_number: v.unit_number, car: carLine(v), loaded_at: nowIso, loaded_by: by, shift_day: today,
  }).select(STANDBY_COLS).single();
  if (error) throw error;
  return { standby };
}

export async function clearStandby(db: SupabaseClient) {
  const { error } = await db.from('lot_bay_standby').delete().eq('id', 1);
  if (error) throw error;
  return { standby: null };
}

/** The Undo's other half: take the car this exit pulled in back out and line it up again, so the first can go back in
 *  (the one-car index). A row from a 5-second mis-tap is not part of the record, so it goes rather than stays. A pulled
 *  car that already has an exit of its own stays on the list. */
async function unpull(db: SupabaseClient, exitedId: number, by: string, nowIso: string, today: string) {
  const { data: pulled, error } = await db.from('lot_bay_log').select('id, vehicle_id, plate, unit_number, car')
    .eq('pulled_by', exitedId).is('exit', null).maybeSingle();
  if (error) throw error;
  if (!pulled) return { removedId: undefined, standby: undefined };
  const { error: delErr } = await db.from('lot_bay_log').delete().eq('id', pulled.id);
  if (delErr) throw delErr;
  const { data: standby, error: upErr } = await db.from('lot_bay_standby').upsert({
    id: 1, vehicle_id: pulled.vehicle_id, plate: pulled.plate, unit_number: pulled.unit_number, car: pulled.car, loaded_at: nowIso, loaded_by: by, shift_day: today,
  }).select(STANDBY_COLS).single();
  if (upErr) throw upErr;
  return { removedId: pulled.id as number, standby };
}

/** `pull`: false for "Clean only, X waits" — the exit lands and Next up's car stays loaded for later.
 *  `sent`: ✈ Clean · sent up (migration 169, docs/ticket-bay-clean-sent-up-at-exit.md): the car went straight up, so a
 *  dirty off and NO clean (*"Removes a dirty and doesn't +1 the clean so I don't have to -1 when they take it"*). */
export async function exitCar(db: SupabaseClient, id: number, exit: BayExit, by: string, nowIso: string, today: string, odometer?: number, pull = true, sent = false) {
  let bay: unknown = null;
  let tookDirty = false;
  const addsClean = exit === 'clean' && !sent;
  const takes = exit === 'clean' ? (sent ? 'sent' : null) : dirtyOnly(exit);
  // The count first: a Clean that cannot move the count must not land on the list as if it had.
  if (addsClean) ({ saved: bay, tookDirty } = await moveCount(db, { action: 'cleans', delta: 1, fix: false, by }, nowIso, today));
  else if (takes) ({ saved: bay, tookDirty } = await moveCount(db, r => heldExitChange(r, 'take', by, nowIso, takes), nowIso, today));
  const sentUp = exit === 'clean' && sent ? { sent_up: true, sent_at_exit: true } : {};
  const { data: row, error } = await db.from('lot_bay_log')
    .update({ exit, exited_at: nowIso, took_dirty: tookDirty, ...sentUp, ...(odometer ? { odometer } : {}) }).eq('id', id).is('exit', null)
    .select(BAY_LOG_COLS).maybeSingle();
  if (error) throw error;
  if (!row) {
    // Already out (another tap, another phone). Put the count back if this tap moved it.
    if (addsClean) ({ saved: bay } = await moveCount(db, { action: 'cleans', delta: -1, fix: true, giveDirty: tookDirty, by }, nowIso, today));
    else if (tookDirty) await moveCount(db, r => heldExitChange(r, 'give', by, nowIso), nowIso, today);
    throw new BayLogRefusal('That car already left the bay.');
  }
  return { row, bay, ...(pull ? await pullNext(db, id, by, nowIso, today) : {}) };
}

/** "↩ Back to Next up" (2026-11-03): the car in the bay goes back in line with NO exit — it was not cleaned, held or
 *  skipped, so nothing goes on the list and no count moves (a Start moved none). The row goes, the way unpull's does,
 *  and ▶ Start cleaning on Next up brings the car back. A different car already on Next up is only replaced on his yes. */
export async function bumpToNextUp(db: SupabaseClient, id: number, by: string, nowIso: string, today: string, replace: boolean) {
  const { data: row, error } = await db.from('lot_bay_log').select('id, vehicle_id, plate, unit_number, car')
    .eq('id', id).is('exit', null).maybeSingle();
  if (error) throw error;
  if (!row) throw new BayLogRefusal('That car already left the bay.');
  const { data: sb, error: sbErr } = await db.from('lot_bay_standby').select('vehicle_id, plate, shift_day').eq('id', 1).maybeSingle();
  if (sbErr) throw sbErr;
  if (sb && sb.shift_day === today && sb.vehicle_id !== row.vehicle_id && !replace) throw new BayLogRefusal(`${sb.plate} is on deck. Replace it?`);
  // Guarded on `exit is null`: an exit from another phone in between wins, and its row is never deleted.
  const { data: gone, error: delErr } = await db.from('lot_bay_log').delete().eq('id', id).is('exit', null).select('id');
  if (delErr) throw delErr;
  if (!gone?.length) throw new BayLogRefusal('That car already left the bay.');
  const { data: standby, error: upErr } = await db.from('lot_bay_standby').upsert({
    id: 1, vehicle_id: row.vehicle_id, plate: row.plate, unit_number: row.unit_number, car: row.car, loaded_at: nowIso, loaded_by: by, shift_day: today,
  }).select(STANDBY_COLS).single();
  // The row is already gone: say plainly where the car is, so it is never lost between the two.
  if (upErr) throw new BayLogRefusal(`${row.plate} left the bay but did not go on deck. Start it again from Find a car.`);
  return { removedId: id, standby };
}

export async function undoExit(db: SupabaseClient, id: number, by: string, nowIso: string, today: string) {
  const { data: was, error: readErr } = await db.from('lot_bay_log').select('exit, exited_at, took_dirty, sent_at_exit').eq('id', id).maybeSingle();
  if (readErr) throw readErr;
  if (!was || !undoAllowed(was.exited_at, Date.parse(nowIso))) throw new BayLogRefusal('Too late to undo that one.');
  const unpulled = await unpull(db, id, by, nowIso, today);
  const { data: row, error } = await db.from('lot_bay_log')
    // hold_id goes too: the car is back in, and its next exit may be a different kind. So do a changed line's first exit and
    // ✈ sent up (migrations 167, 169): the car is in the bay again, not on the list.
    .update({ exit: null, exited_at: null, took_dirty: false, hold_id: null, was_exit: null, sent_up: false, sent_at_exit: false }).eq('id', id).eq('exited_at', was.exited_at)
    .select(BAY_LOG_COLS).maybeSingle();
  if (error?.code === '23505') throw new BayLogRefusal('Another car is in the bay now.');
  if (error) throw error;
  if (!row) throw new BayLogRefusal('That car already changed.');
  let bay: unknown = null;
  if (was.exit === 'clean' && !was.sent_at_exit) {
    try {
      ({ saved: bay } = await moveCount(db, { action: 'cleans', delta: -1, fix: true, giveDirty: was.took_dirty, by }, nowIso, today));
    } catch (e) {
      // The clean already went up (a drain at 0 cleans). The car is back in the bay; the count stays as the lot is.
      if (!(e instanceof BayLogRefusal)) throw e;
    }
  } else if ((dirtyOnly(was.exit) || was.sent_at_exit) && was.took_dirty) {
    ({ saved: bay } = await moveCount(db, r => heldExitChange(r, 'give', by, nowIso), nowIso, today));
  }
  return { row, bay, ...unpulled };
}

/**
 * A car cleaned while he was off the floor (migration 165, docs/ticket-bay-add-a-car-cleaned.md): *"just a way to add
 * them in if needed"*. Straight onto the list as a Clean, stamped NOW and marked `added`, so nobody reads its time as
 * the minute it was washed. The car in the bay is never touched. The count moves first, as a Clean exit's does; a row
 * that cannot land gives it back.
 */
export async function addCleaned(db: SupabaseClient, vehicleId: string, by: string, nowIso: string, today: string) {
  const { data: v, error: vErr } = await db.from('vehicles')
    .select(`id, license_plate, unit_number, ${CAR_LINE_COLS}, odometer, odometer_at`).eq('id', vehicleId).maybeSingle();
  if (vErr) throw vErr;
  if (!v) throw new BayLogRefusal('That car is not in FG.');
  const { data: day, error: dayErr } = await db.from('lot_bay_log')
    .select('id, vehicle_id, exit, redo_of, started_at').or(`shift_day.eq.${today},exit.is.null`);
  if (dayErr) throw dayErr;
  if ((day ?? []).some(r => r.exit == null && r.vehicle_id === v.id)) throw new BayLogRefusal(`${v.license_plate} is in the bay now. Give it an exit there.`);
  const { saved: bay, tookDirty } = await moveCount(db, { action: 'cleans', delta: 1, fix: false, by }, nowIso, today);
  const { data: row, error } = await db.from('lot_bay_log').insert({
    vehicle_id: v.id, plate: v.license_plate, unit_number: v.unit_number, car: carLine(v), odometer: startOdometer(v, today),
    started_at: nowIso, started_by: by, exit: 'clean', exited_at: nowIso, took_dirty: tookDirty, added: true,
    shift_day: today, redo_of: redoOf((day ?? []) as DayRow[], v.id),
  }).select(BAY_LOG_COLS).single();
  if (error) {
    // The row did not land, so the +1 must not stand on its own. Best-effort: the save's own error is the one he sees.
    await moveCount(db, { action: 'cleans', delta: -1, fix: true, giveDirty: tookDirty, by }, nowIso, today).catch(() => {});
    throw error;
  }
  return { row, bay };
}

/** An added car's Undo: inside the window, and only a row that was added. The row goes (a mis-tap is not the record,
 *  unpull's precedent) and the count goes back; a clean that already went up leaves the count as the lot is. */
export async function undoAdd(db: SupabaseClient, id: number, by: string, nowIso: string, today: string) {
  const { data: was, error: readErr } = await db.from('lot_bay_log').select('added, exited_at, took_dirty').eq('id', id).maybeSingle();
  if (readErr) throw readErr;
  if (!was || !was.added || !undoAllowed(was.exited_at, Date.parse(nowIso))) throw new BayLogRefusal('Too late to undo that one.');
  const { data: gone, error: delErr } = await db.from('lot_bay_log').delete().eq('id', id).eq('added', true).select('id');
  if (delErr) throw delErr;
  if (!gone?.length) throw new BayLogRefusal('That car already changed.');
  let bay: unknown = null;
  try {
    ({ saved: bay } = await moveCount(db, { action: 'cleans', delta: -1, fix: true, giveDirty: was.took_dirty, by }, nowIso, today));
  } catch (e) {
    if (!(e instanceof BayLogRefusal)) throw e;
  }
  return { removedId: id, bay };
}

/**
 * His delete (2026-11-06, docs/ticket-bay-remove-a-row.md): a finished row on TODAY's list goes, and Erin St's count goes
 * back with it by removeCountPlan. A car still in the bay is an exit's job (or Back to Next up); an earlier day's counts
 * are long settled. The rows it pulled in, or that redid it, keep their own lines: their links to it are cleared first,
 * because both columns reference this row (migrations 161, 163) and would refuse the delete.
 */
export async function removeRow(db: SupabaseClient, id: number, by: string, nowIso: string, today: string) {
  const { data: was, error: readErr } = await db.from('lot_bay_log').select('plate, exit, exited_at, took_dirty, shift_day, sent_at_exit').eq('id', id).maybeSingle();
  if (readErr) throw readErr;
  if (!was) throw new BayLogRefusal('That car is already off the list.');
  if (!was.exit || !was.exited_at) throw new BayLogRefusal(`${was.plate} is still in the bay. Give it an exit first.`);
  if (was.shift_day !== today) throw new BayLogRefusal('Only today\'s list can take a car off.');
  // His hand counts since the exit: a typed cleans SET, a dirties set or step.
  const { data: taps, error: tapErr } = await db.from('lot_bay_taps').select('kind').gt('tapped_at', was.exited_at).in('kind', ['set', 'dirties']);
  if (tapErr) throw tapErr;
  const plan = removeCountPlan(was as { exit: BayExit; took_dirty: boolean; sent_at_exit: boolean },
    { cleansSet: (taps ?? []).some(t => t.kind === 'set'), dirtiesSet: (taps ?? []).some(t => t.kind === 'dirties') });
  for (const col of ['pulled_by', 'redo_of'] as const) {
    const { error } = await db.from('lot_bay_log').update({ [col]: null }).eq(col, id);
    if (error) throw error;
  }
  // Guarded on the exit it was read with: an Undo in between leaves the row as it now is.
  const { data: gone, error: delErr } = await db.from('lot_bay_log').delete().eq('id', id).eq('exited_at', was.exited_at).select('id');
  if (delErr) throw delErr;
  if (!gone?.length) throw new BayLogRefusal('That car already changed.');
  let bay: unknown = null;
  try {
    if (plan.cleans) ({ saved: bay } = await moveCount(db, { action: 'cleans', delta: -1, fix: true, giveDirty: plan.giveDirty, by }, nowIso, today));
    else if (plan.giveDirty) ({ saved: bay } = await moveCount(db, r => heldExitChange(r, 'give', by, nowIso), nowIso, today));
  } catch (e) {
    // A count already at 0 stays as the lot is (undoAdd's precedent). The row is gone either way.
    if (!(e instanceof BayLogRefusal)) throw e;
  }
  return { removedId: id, bay };
}

/** His note on a row that has an exit (a car still in the bay has no line of its own yet). Null clears it. */
export async function setNote(db: SupabaseClient, id: number, note: string | null) {
  const { data: row, error } = await db.from('lot_bay_log').update({ note }).eq('id', id).not('exit', 'is', null)
    .select(BAY_LOG_COLS).maybeSingle();
  if (error) throw error;
  if (!row) throw new BayLogRefusal('That car is not on the list yet.');
  return { row };
}

/** "Same as the … hold": an M / B row tied to the ACTIVE hold already on its car, so it reads as flagged. */
export async function linkHold(db: SupabaseClient, id: number, holdId: string) {
  const { data: was, error: rowErr } = await db.from('lot_bay_log').select('vehicle_id, exit').eq('id', id).maybeSingle();
  if (rowErr) throw rowErr;
  const { data: hold, error: holdErr } = await db.from('holds').select('vehicle_id, status, hold_types').eq('id', holdId).maybeSingle();
  if (holdErr) throw holdErr;
  const why = linkRefusal(was as { vehicle_id: string; exit: BayExit | null } | null, hold);
  if (why) throw new BayLogRefusal(why);
  // Guarded on the exit it was checked against: an Undo in between leaves the row as it now is.
  const { data: row, error } = await db.from('lot_bay_log').update({ hold_id: holdId }).eq('id', id).eq('exit', was!.exit!)
    .select(BAY_LOG_COLS).maybeSingle();
  if (error) throw error;
  if (!row) throw new BayLogRefusal('That car already changed.');
  return { row };
}
