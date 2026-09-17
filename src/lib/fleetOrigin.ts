// What's in our fleet, by origin — local vs. converted vs. everywhere else.
//
// Aaron, 2026-09-16: *"What's in our fleet broken down first by what's local (both owning and plate
// match MB). Then list what we have from each province and what classes each province has."*
// Shaped over one night of his corrections — see docs/ticket-fleet-by-origin.md for the whole trail.
//
// ⭐⭐ THREE RULES THIS FILE HOLDS, each one his:
//   1. LOCAL IS A COMPOUND TEST — Manitoba plate AND Winnipeg owning. The two axes move independently
//      (a plate is a receipt from the last branch that re-plated the car), so either alone lies.
//   2. A DISAGREEMENT IS A CONVERSION, NOT AN ERROR — his word. *"our fleet needed teslas, so we
//      converted a bunch of them to wear MB plates. the rest were low km at the time that drove here
//      via one way."* It has a direction: converted HERE (our plates, their books) or AWAY (our car,
//      their plates — XT193P went to Vancouver and stayed).
//   3. OLDER AND NEWER OWNING NUMBERS ARE ONE CITY — *"winnipeg 8199 and winnipeg 8999 are still
//      winnipeg."* Grouped through `owningCity()`, which reads the confirmed KNOWN map and nothing else.
//
// ⚠️ "MANITOBA PLATE" MEANS A KNOWN MB FLEET PREFIX, not a plate SHAPE. Halifax issues the same
// AAA999 shape Manitoba does (HFE872, HMT717, HNM262), so a regex would call three Halifax cars local.
// ⚠️ The Tesla / one-way split of "converted here" is by MAKE — it describes the two groups he named,
// and would mislabel a non-Tesla converted out of need. The card copy speaks about the group.
//
// Pure: no DB, no React.
import { MB_PLATE_PREFIXES } from '../../api/_lib/platePrefix';
import { normalizeOwning, owningCity } from '../../api/_lib/owningArea';
import { liveFleet } from './fleetHistory';

export interface OriginVehicle {
  id: string;
  licensePlate: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  rentalClass?: string | null;
  owningArea?: string | null;
  isUs?: boolean;
  archivedAt?: string | null;
  unitNumber?: string | null;
}

export interface OriginCity {
  city: string;
  /** Owning numbers folded into this city, commonest first. */
  codes: string[];
  count: number;
  /** Cars owned here that wear a Manitoba fleet plate. */
  mbPlated: number;
  /** Rental classes, commonest first. A car with no class counts as 'no class', never dropped. */
  classes: [string, number][];
}

export interface FleetOrigin {
  live: number;
  local: number;
  /** Owned elsewhere AND on another province's plates — ordinary out-of-province cars. */
  foreignOwned: number;
  convertedHere: { teslas: OriginVehicle[]; oneWays: OriginVehicle[] };
  convertedAway: OriginVehicle[];
  /** No owning area recorded. Self-hides in the UI at zero. */
  unknown: OriginVehicle[];
  cities: OriginCity[];
}

const MB = new Set<string>(MB_PLATE_PREFIXES);
export const isManitobaFleetPlate = (plate: string | null | undefined): boolean =>
  MB.has((plate ?? '').trim().slice(0, 3).toUpperCase());

/** City for grouping: the confirmed name, else "US" for a US car, else the bare number. */
function cityOf(v: OriginVehicle): string | null {
  const code = normalizeOwning(v.owningArea);
  if (!code) return null;
  return owningCity(code) ?? (v.isUs ? 'US' : code);
}

const byPlate = (a: OriginVehicle, b: OriginVehicle) => a.licensePlate.localeCompare(b.licensePlate);

export function fleetOrigin(vehicles: readonly OriginVehicle[]): FleetOrigin {
  const live = liveFleet(vehicles);
  let local = 0, foreignOwned = 0;
  const teslas: OriginVehicle[] = [], oneWays: OriginVehicle[] = [], away: OriginVehicle[] = [], unknown: OriginVehicle[] = [];
  const cities = new Map<string, { codes: Map<string, number>; count: number; mbPlated: number; classes: Map<string, number> }>();

  for (const v of live) {
    const city = cityOf(v);
    const mb = isManitobaFleetPlate(v.licensePlate);
    if (!city) { unknown.push(v); continue; }

    const winnipeg = city === 'Winnipeg';
    if (mb && winnipeg) local += 1;
    else if (mb) (/tesla/i.test(v.make ?? '') ? teslas : oneWays).push(v);
    else if (winnipeg) away.push(v);
    else foreignOwned += 1;

    const e = cities.get(city) ?? { codes: new Map(), count: 0, mbPlated: 0, classes: new Map() };
    const code = normalizeOwning(v.owningArea);
    e.codes.set(code, (e.codes.get(code) ?? 0) + 1);
    e.count += 1;
    if (mb) e.mbPlated += 1;
    const cls = (v.rentalClass ?? '').trim() || 'no class';
    e.classes.set(cls, (e.classes.get(cls) ?? 0) + 1);
    cities.set(city, e);
  }

  const desc = <K,>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return {
    live: live.length,
    local,
    foreignOwned,
    convertedHere: { teslas: teslas.sort(byPlate), oneWays: oneWays.sort(byPlate) },
    convertedAway: away.sort(byPlate),
    unknown: unknown.sort(byPlate),
    cities: [...cities.entries()]
      .map(([city, e]) => ({
        city,
        codes: desc(e.codes).map(([c]) => c),
        count: e.count,
        mbPlated: e.mbPlated,
        classes: desc(e.classes) as [string, number][],
      }))
      .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)),
  };
}
