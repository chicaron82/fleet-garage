import type { TripRun } from '../data/trips';

const FLAG_THRESHOLD_MINUTES = 30; // flag anything over this

export function getTripDurationMinutes(trip: TripRun): number {
  return Math.round(
    (new Date(trip.arriveTime).getTime() - new Date(trip.departTime).getTime())
    / 60000
  );
}

export function isTripFlagged(trip: TripRun): boolean {
  return getTripDurationMinutes(trip) > FLAG_THRESHOLD_MINUTES;
}
