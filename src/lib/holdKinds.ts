import type { Hold, HoldType, Vehicle } from '../types';

// WHAT is wrong with the cars on the Holds list — the kinds the filter pills are made of.
//
// Aaron, 2026-09-30: *"i was thinking pills to filter the most flagged ones. i imagine a lot of windshield
// chips/cracks, PM, hail. PM cars get done relatively soon. Broncos are coming in slowly those are on recall
// but will be sitting as parts won't be available until sometime in december"*
//
// ⭐⭐ THE PILLS COME FROM THE LIST, NOT FROM A FIXED SET. Grounded the same day against the live DB: PM is the
// second-biggest real mechanical kind he has ever flagged (51) and had ONE car on hold, because they clear in
// about three days. A fixed PM pill would read 0 almost every time he looked. So a kind renders only while a
// car on the list carries it, and the counts are always of the list in front of him — never all-time.
// docs/ticket-holds-filter-pills.md
//
// ⚠️ A KIND IS NOT A HOLD TYPE. Windshield is a LOCATION (`damageZones`), so it cuts across damage and hail;
// recall / PM / tires are mechanical SUB-types. The type union alone could never have produced these pills.

export type HoldKind = 'hail' | 'damage' | 'windshield' | 'recall' | 'tires' | 'pm' | 'detail';

export const HOLD_KIND_LABELS: Record<HoldKind, string> = {
  hail: 'Hail',
  damage: 'Damage',
  windshield: 'Windshield',
  recall: 'Recall',
  tires: 'Tires',
  pm: 'PM',
  detail: 'Detail',
};

// Words that put a windshield on a hold that never had its zone tapped. Deliberately NOT "chip" or "crack"
// alone — a paint chip on a door or a cracked bumper is not glass, and a pill that lies is worse than none.
const WINDSHIELD_WORDS = /wind\s?(shield|screen)/i;

/** A type still open on this hold — resolved ones are fixed, so they must not keep a car in a pill
 *  (the same rule `findActiveTypeOverlap` uses for a multi-type hold). */
const openType = (h: Hold, t: HoldType) => h.holdTypes.includes(t) && !(h.resolvedTypes ?? []).includes(t);

/** Every kind one hold carries. Empty for any hold that is not ACTIVE. */
export function kindsOfHold(h: Hold): HoldKind[] {
  if (h.status !== 'ACTIVE') return [];
  const kinds: HoldKind[] = [];
  const zones = h.damageZones ?? [];
  const windshield = (openType(h, 'damage') || openType(h, 'hail')) &&
    (zones.includes('windshield') || WINDSHIELD_WORDS.test(h.damageDescription ?? ''));
  // ⭐ DAMAGE MEANS BODY DAMAGE (Aaron, 2026-09-30: *"when i have the damage pill selected. does it carry several
  // of the other ones?"*). 8 of the 20 cars under Damage were windshields, already counted under their own pill,
  // so the two pills read as one pile twice. A hold whose ONLY panel is the windshield is a Windshield hold and
  // nothing else; a hold that ALSO names a body panel (windshield + hood) is honestly both.
  const windshieldOnly = windshield && zones.every(z => z === 'windshield');
  if (openType(h, 'hail')) kinds.push('hail');
  if (openType(h, 'damage') && !windshieldOnly) kinds.push('damage');
  if (windshield) kinds.push('windshield');
  if (openType(h, 'mechanical')) {
    if (h.mechanicalSubType === 'safety-recall') kinds.push('recall');
    if (h.mechanicalSubType === 'pm-due') kinds.push('pm');
    if (h.mechanicalSubType === 'tire-repair' || h.mechanicalSubType === 'tire-replacement' ||
        h.mechanicalSubType === 'tire-swap') kinds.push('tires');
  }
  if (openType(h, 'detail')) kinds.push('detail');
  return kinds;
}

function holdsByVehicle(holds: Hold[]): Map<string, Hold[]> {
  const m = new Map<string, Hold[]>();
  for (const h of holds) {
    const list = m.get(h.vehicleId);
    if (list) list.push(h); else m.set(h.vehicleId, [h]);
  }
  return m;
}

export interface KindPill {
  kind: HoldKind;
  label: string;
  /** Cars (not holds) in the current list carrying this kind. */
  count: number;
  /** Days the longest-waiting car has carried it — the fact that matters for a recall parked till December. */
  oldestDays: number;
}

/**
 * The pills for the list he is looking at, biggest pile first. A kind with no car renders nothing — EXCEPT the
 * one currently selected: if its last car is cleared while the pill is on, the pill must stay so he can turn it
 * off, or the list is empty with no visible reason and no way out.
 */
export function kindPills(vehicles: Vehicle[], holds: Hold[], active: HoldKind | null, now = Date.now()): KindPill[] {
  const byVehicle = holdsByVehicle(holds);
  const tally = new Map<HoldKind, { count: number; oldest: number }>();
  for (const v of vehicles) {
    const since = new Map<HoldKind, number>();
    for (const h of byVehicle.get(v.id) ?? []) {
      const at = new Date(h.flaggedAt).getTime();
      for (const k of kindsOfHold(h)) since.set(k, Math.min(since.get(k) ?? Infinity, at));
    }
    for (const [k, at] of since) {
      const t = tally.get(k) ?? { count: 0, oldest: now };
      tally.set(k, { count: t.count + 1, oldest: Math.min(t.oldest, at) });
    }
  }
  if (active && !tally.has(active)) tally.set(active, { count: 0, oldest: now });
  const order = Object.keys(HOLD_KIND_LABELS) as HoldKind[];
  return [...tally.entries()]
    .map(([kind, t]) => ({
      kind,
      label: HOLD_KIND_LABELS[kind],
      count: t.count,
      oldestDays: Math.max(0, Math.floor((now - t.oldest) / 86_400_000)),
    }))
    // Biggest first; ties fall back to a fixed order so the row never shuffles between renders.
    .sort((a, b) => b.count - a.count || order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** Does this car carry the kind? */
export function vehicleHasKind(vehicleId: string, holds: Hold[], kind: HoldKind): boolean {
  return holds.some(h => h.vehicleId === vehicleId && kindsOfHold(h).includes(kind));
}
