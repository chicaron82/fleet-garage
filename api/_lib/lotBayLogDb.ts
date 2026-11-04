// Lot Lookout's bay log (migration 161), the database side for api/lot.ts: Start a car, give it an exit, take an exit
// back. The rules are pure in lotBayLog.ts; Erin St's count moves through lotBay.ts's own rule, so a Clean exit is the
// same +1 (and takes the same dirty) as a tap on the count. Ticket: docs/ticket-lot-lookout-bay-log.md.
// M hold and B hold take one off the dirties (heldExitChange; docs/ticket-bay-hold-exit-takes-a-dirty.md). Skip moves
// nothing. `took_dirty` records either kind of take, so an Undo or a lost race gives back only what was taken.
// Erin (2026-11-04, migration 164) takes a dirty the same way, under its own tap kind, and never adds a clean. Notes and
// the link to a hold already on the car: setNote, linkHold (docs/ticket-bay-erin-exit-notes-existing-hold.md).
import type { SupabaseClient } from '@supabase/supabase-js';
import { bayChange, heldExitChange, type BayChange, type BayRequest, type BayRow } from './lotBay.js';
import { carLine, linkRefusal, redoOf, startOdometer, undoAllowed, type BayExit, type DayRow } from './lotBayLog.js';

export const BAY_LOG_COLS = 'id, vehicle_id, plate, unit_number, car, odometer, started_at, exit, exited_at, took_dirty, redo_of, shift_day, note, hold_id';

/** A refusal the phone shows as it is (409), as opposed to a thrown error (500). */
export class BayLogRefusal extends Error {}

const STANDBY_COLS = 'vehicle_id, plate, unit_number, car, shift_day';

const isHold = (exit: BayExit | null) => exit === 'mhold' || exit === 'bhold';
/** The exits that take a dirty and add no clean, and the tap each one logs. */
const dirtyOnly = (exit: BayExit | null): 'held' | 'erin' | null => (isHold(exit) ? 'held' : exit === 'erin' ? 'erin' : null);

/** Erin St's count, moved by the count's own rule: a tap's request, or a hold exit's change (null = nothing to move). */
async function moveCount(db: SupabaseClient, req: BayRequest | ((row: BayRow) => BayChange | null), nowIso: string, today: string) {
  const { data: row, error: readErr } = await db.from('lot_bay').select('cleans, dirties, used, used_on').eq('id', 1).single();
  if (readErr) throw readErr;
  const change = typeof req === 'function' ? req(row) : bayChange(row, req, nowIso, today);
  if (!change) return { saved: null, tookDirty: false };
  if ('error' in change) throw new BayLogRefusal(change.error);
  const { data: saved, error } = await db.from('lot_bay').update(change.patch).eq('id', 1).select().single();
  if (error) throw error;
  await db.from('lot_bay_taps').insert(change.tap);
  return { saved, tookDirty: (saved.dirties ?? 0) < (row.dirties ?? 0) };
}

/** `pulledBy`: the exit that pulled this car in off Next up, so its Undo can rewind both (migration 163). */
export async function startCar(db: SupabaseClient, vehicleId: string, by: string, nowIso: string, today: string, pulledBy?: number) {
  const { data: open, error: openErr } = await db.from('lot_bay_log').select('plate').is('exit', null).maybeSingle();
  if (openErr) throw openErr;
  if (open) throw new BayLogRefusal(`${open.plate} is still in the bay. Give it an exit first.`);
  const { data: v, error: vErr } = await db.from('vehicles')
    .select('id, license_plate, unit_number, year, make, model, color, odometer, odometer_at').eq('id', vehicleId).maybeSingle();
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
    .select('id, license_plate, unit_number, year, make, model, color').eq('id', vehicleId).maybeSingle();
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

/** `pull`: false for "Clean only, X waits" — the exit lands and Next up's car stays loaded for later. */
export async function exitCar(db: SupabaseClient, id: number, exit: BayExit, by: string, nowIso: string, today: string, odometer?: number, pull = true) {
  let bay: unknown = null;
  let tookDirty = false;
  // The count first: a Clean that cannot move the count must not land on the list as if it had.
  if (exit === 'clean') ({ saved: bay, tookDirty } = await moveCount(db, { action: 'cleans', delta: 1, fix: false, by }, nowIso, today));
  else if (dirtyOnly(exit)) ({ saved: bay, tookDirty } = await moveCount(db, r => heldExitChange(r, 'take', by, nowIso, dirtyOnly(exit)!), nowIso, today));
  const { data: row, error } = await db.from('lot_bay_log')
    .update({ exit, exited_at: nowIso, took_dirty: tookDirty, ...(odometer ? { odometer } : {}) }).eq('id', id).is('exit', null)
    .select(BAY_LOG_COLS).maybeSingle();
  if (error) throw error;
  if (!row) {
    // Already out (another tap, another phone). Put the count back if this tap moved it.
    if (exit === 'clean') ({ saved: bay } = await moveCount(db, { action: 'cleans', delta: -1, fix: true, giveDirty: tookDirty, by }, nowIso, today));
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
  const { data: was, error: readErr } = await db.from('lot_bay_log').select('exit, exited_at, took_dirty').eq('id', id).maybeSingle();
  if (readErr) throw readErr;
  if (!was || !undoAllowed(was.exited_at, Date.parse(nowIso))) throw new BayLogRefusal('Too late to undo that one.');
  const unpulled = await unpull(db, id, by, nowIso, today);
  const { data: row, error } = await db.from('lot_bay_log')
    // hold_id goes too: the car is back in, and its next exit may be a different kind.
    .update({ exit: null, exited_at: null, took_dirty: false, hold_id: null }).eq('id', id).eq('exited_at', was.exited_at)
    .select(BAY_LOG_COLS).maybeSingle();
  if (error?.code === '23505') throw new BayLogRefusal('Another car is in the bay now.');
  if (error) throw error;
  if (!row) throw new BayLogRefusal('That car already changed.');
  let bay: unknown = null;
  if (was.exit === 'clean') {
    try {
      ({ saved: bay } = await moveCount(db, { action: 'cleans', delta: -1, fix: true, giveDirty: was.took_dirty, by }, nowIso, today));
    } catch (e) {
      // The clean already went up (a drain at 0 cleans). The car is back in the bay; the count stays as the lot is.
      if (!(e instanceof BayLogRefusal)) throw e;
    }
  } else if (dirtyOnly(was.exit) && was.took_dirty) {
    ({ saved: bay } = await moveCount(db, r => heldExitChange(r, 'give', by, nowIso), nowIso, today));
  }
  return { row, bay, ...unpulled };
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
