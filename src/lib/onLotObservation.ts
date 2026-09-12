// Is this held car still on the lot? — a recorded observation with a date (migrations/142).
//
// ⭐ Aaron, 2026-09-12: *"what do you think of having a checkbox for damages FG holds. actual holds
// being held, not ones that are out on exception. if it's present on the lot tick the box. else
// unchecked its either been rented out between my shifts or sent to the bodyshop"*
//
// ⚠️⚠️ FG CANNOT DERIVE THIS, AND THAT IS THE POINT. He is its only writer and writes when a car
// reaches him on shift, so an ACTIVE hold means *"the last time I saw it, it was held"* — never
// *"it has been held continuously since"*. LUR527: hail-flagged Sep 2, released for rent with no
// release ever logged (the counter releases cars; the counter does not use FG), driven 291 km, back
// on the 8th. The only trace was the odometer moving under an active hold. A duration from
// `flagged_at` would have told a manager "held 9 days" about a car that spent part of that week out
// earning. So this module stores what he SAW, and refuses to imply anything he didn't.

/** What he last observed about the car's presence. Both null = nobody has looked. */
export interface OnLotObservation {
  present: boolean | null;
  /** ISO instant of the observation. */
  checkedAt: string | null;
}

export type OnLotState = 'unchecked' | 'present' | 'absent';

/**
 * ⚠️ THREE STATES, NOT TWO, and the third is the one that matters. Aaron asked for the negative case
 * to be recordable — *"if its gone one day, then i uncheck the box"* — because **"I checked and it
 * was gone" is information and "nobody has checked" is not.** A single boolean, or a lone timestamp,
 * collapses those two into one indistinguishable blank.
 */
export function onLotState(o: OnLotObservation): OnLotState {
  if (o.present === null || o.present === undefined || !o.checkedAt) return 'unchecked';
  return o.present ? 'present' : 'absent';
}

/** Short local date for the stamp — "Sep 10". Built from parts, never from a UTC slice. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(d);
}

/**
 * The line the record shows.
 *
 * ⚠️⚠️ NOTHING HERE MAY SAY "GONE". Unchecked means NOT CONFIRMED, and the three real explanations —
 * out on rent, at the bodyshop, or simply not looked at yet — are indistinguishable from FG's side
 * (Aaron: *"i won't know until i see it again"*). Even `absent` is phrased as what he observed, not
 * as a conclusion about where the car is.
 *
 * ⭐ The DATE rides along, always. Aaron chose a date over any stale-styling rule: a tick with no
 * date rots — ticked three weeks ago reads identically to ticked this morning — and how long is too
 * long depends on the car, which is his call to make and not FG's to colour in.
 */
export function onLotLabel(o: OnLotObservation): string {
  const state = onLotState(o);
  if (state === 'unchecked') return 'Not checked';
  const when = shortDate(o.checkedAt!);
  return state === 'present'
    ? `On the lot · checked ${when}`
    : `Not on the lot when checked ${when}`;
}

/**
 * Does this car get the control at all?
 *
 * ⭐ His scope, verbatim: *"actual holds being held, not ones that are out on exception."* A car out
 * on exception is EXPECTED to be away, so its presence is not a question worth asking — and a
 * pre-existing or sale car has been released back to rent, so it is not being held either. Only a
 * car FG believes is held on the lot can be confirmed to be on it.
 */
export function offersOnLotCheck(vehicleStatus: string | null | undefined): boolean {
  return vehicleStatus === 'HELD';
}

/** The write a tap produces: the flip, stamped with the moment it was observed. */
export function nextOnLotObservation(current: OnLotObservation, now: Date = new Date()): OnLotObservation {
  // ⚠️ An UNCHECKED car ticks to PRESENT (he is standing in front of it). From present it flips to
  // absent, and from absent back to present — each flip is a NEW observation, never an edit of the
  // old one, which is why the timestamp always moves.
  const state = onLotState(current);
  return { present: state !== 'present', checkedAt: now.toISOString() };
}
