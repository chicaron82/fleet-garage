// Reading and writing the "last seen" log — the scan-sighting half of the vehicle record.
//
// Split from useVehicleHistory on purpose: that hook is already the vehicle screen's convergence
// point, and a sighting is a different axis (when did I HOLD this car) from holds/releases/repairs
// (what's wrong with it). Its own small hook keeps both readable.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { summariseSightings, type SightingSummary } from '../lib/sightings';

const EMPTY: SightingSummary = { lastSeenAt: null, priorSeenAt: null, count: 0, neverSeen: true };

/**
 * The sightings THIS SESSION recorded, by plate — the exact `seen_at` strings it sent.
 *
 * ⭐ This is what makes "not counting right now" answerable without a time window. Aaron scans a
 * car, the record opens, and its own scan is the newest row — so "last seen" reports his own act of
 * looking back to him as news. Skipping it needs an identity, not a guess, so `recordSighting`
 * sends an explicit `seen_at` and files the string here; a row is this visit's iff it MATCHES one.
 *
 * ⚠️ A threshold would have been the easy version and it drifts both ways: he can be pulled off a
 * car for half an hour (the scan stops counting as "now" while he is still standing there), or
 * legitimately scan the same car twice inside ten minutes (a real prior visit gets swallowed).
 *
 * Module-scoped, so it lives exactly as long as the app session — which is the right lifetime: a
 * reload genuinely IS a new visit, and after one the newest row is the honest answer again.
 */
const sightingsThisSession = new Map<string, Set<string>>();

function mineFor(plate: string): ReadonlySet<string> {
  return sightingsThisSession.get(plate.toUpperCase()) ?? EMPTY_SET;
}
const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Sighting summary for one plate. Keyed on PLATE rather than vehicle id so a scan taken *before*
 * the car was registered still counts — he scans first and registers second, so the sighting that
 * created a vehicle should show up in that vehicle's own history (see migrations/114).
 */
export function useVehicleSightings(plate: string | null | undefined): SightingSummary {
  // The loaded rows are STAMPED WITH THE PLATE they belong to, and the summary is DERIVED from
  // that stamp — two reasons, and the second is the real one:
  //   1. No synchronous setState in the effect body (react-hooks/set-state-in-effect).
  //   2. ⚠️ Correctness: holding a bare row array would show the PREVIOUS car's count for the
  //      moment between navigating to a new vehicle and its fetch landing. Derived state can't
  //      drift; captured state always can. Stamping makes a mismatch unrenderable rather than brief.
  const [loaded, setLoaded] = useState<{ plate: string; rows: { seenAt: string }[] } | null>(null);
  const key = plate ? plate.toUpperCase() : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('vehicle_sightings')
        .select('seen_at')
        .eq('plate', key!)
        .order('seen_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      setLoaded({ plate: key!, rows: (data ?? []).map(r => ({ seenAt: r.seen_at as string })) });
    }
    void load();
    // A late response for a car he's already navigated away from must not paint its count onto
    // the new record — cheap guard, invisible bug without it.
    return () => { cancelled = true; };
  }, [key]);

  if (!key || loaded?.plate !== key) return EMPTY;
  return summariseSightings(loaded.rows, mineFor(key));
}

/**
 * Record one sighting. FIRE-AND-FORGET BY CONTRACT — never await this on the scan path.
 *
 * The scan is the operator's actual job: read the tag, see the damage, route to the action. A
 * bookkeeping insert failing (offline in the bay, RLS change, table missing on a preview deploy)
 * must cost him a log line, not his scan. So every path swallows after a console.error. Losing a
 * row costs one tick of a counter; losing a scan costs him the car in his hand.
 */
export async function recordSighting(input: {
  plate: string;
  vehicleId?: string | null;
  seenById?: string | null;
  seenByName?: string | null;
  branchId?: string | null;
}): Promise<void> {
  if (!input.plate) return;
  const plate = input.plate.toUpperCase();
  // ⭐ SEND the timestamp rather than letting the column default fill it, so this session can
  // recognise its own row by equality later (see sightingsThisSession). Filed BEFORE the await:
  // the record can render while the insert is still in flight, and a sighting we made but haven't
  // filed yet would show up as a "prior" visit — the exact thing this is meant to exclude.
  const seenAt = new Date().toISOString();
  const mine = sightingsThisSession.get(plate) ?? new Set<string>();
  mine.add(seenAt);
  sightingsThisSession.set(plate, mine);
  try {
    const { error } = await supabase.from('vehicle_sightings').insert({
      seen_at: seenAt,
      plate,
      vehicle_id: input.vehicleId ?? null,
      seen_by_id: input.seenById ?? null,
      seen_by_name: input.seenByName ?? null,
      branch_id: input.branchId ?? null,
    });
    if (error) console.error('[recordSighting] insert failed:', error.message);
  } catch (err) {
    console.error('[recordSighting] insert threw:', err);
  }
}
