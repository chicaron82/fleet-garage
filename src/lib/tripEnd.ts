// What a finished airport run does besides its own row, shared by the trip card's End and the header pill's end
// (docs/ticket-pill-tap-ends-session.md): the auto off-standard "VSA Airport Run" entry, and the long-run alert. Moved
// here from MovementLogVsaView and useTripLifecycle so the two ends cannot drift.
import { supabase, writeWithRefresh } from './supabase';
import { pushNotification } from './garage-uploads';
import { TRIP_DURATION_THRESHOLDS } from './vsa-trip';
import type { User } from '../types';

/** A run shorter than this logs no off-standard entry. */
export const AUTO_ENTRY_MIN_MINUTES = 5;

export function tripMinutes(departIso: string, arriveIso: string): number {
  return Math.round((Date.parse(arriveIso) - Date.parse(departIso)) / 60000);
}

/** The run's off-standard entry (reason OTH, "VSA Airport Run"), 5 minutes and up. True when one was written. */
export async function insertAutoTripEntry(user: Pick<User, 'id' | 'branchId'>, departIso: string, arriveIso: string, date: string): Promise<boolean> {
  const minutes = tripMinutes(departIso, arriveIso);
  if (minutes < AUTO_ENTRY_MIN_MINUTES) return false;
  await writeWithRefresh(() => supabase.from('off_standard_entries').insert({
    user_id:        user.id,
    branch_id:      user.branchId,
    date,
    start_time:     departIso,
    stop_time:      arriveIso,
    minutes,
    reason:         'OTH',
    explanation:    'VSA Airport Run',
    auto_from_trip: true,
    status:         'complete',
  }));
  return true;
}

/** A run past the alert threshold tells the managers. */
export async function notifyLongRun(user: Pick<User, 'id' | 'name' | 'branchId'>, departIso: string, arriveIso: string): Promise<void> {
  const elapsedMinutes = tripMinutes(departIso, arriveIso);
  if (elapsedMinutes <= TRIP_DURATION_THRESHOLDS.alert) return;
  await pushNotification(
    user.branchId,
    ['Branch Manager', 'Operations Manager', 'City Manager', 'Lead VSA'],
    '🐢',
    `Long airport run — ${user.name} · Airport Run · ${elapsedMinutes} minutes`,
    'warning',
    { userId: user.id, elapsedMinutes },
  );
}
