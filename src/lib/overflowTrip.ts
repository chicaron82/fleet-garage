// Building an overflow send as a vsa_trips row. When a VSA sends a ready vehicle out
// to an overflow spot (AV Flight, FastAir, the airport) and it STAYS there, that's a
// one-way "airport flip" — the app already models exactly this (see buildArrivalUpdate
// in vsa-trip.ts, which forces queue_at_arrival null on one-way runs). The only new
// thing over a generic airport run is a GRANULAR arrive_location instead of the
// hardcoded 'Airport Run', so "where's X?" can name the real spot days later.
import type { Database } from '../types/database.types';
import type { OverflowDestination } from '../../api/_lib/overflowProposal';

type VsaTripInsert = Database['public']['Tables']['vsa_trips']['Insert'];

/**
 * Build one completed, one-way vsa_trips insert for a vehicle sent to an overflow
 * spot. depart_location stays 'Airport Run' (matching the existing run rows so the
 * Movement Log renders it consistently); arrive_location carries the real spot.
 *
 * Pure: takes a fixed `nowMs` and row `index` so a batch logged in one tap gets one
 * deterministic timestamp and collision-free ids (`trip-<nowMs>-<index>`).
 */
export function buildOverflowTrip(
  vehicle: { plate: string; unit: string | null },
  destination: OverflowDestination,
  driverId: string,
  branchId: string | null,
  nowMs: number,
  index: number,
): VsaTripInsert {
  const iso = new Date(nowMs).toISOString();
  return {
    id: `trip-${nowMs}-${index}`,
    driver_id: driverId,
    vehicle_plate: vehicle.plate,
    vehicle_unit: vehicle.unit,
    trip_type: 'clean',
    depart_location: 'Airport Run',
    arrive_location: destination,
    depart_time: iso,
    arrive_time: iso,
    status: 'complete',
    one_way: true,
    is_shuttle: false,
    branch_id: branchId,
  };
}
