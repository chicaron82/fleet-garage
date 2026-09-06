// What FG has actually RECORDED — the history module, built on real rows rather than demo scaffolding.
//
// ⭐⭐ Aaron, 2026-09-05: *"whatcha think of redoing the analytics module or making a version of one
// that is useful for me instead of one that's essentially all demo from the existing one"* — and he
// named the shape himself: *"what's currently in circulation. like ones actively being captured by FG
// on shifts repeatedly / frequently showing cars/classes / how much of the fleet is damaged / things
// we have data on to surface"*, plus *"I'm more interested in history than right now. I don't have
// the data to handle right now realtime."*
//
// ⚠️⚠️ FG'S REAL RECORD STARTS 2026-04-05. Every hold before that is seeded, and so is every row
// authored by a crew-voice name. Both exclusions belong in the QUERY, not here — this module models
// what it is handed. It says so because a future reader will otherwise reproduce the counts and
// wonder why they disagree.
//
// ⚠️ The windows are SHORT and will stay short for months. His framing, which is the design brief:
// *"window is short now because we only recently started tracking things. doesn't mean the data isn't
// important. how will this look after another month or by the end of the year"* — so every model
// here has to read honestly at fifteen days AND at six months.

/**
 * ⚠️⚠️ THE CANONICAL LIVE-FLEET FILTER, finally expressed as code instead of restated per query.
 *
 * BOTH exclusions, every time: an ARCHIVED car left the fleet, and an `HRZ-` unit is a mock row
 * (`MOCK_UNIT_PREFIX`, damageZones) that exists so writes can be tested against something harmless.
 * Counting either inflates a denominator, which is the quiet way a share becomes wrong — the number
 * still looks reasonable, so nothing catches it.
 *
 * `VehicleHoldContext` deliberately fetches everything (`select('*')`, no filter) because archived
 * cars must remain openable from a history link. So the filtering belongs at the point of counting,
 * which is here.
 */
export function liveFleet<T extends { archivedAt?: string | null; unitNumber?: string | null }>(
  vehicles: readonly T[],
): T[] {
  return vehicles.filter(v => !v.archivedAt && !(v.unitNumber ?? '').startsWith('HRZ-'));
}

/** A class with fewer cars than this is not a rate, it is an anecdote. 4-of-4 reads as 100%. */
export const THIN_CLASS_FLEET = 15;

// ── 1 · damage flagged, by month ────────────────────────────────────────────────────────────────

export interface MonthCount { month: string; label: string; count: number; partial: boolean }

/**
 * Holds per calendar month, oldest first.
 *
 * ⚠️ The CURRENT month is marked `partial` and must be drawn differently. A month three days in,
 * plotted the same way as a finished one, reads as a collapse in damage rather than a collapse in
 * elapsed time — the single most misleading thing this card could do.
 */
export function monthlyHolds(
  flaggedAt: readonly string[],
  now: Date = new Date(),
): MonthCount[] {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const nowKey = key(now);
  const counts = new Map<string, number>();
  for (const ts of flaggedAt) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;      // a bad timestamp is dropped, never counted as now
    const k = key(d);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month,
      label: new Date(`${month}-01T00:00:00`).toLocaleString('en-CA', { month: 'short' }),
      count,
      partial: month === nowKey,
    }));
}

// ── 2 · how much of each class has been flagged ─────────────────────────────────────────────────

export interface ClassDamage {
  rentalClass: string; fleet: number; hit: number; share: number; thin: boolean;
}

/**
 * The share of each class that has been flagged AT LEAST ONCE.
 *
 * ⚠️⚠️ THIS IS NOT A RATE AND MUST NEVER BE LABELLED ONE. It answers "how many of these cars has it
 * happened to", not "how often it happens" — a car flagged four times counts exactly once, which is
 * why `hit` is a distinct-vehicle count upstream. A class where every car has been flagged once and
 * a class where one car has been flagged forty times must not read the same.
 *
 * ⚠️ Classes under THIN_CLASS_FLEET are marked, not hidden. Hiding them would be a second lie: they
 * exist and he knows the cars. Marked, `T4` reading 100% is visibly 4-of-4 and he can disregard it
 * himself — which is the whole difference between a number that informs and one that alarms.
 */
export function damageByClass(
  fleet: readonly { rentalClass: string | null }[],
  hitByClass: Readonly<Record<string, number>>,
): ClassDamage[] {
  const total = new Map<string, number>();
  for (const v of fleet) {
    if (!v.rentalClass) continue;                 // an unclassed car belongs to no class's denominator
    total.set(v.rentalClass, (total.get(v.rentalClass) ?? 0) + 1);
  }
  return [...total.entries()]
    .map(([rentalClass, f]) => {
      const hit = hitByClass[rentalClass] ?? 0;
      return { rentalClass, fleet: f, hit, share: f ? hit / f : 0, thin: f < THIN_CLASS_FLEET };
    })
    // Thin classes sink below the real ones regardless of share — a 100% anecdote must not head a
    // list sorted by share, because position reads as importance before the marker does.
    .sort((a, b) => Number(a.thin) - Number(b.thin) || b.share - a.share);
}

