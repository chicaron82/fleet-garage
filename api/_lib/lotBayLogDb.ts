// Lot Lookout's bay log (migration 161), the database side for api/lot.ts: Start a car, give it an exit, take an exit
// back. The rules are pure in lotBayLog.ts; Erin St's count moves through lotBay.ts's own rule, so a Clean exit is the
// same +1 (and takes the same dirty) as a tap on the count. Ticket: docs/ticket-lot-lookout-bay-log.md.
// M hold and B hold take one off the dirties (heldExitChange; docs/ticket-bay-hold-exit-takes-a-dirty.md). Skip moves
// nothing. `took_dirty` records either kind of take, so an Undo or a lost race gives back only what was taken.
import type { SupabaseClient } from '@supabase/supabase-js';
import { bayChange, heldExitChange, type BayChange, type BayRequest, type BayRow } from './lotBay.js';
import { carLine, redoOf, undoAllowed, type BayExit, type DayRow } from './lotBayLog.js';

export const BAY_LOG_COLS = 'id, vehicle_id, plate, unit_number, car, odometer, started_at, exit, exited_at, took_dirty, redo_of, shift_day';

/** A refusal the phone shows as it is (409), as opposed to a thrown error (500). */
export class BayLogRefusal extends Error {}

const isHold = (exit: BayExit | null) => exit === 'mhold' || exit === 'bhold';

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

export async function startCar(db: SupabaseClient, vehicleId: string, by: string, nowIso: string, today: string) {
  const { data: open, error: openErr } = await db.from('lot_bay_log').select('plate').is('exit', null).maybeSingle();
  if (openErr) throw openErr;
  if (open) throw new BayLogRefusal(`${open.plate} is still in the bay. Give it an exit first.`);
  const { data: v, error: vErr } = await db.from('vehicles')
    .select('id, license_plate, unit_number, year, make, model, color, odometer').eq('id', vehicleId).maybeSingle();
  if (vErr) throw vErr;
  if (!v) throw new BayLogRefusal('That car is not in FG.');
  const { data: day, error: dayErr } = await db.from('lot_bay_log')
    .select('id, vehicle_id, exit, redo_of, started_at').eq('shift_day', today);
  if (dayErr) throw dayErr;
  const { data: row, error } = await db.from('lot_bay_log').insert({
    vehicle_id: v.id, plate: v.license_plate, unit_number: v.unit_number, car: carLine(v), odometer: v.odometer,
    started_at: nowIso, started_by: by, shift_day: today, redo_of: redoOf((day ?? []) as DayRow[], v.id),
  }).select(BAY_LOG_COLS).single();
  // 23505: the one-car index. Another phone started a car between the check above and this insert.
  if (error?.code === '23505') throw new BayLogRefusal('Another car went into the bay just now.');
  if (error) throw error;
  return { row, bay: null };
}

export async function exitCar(db: SupabaseClient, id: number, exit: BayExit, by: string, nowIso: string, today: string) {
  let bay: unknown = null;
  let tookDirty = false;
  // The count first: a Clean that cannot move the count must not land on the list as if it had.
  if (exit === 'clean') ({ saved: bay, tookDirty } = await moveCount(db, { action: 'cleans', delta: 1, fix: false, by }, nowIso, today));
  else if (isHold(exit)) ({ saved: bay, tookDirty } = await moveCount(db, r => heldExitChange(r, 'take', by, nowIso), nowIso, today));
  const { data: row, error } = await db.from('lot_bay_log')
    .update({ exit, exited_at: nowIso, took_dirty: tookDirty }).eq('id', id).is('exit', null)
    .select(BAY_LOG_COLS).maybeSingle();
  if (error) throw error;
  if (!row) {
    // Already out (another tap, another phone). Put the count back if this tap moved it.
    if (exit === 'clean') ({ saved: bay } = await moveCount(db, { action: 'cleans', delta: -1, fix: true, giveDirty: tookDirty, by }, nowIso, today));
    else if (tookDirty) await moveCount(db, r => heldExitChange(r, 'give', by, nowIso), nowIso, today);
    throw new BayLogRefusal('That car already left the bay.');
  }
  return { row, bay };
}

export async function undoExit(db: SupabaseClient, id: number, by: string, nowIso: string, today: string) {
  const { data: was, error: readErr } = await db.from('lot_bay_log').select('exit, exited_at, took_dirty').eq('id', id).maybeSingle();
  if (readErr) throw readErr;
  if (!was || !undoAllowed(was.exited_at, Date.parse(nowIso))) throw new BayLogRefusal('Too late to undo that one.');
  const { data: row, error } = await db.from('lot_bay_log')
    .update({ exit: null, exited_at: null, took_dirty: false }).eq('id', id).eq('exited_at', was.exited_at)
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
  } else if (isHold(was.exit) && was.took_dirty) {
    ({ saved: bay } = await moveCount(db, r => heldExitChange(r, 'give', by, nowIso), nowIso, today));
  }
  return { row, bay };
}
