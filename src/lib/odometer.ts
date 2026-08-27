// The odometer as a fact with an age (migrations/123).
//
// The flip already collects this number on every return; until now FG spent it on the counter
// copy-out and discarded it. Keeping it costs nothing — but a stored reading is only half a fact.
//
// ⭐ A KILOMETRE READING IS A CLAIM ABOUT A MOMENT. "47,200 km" from April describes a car that has
// since done a summer of rentals, and rendering it bare invites a decision on a stale number — the
// airport asks "do we have a HIGH-KM out-of-province car?", and answering from a four-month-old
// figure is worse than saying "I don't know". So the reading and its date travel together, always.

/** Latest wins — an odometer only moves forward, so the newest reading is the best one.
 *  ⚠️ Opposite of classCodeWrite's first-good-read-wins, and deliberately: a class code never
 *  changes (so a later scan must not clobber a good value), while an odometer always does. */
export function shouldReplaceOdometer(stored: number | null | undefined, incoming: number): boolean {
  if (!Number.isFinite(incoming) || incoming <= 0) return false;
  if (stored === null || stored === undefined) return true;
  // A LOWER number arriving later is not a fact — it is a misread, a transposition, or the wrong
  // car. Refusing it costs one skipped update; accepting it silently rewrites a good record.
  return incoming > stored;
}

/** Parse what he typed on the flip. Accepts "47200", "47,200", " 47 200 " — rejects anything else. */
export function parseOdometer(raw: string | null | undefined): number | null {
  const digits = (raw ?? '').replace(/[\s,]/g, '');
  if (!/^\d{1,7}$/.test(digits)) return null;
  const n = Number(digits);
  return n > 0 ? n : null;
}

/** How stale is this reading? Coarse on purpose — the point is "can I trust it", not precision. */
export function describeOdometerAge(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${MONTHS[then.getMonth()]} ${then.getDate()}`;
}

/** What a car's dash reads in. FG assumed `km` everywhere until a Florida Jeep turned up from Fargo
 *  on 2026-08-27 reading 23,175 MILES.
 *
 *  ⚠️ NOTHING IS EVER CONVERTED. Aaron: *"no conversion. but example for this it would show x miles
 *  instead of x km."* The stored number is what he typed off that dash; this only says which unit it
 *  is in. A round-trip through km loses precision and hands back a figure he never read — a small lie
 *  in the one field whose whole job is recording an observation. */
export type OdometerUnit = 'km' | 'mi';

/** A US-plated car reads miles. One flag, because a US dash has never been anything else. */
export function odometerUnitFor(isUs?: boolean | null): OdometerUnit {
  return isUs ? 'mi' : 'km';
}

/**
 * The one string every surface should render. Never the number alone.
 *
 * "47,200 km · Aug 12"  — a fact and its age, in the width of a chip.
 */
export function describeOdometer(
  km: number | null | undefined,
  at: string | null | undefined,
  /** ⚠️ INJECTABLE, and it has to be. Without this the function reads the real clock, which makes it
   *  untestable deterministically — a test written today passes today and fails tomorrow. That is
   *  exactly how this shipped: the gate was green at 22:23 CDT and CI failed at 03:33 UTC, the same
   *  instant on the next calendar day, because "8d ago" had become "9d ago" (2026-08-20).
   *  Every sibling formatter in FG already takes `now` — describeLastSeen, describeChangeTime,
   *  describeOdometerAge below. This one silently didn't, and the inconsistency was the bug. */
  now: Date = new Date(),
  /** ⚠️ Defaults to km so every existing caller keeps its exact behaviour — the fleet is Canadian and
   *  one Jeep is not a reason to make 700 call sites think about units. */
  unit: OdometerUnit = 'km',
): string {
  if (km === null || km === undefined || km <= 0) return '';
  const pretty = km.toLocaleString('en-CA');
  const age = describeOdometerAge(at, now);
  return age ? `${pretty} ${unit} · ${age}` : `${pretty} ${unit}`;
}
