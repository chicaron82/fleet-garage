// Reading and writing the "last seen" log — the scan-sighting half of the vehicle record.
//
// Split from useVehicleHistory on purpose: that hook is already the vehicle screen's convergence
// point, and a sighting is a different axis (when did I HOLD this car) from holds/releases/repairs
// (what's wrong with it). Its own small hook keeps both readable.
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { summariseSightings, sightingsFromChanges, type SightingSummary, type Sighting } from '../lib/sightings';

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
export function useVehicleSightings(
  plate: string | null | undefined,
  /** ⭐ The change log is keyed on VEHICLE ID while sightings are keyed on PLATE — deliberately, so
   *  a scan taken before the car was registered still counts. Both are needed: the scans he made,
   *  and the interactions FG watched him make. Optional, because a plate with no registered car has
   *  no change history to union in. */
  vehicleId?: string | null,
): SightingSummary & { rows: Sighting[] } {
  // The loaded rows are STAMPED WITH THE PLATE they belong to, and the summary is DERIVED from
  // that stamp — two reasons, and the second is the real one:
  //   1. No synchronous setState in the effect body (react-hooks/set-state-in-effect).
  //   2. ⚠️ Correctness: holding a bare row array would show the PREVIOUS car's count for the
  //      moment between navigating to a new vehicle and its fetch landing. Derived state can't
  //      drift; captured state always can. Stamping makes a mismatch unrenderable rather than brief.
  const [loaded, setLoaded] = useState<{ plate: string; rows: Sighting[] } | null>(null);
  const key = plate ? plate.toUpperCase() : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    async function load() {
      // Both halves in parallel: the scans he made, and the interactions FG watched him make.
      const [sight, changes] = await Promise.all([
        supabase
          .from('vehicle_sightings')
          .select('seen_at, seen_by_name')
          .eq('plate', key!)
          .order('seen_at', { ascending: false })
          .limit(500),
        vehicleId
          ? supabase
              .from('vehicle_changes')
              .select('changed_at, changed')
              .eq('vehicle_id', vehicleId)
              .order('changed_at', { ascending: false })
              .limit(500)
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      const scanned: Sighting[] = (sight.data ?? []).map(r => ({
        seenAt: r.seen_at as string,
        seenByName: (r as { seen_by_name?: string | null }).seen_by_name ?? null,
      }));
      const derived = sightingsFromChanges(
        (changes.data ?? []).map(r => ({
          changedAt: (r as { changed_at: string }).changed_at,
          fields: Object.keys(((r as { changed?: Record<string, unknown> }).changed) ?? {}),
        })),
      );
      setLoaded({ plate: key!, rows: [...scanned, ...derived] });
    }
    void load();
    // A late response for a car he's already navigated away from must not paint its count onto
    // the new record — cheap guard, invisible bug without it.
    return () => { cancelled = true; };
  }, [key, vehicleId]);

  // ⭐ The ROWS ride along with the summary so the record can reveal the full history on a tap
  // (Aaron, 2026-08-26) without a second fetch — they were already loaded to compute the summary.
  if (!key || loaded?.plate !== key) return { ...EMPTY, rows: [] };
  return { ...summariseSightings(loaded.rows, mineFor(key)), rows: loaded.rows };
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

/**
 * ── THE HELD SIGHTING ──────────────────────────────────────────────────────────────────────────
 *
 * Aaron's rule, which is right and stays: *"typing something in just to look it up won't count as
 * seen."* A photographed tag proves he was holding the car; a typed plate proves nothing about
 * where he is. So a typed lookup's sighting is HELD, and only recorded once he does something that
 * could only be done AT the car.
 *
 * ⚠️ WHAT WAS BROKEN (Aaron, 2026-08-28, mid-shift): *"when I type it in to update the odo or flag
 * it FG doesn't count those actions as 'seen'. I saw this vehicle twice today. both interactions
 * weren't counted."*
 *
 * The held sighting lived in a `useRef` inside `ScanRouterOverlay`, and the overlay's `go()` cleared
 * it on EVERY route — including `view`, which `actionImpliesPresence` deliberately excludes. So
 * "View unit" dropped the sighting on the floor, and the odometer reading and the flag he then made
 * ON THE RECORD had nothing left to redeem. **The rule was never wrong; the evidence just could not
 * survive a navigation.**
 *
 * ⭐ AND THE ACTION IS THE BETTER PROOF ANYWAY. Which button he taps in a routing sheet is a *proxy*
 * for being at the car. Reading an odometer is not a proxy — **you cannot read a dash from a desk.**
 * So the commit belongs on the write, not on the route.
 *
 * Module-scoped for the same reason as `sightingsThisSession`: a reload is genuinely a new visit.
 * At most one is ever held — a new lookup replaces the last — and it is scoped to its vehicle, so
 * an action on a DIFFERENT car can never redeem it.
 */
let pendingSighting: (Parameters<typeof recordSighting>[0]) | null = null;

/** Hold a typed lookup's sighting until an act of presence redeems it. Replaces any previous. */
export function holdSighting(input: Parameters<typeof recordSighting>[0]): void {
  pendingSighting = input;
}

/** Drop it unredeemed — he looked the car up and walked away without touching it. */
export function dropPendingSighting(): void {
  pendingSighting = null;
}

/**
 * Redeem the held sighting for THIS car, if there is one. Called from the writes that can only
 * happen at the vehicle (odometer, hold). Fire-and-forget and idempotent: consumed at most once,
 * and a no-op when nothing is held — so a scanned car, whose sighting was already recorded at the
 * read, can never be double-counted by the odometer he types in straight afterwards.
 */
export function commitSightingFor(vehicleId: string): void {
  const held = pendingSighting;
  if (!held) return;
  if (held.vehicleId && held.vehicleId !== vehicleId) return;
  pendingSighting = null;
  void recordSighting(held);
}

/**
 * Redeem it without naming a car — for the scan router, where he has just PICKED an action on the
 * very car he looked up, so there is nothing to disambiguate. (The scoped version above exists for
 * the writes, which fire on cars he may have reached any number of ways.)
 */
export function commitPendingSighting(): void {
  const held = pendingSighting;
  if (!held) return;
  pendingSighting = null;
  void recordSighting(held);
}