// ── 3 · what FG has met on shift ────────────────────────────────────────────────────────────────

export interface SeenSpread { times: number; cars: number; capped: boolean }

/**
 * How many cars have been seen once, twice, three times…
 *
 * The tail is capped so a single outlier cannot stretch the axis flat; `capped` marks the bucket
 * that means "this many or more" so the label can say so rather than implying an exact count.
 */
export function seenSpread(perCar: readonly number[], cap = 5): SeenSpread[] {
  const buckets = new Map<number, number>();
  for (const n of perCar) {
    if (n < 1) continue;
    const b = Math.min(n, cap);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([times, cars]) => ({ times, cars, capped: times === cap }));
}

export interface ClassCoverage {
  rentalClass: string; fleet: number; met: number; share: number; perCar: number;
}

/**
 * How much of each class FG has met, and how often it meets one when it does.
 *
 * ⭐ `perCar` is sightings-per-MET-car, not per fleet car. Dividing by the whole class would blend
 * "we see these constantly" with "we have not met most of them yet" into one flat number that means
 * neither. He asked the two questions separately — *"so all 3 H4's i've seen how many times do i see
 * them? and each of the other classes"* — so they stay two columns.
 */
export function classCoverage(
  fleet: readonly { rentalClass: string | null }[],
  sightingsByClass: Readonly<Record<string, { met: number; sightings: number }>>,
): ClassCoverage[] {
  const total = new Map<string, number>();
  for (const v of fleet) {
    if (!v.rentalClass) continue;
    total.set(v.rentalClass, (total.get(v.rentalClass) ?? 0) + 1);
  }
  return [...total.entries()]
    .map(([rentalClass, f]) => {
      const s = sightingsByClass[rentalClass] ?? { met: 0, sightings: 0 };
      return {
        rentalClass, fleet: f, met: s.met,
        share: f ? s.met / f : 0,
        perCar: s.met ? s.sightings / s.met : 0,
      };
    })
    .sort((a, b) => b.share - a.share || b.fleet - a.fleet);
}

// ── 4 · where this is going ─────────────────────────────────────────────────────────────────────

export interface Projection { label: string; sightings: number; cars: number; multiple: number }

/**
 * ⚠️⚠️ A FORECAST MUST NOT LOOK LIKE A MEASUREMENT. This returns rounded, deliberately coarse
 * numbers, and the surface draws them dashed and labelled — the design decision is not decoration.
 *
 * Straight-line from the observed rate, which is honest about being naive: it assumes the days keep
 * looking like the days so far. Coverage saturates at the fleet size (FG cannot meet a car twice for
 * the first time), so the interesting quantity flips over time — early on it is *how much* of the
 * fleet has been met, and once that approaches the whole fleet the only thing left moving is *how
 * often*, which is the measurement he actually wants. This card exists to say that the flat 1.x
 * multiple is day one of a curve, not a finding.
 */
export function projectSightings(
  observed: { days: number; sightings: number; cars: number },
  fleetSize: number,
  horizons: readonly { label: string; days: number }[],
): Projection[] {
  if (observed.days <= 0 || fleetSize <= 0) return [];
  const perDay = observed.sightings / observed.days;
  return horizons.map(h => {
    const sightings = Math.round((perDay * h.days) / 10) * 10;
    // ⚠️⚠️ COVERAGE SATURATES — DO NOT PROJECT IT STRAIGHT-LINE. A linear cars-per-day carried
    // forward claims FG will meet cars it has already met, so the distinct count runs away and the
    // sightings-per-car multiple comes out FLAT — which contradicts the one thing this card exists
    // to say. Caught on the render, 2026-09-06: a month out read "~705 cars · 1.7×", identical to
    // today, because both halves had grown together.
    //
    // Expected distinct after n roughly-uniform draws from N cars: N(1 − (1 − 1/N)ⁿ).
    // ⚠️ Uniform is WRONG in a knowable direction — a fleet has workhorses that repeat, so real
    // coverage grows SLOWER than this. That makes the cars figure an UPPER bound and the multiple a
    // LOWER one, which is the safe way round for a number he might plan against.
    // ⚠️ Clamp AFTER rounding, not before — rounding to the nearest 5 pushed a saturated 762.6 up
    // to 765 on a fleet of 763. A projection that exceeds the thing it saturates against is the one
    // number on this card nobody would forgive.
    const cars = Math.min(
      fleetSize,
      Math.round((fleetSize * (1 - Math.pow(1 - 1 / fleetSize, sightings))) / 5) * 5,
    );
    return { label: h.label, sightings, cars, multiple: cars ? sightings / cars : 0 };
  });
}
