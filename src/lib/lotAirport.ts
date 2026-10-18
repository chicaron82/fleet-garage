// Lot Lookout, airport: the two readings and the aisle flag (migration 157), pure. Server rules in api/_lib/lotAirport.ts.
//
// ⭐ His design, 2026-10-18 11:35, in place of the stall board: *"room for clean, they'd rate from 0 to ~full cleans
// (gradient red to green) / returns, packed to 0 (same gradient) / and a tap if vehicles parked in the aisle"*. And why
// (11:39): *"to make the call from the bay if i should pull the VSA's personally to move cars before management decides
// to do it when its inconvenient"*. Drivers read what they see (how full of cleans); the bay reads it as ROOM.
// Rulings over the mock (11:54): *"notches are fine, scrap the stale time and stall map"*. So no reading ever fades:
// its age is shown where it is read in full, never as a colour.
//
// ⭐ THE QUEUE (docs/ticket-lot-lookout-taps-wait-for-signal.md). His parkade test, 10-15: *"my cell connection at the
// parkade was atrocious"*. A tap that cannot send stays on the phone with the time it was made. Only the LATEST tap per
// reading matters, so the queue holds at most one entry per field, and the server keeps whichever is newest.

export type AirportField = 'cleans' | 'returns' | 'aisle';
export type Notch = 0 | 1 | 2 | 3 | 4;

/** What a driver sees on the lot, left (red) to right (green). */
export const CLEANS_NOTCHES = ['Empty', 'Low', 'Half', 'Most', 'Full'] as const;
export const RETURNS_NOTCHES = ['Packed', 'Lots', 'Some', 'Few', 'Clear'] as const;

/** What the bay reads from the same notch. Cleans read as ROOM: Empty of cleans is lots of room to send more. */
export const ROOM_TEXT = ['Lots of room for cleans', 'Room for cleans', 'Some room for cleans', 'A little room for cleans', 'No room for cleans'] as const;
export const RETURNS_TEXT = ['Returns packed', 'Lots of returns', 'Some returns', 'A few returns', 'Returns clear'] as const;

/** One colour per notch, red → green, each a different lightness too (so it isn't hue alone). */
export const NOTCH_HEX = ['#b91c1c', '#c2410c', '#a16207', '#4d7c0f', '#15803d'] as const;

export interface AirportReadings {
  cleans: Notch | null; cleansBy: string | null; cleansAt: string | null;
  returns: Notch | null; returnsBy: string | null; returnsAt: string | null;
  aisle: boolean; aisleBy: string | null; aisleAt: string | null;
}

export const EMPTY_READINGS: AirportReadings = {
  cleans: null, cleansBy: null, cleansAt: null,
  returns: null, returnsBy: null, returnsAt: null,
  aisle: false, aisleBy: null, aisleAt: null,
};

const notchOf = (v: unknown): Notch | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4 ? v as Notch : null);

export interface AirportRowShape {
  cleans: number | null; cleans_by: string | null; cleans_at: string | null;
  returns: number | null; returns_by: string | null; returns_at: string | null;
  aisle: boolean; aisle_by: string | null; aisle_at: string | null;
}

/** A database row → the readings. A value off the scale reads as "never read", never as a guess. */
export function readingsFromRow(r: AirportRowShape): AirportReadings {
  return {
    cleans: notchOf(r.cleans), cleansBy: r.cleans_by, cleansAt: r.cleans_at,
    returns: notchOf(r.returns), returnsBy: r.returns_by, returnsAt: r.returns_at,
    aisle: r.aisle === true, aisleBy: r.aisle_by, aisleAt: r.aisle_at,
  };
}

/** One tap waiting to be sent: the field, the notch (aisle 0/1) and when the finger hit the glass. */
export interface QueuedReading { field: AirportField; value: number; at: string }

/** Add a tap. The queue keeps one entry per field: the newest. An older tap for a field already queued is dropped. */
export function enqueueReading(queue: readonly QueuedReading[], tap: QueuedReading): QueuedReading[] {
  const held = queue.find(q => q.field === tap.field);
  if (held && Date.parse(held.at) >= Date.parse(tap.at)) return [...queue];
  return [...queue.filter(q => q.field !== tap.field), tap];
}

/** Remove a tap the server has answered, but only if it is still the one queued (a newer tap may have replaced it). */
export function settleReading(queue: readonly QueuedReading[], sent: QueuedReading): QueuedReading[] {
  return queue.filter(q => !(q.field === sent.field && q.at === sent.at));
}

/** Show a tap at once, before it reaches anyone: the tapper sees it land even with no signal. */
export function applyReading(r: AirportReadings, tap: QueuedReading, by: string): AirportReadings {
  if (tap.field === 'aisle') return { ...r, aisle: tap.value === 1, aisleBy: by, aisleAt: tap.at };
  const v = notchOf(tap.value);
  return tap.field === 'cleans'
    ? { ...r, cleans: v, cleansBy: by, cleansAt: tap.at }
    : { ...r, returns: v, returnsBy: by, returnsAt: tap.at };
}

const AT_OF: Record<AirportField, 'cleansAt' | 'returnsAt' | 'aisleAt'> = { cleans: 'cleansAt', returns: 'returnsAt', aisle: 'aisleAt' };

/** What this phone shows: the live row, with each waiting tap laid over it if it is newer than what the row holds.
 *  So a tap made with no signal stays on screen, and a fresher reading from another phone is never hidden by it. */
export function withQueued(r: AirportReadings, queue: readonly QueuedReading[], by: string): AirportReadings {
  return queue.reduce((acc, q) => {
    const held = acc[AT_OF[q.field]];
    return held == null || Date.parse(q.at) > Date.parse(held) ? applyReading(acc, q, by) : acc;
  }, r);
}

/** A queue read back from the phone: anything malformed is dropped rather than sent. */
export function parseQueue(raw: string | null): QueuedReading[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(v)) return [];
    return v.filter((q): q is QueuedReading =>
      !!q && typeof q === 'object'
      && ['cleans', 'returns', 'aisle'].includes((q as QueuedReading).field)
      && Number.isInteger((q as QueuedReading).value)
      && typeof (q as QueuedReading).at === 'string' && !Number.isNaN(Date.parse((q as QueuedReading).at)));
  } catch {
    return [];
  }
}
