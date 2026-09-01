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

/**
 * What an incoming reading IS, relative to what is on file — so the control and the write agree on
 * one vocabulary instead of each re-deriving it from comparisons.
 *
 * ⭐ 'lower' is deliberately NOT called 'invalid'. It is the one case with two entirely different
 * causes and no way to tell them apart from the number: a MISREAD (wrong car, transposed digits —
 * overwhelmingly the common one, and what the guard is genuinely good at catching) or a
 * CORRECTION (what is on file was wrong). The classification names the situation and refuses to
 * decide which; the surface asks him.
 */
export type OdometerEntry = 'invalid' | 'first' | 'forward' | 'same' | 'lower';

export function classifyOdometerEntry(
  stored: number | null | undefined,
  incoming: number | null,
): OdometerEntry {
  if (incoming === null || !Number.isFinite(incoming) || incoming <= 0) return 'invalid';
  if (stored === null || stored === undefined) return 'first';
  if (incoming > stored) return 'forward';
  if (incoming === stored) return 'same';
  return 'lower';
}

/**
 * ⚠️⚠️ HIGHER IS NOT THE SAME AS PLAUSIBLE — the half `shouldReplaceOdometer` was missing.
 *
 * Found 2026-08-31, reading a night's gas-pump cards into FG off six photographs. Two readings
 * passed the forward-only guard and were about to be written:
 *
 *   LUR304  FG had 42,842 read THAT DAY  · my read 92,249  → +49,407 in one day
 *   LZM509  FG had  7,784 read THAT DAY  · my read 14,224  → + 6,440 in one day
 *
 * Both are strictly greater, so the rule above waved them through. Neither is a thing a car can do.
 * What caught them was not the number — it was **when the stored reading was taken**, and I only
 * looked because the jump felt wrong. A feeling is not a guard.
 *
 * ⚠️ WARNS, NEVER BLOCKS, and the reason is on the fleet: MCM563 was plated on Aug 27 and read
 * **3,154 km four days later** — 787 km/day, confirmed by Aaron, on a car with delivery plastic
 * still in it. A rule tight enough to call that wrong is worse than no rule. The threshold is set
 * where a reading stops being *fast* and starts being *impossible*, and even then it reports.
 *
 * ⚠️ AND IT IS SILENT WITHOUT A DATE. A stored reading with no `odometer_at` gives nothing to
 * divide by; guessing an age would manufacture the very confidence this exists to withhold.
 */
export interface OdometerJump {
  delta: number;
  days: number;
  perDay: number;
  detail: string;
}

/** Above this, a daily average stops being a hard-driven rental and starts being a misread. Sustained
 *  road-trip driving tops out near 1,000-1,200 km/day; the fleet's own confirmed maximum is 787. */
const IMPLAUSIBLE_KM_PER_DAY = 1500;

/**
 * ⚠️⚠️ AND IT IS BLIND TO A CAR'S FIRST READING — named here because the blindness looks like
 * coverage. Aaron, 2026-09-01: `LFJ180` was entered at **34,028 km** off a gas sheet when the dash
 * said **28,921** — someone read the TRIP METER (3402.8) and wrote it without the decimal. This
 * function could not fire, correctly: `stored` was null, and a first reading has nothing to be
 * implausible against.
 *
 * ⭐ That is exactly the wrong moment to be undefended. A car gets its first reading precisely when
 * it is being read off a SHEET rather than a DASH — a backfill, a gas-card transcription — which is
 * where transcription errors live. There is no fix inside this function; the answer is that a wrong
 * first reading must be CORRECTABLE (see `classifyOdometerEntry` 'lower' and `makeCorrectOdometer`),
 * not that the guard should invent a baseline it does not have.
 */
export function checkOdometerJump(
  incoming: number,
  stored: number | null | undefined,
  storedAt: string | null | undefined,
  now: Date = new Date(),
): OdometerJump | null {
  if (!Number.isFinite(incoming) || stored === null || stored === undefined) return null;
  if (incoming <= stored) return null;              // the forward-only rule already owns this case
  if (!storedAt) return null;                       // no date → nothing to divide by → say nothing
  const then = new Date(storedAt);
  if (Number.isNaN(then.getTime())) return null;

  const delta = incoming - stored;
  // ⚠️ A FLOOR OF ONE DAY, not the true elapsed hours. Two readings an hour apart would divide by
  // ~0.04 and call any change at all impossible — and a car genuinely can be driven between a
  // morning flip and an afternoon one. Same-day means "today", and today's ceiling is one day's.
  const days = Math.max(1, (now.getTime() - then.getTime()) / 86_400_000);
  const perDay = delta / days;
  if (perDay <= IMPLAUSIBLE_KM_PER_DAY) return null;

  const when = days < 1.5 ? 'the same day' : `${Math.round(days)} days`;
  return {
    delta, days, perDay,
    detail: `+${delta.toLocaleString('en-CA')} km in ${when} — about `
      + `${Math.round(perDay).toLocaleString('en-CA')} km a day. Worth a second look at the number.`,
  };
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
