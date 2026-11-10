// The header pill's end when the session's card is NOT mounted (he is in another module), so the card's own End cannot
// run: the same writes, from the session's row (docs/ticket-pill-tap-ends-session.md). When the card IS mounted (both
// movement-log tabs stay mounted), the pill ends through the card instead, so a mounted card never goes stale.
import { buildArrivalUpdate, type Authorization, type QueueSnapshot } from './vsa-trip';
import { writeOrEnqueue as writeTrip } from './vsaTripWrite';
import { writeOrEnqueue as writeOth } from './offStandardWrite';
import { insertAutoTripEntry, notifyLongRun, tripMinutes } from './tripEnd';
import { OTH_MIN_ENTRY_MINUTES } from './activeSessions';
import type { EvAssetStatus, User } from '../types';

/** The trip row the pill reads at the tap. */
export interface PillTripRow {
  id: string; depart_time: string; auth_type: string | null; queue_at_departure: string | null; notes: string | null;
  ev_cable_status: string | null; ev_adapter_status: string | null; status: string;
}
/** The off-standard row the pill reads at the tap. */
export interface PillOthRow { id: string; start_time: string; preset_reason: string | null; status: string }

export const PILL_TRIP_COLS = 'id, depart_time, auth_type, queue_at_departure, notes, ev_cable_status, ev_adapter_status, status';
export const PILL_OTH_COLS = 'id, start_time, preset_reason, status';

/**
 * Back at Washbay, from the row: what the start wrote rides through unchanged (the EV kit statuses are null on a
 * non-Tesla run, so passing them as-is writes the same). Then the run's off-standard entry and the long-run alert,
 * exactly as the card's End does.
 */
export async function endTripHeadless(row: PillTripRow, atIso: string, user: Pick<User, 'id' | 'name' | 'branchId'>, date: string): Promise<boolean> {
  const { ok } = await writeTrip('update', buildArrivalUpdate({
    oneWay: false, authorization: row.auth_type as Authorization | null, queue: row.queue_at_departure as QueueSnapshot | null,
    queueArrival: null, notes: row.notes ?? '', isTeslaRun: true,
    evCableStatus: row.ev_cable_status as EvAssetStatus | null, evAdapterStatus: row.ev_adapter_status as EvAssetStatus | null,
  }, atIso), 'id', row.id);
  if (!ok) return false;
  await insertAutoTripEntry(user, row.depart_time, atIso, date);
  await notifyLongRun(user, row.depart_time, atIso);
  return true;
}

/** The timer's End, from the row: logged at 5 minutes and up (its notes were saved as he typed them), else thrown away. */
export async function endOthHeadless(row: PillOthRow, atIso: string): Promise<boolean> {
  const minutes = tripMinutes(row.start_time, atIso);
  if (minutes < OTH_MIN_ENTRY_MINUTES) return (await writeOth('delete', 'off_standard_entries', {}, 'id', row.id)).ok;
  return (await writeOth('update', 'off_standard_entries', { stop_time: atIso, minutes, status: 'complete' }, 'id', row.id)).ok;
}
