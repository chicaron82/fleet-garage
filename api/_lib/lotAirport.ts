// Lot Lookout, airport: what one reading tap does to the lot_airport row, pure, so api/lot.ts stays a thin writer and
// the rules are tested without a database. (Migration 157; docs/ticket-lot-lookout-swatches-too-many-targets.md.)
//
// His design, 2026-10-18: two five-notch readings and an aisle flag in place of 63 stalls × 3 swatches. *"notches are
// fine, scrap the stale time and stall map"*.
//
// ⭐ NEWER WINS, BY THE PHONE'S CLOCK. A tap made with no signal (the parkade) waits on the phone and arrives later
// (docs/ticket-lot-lookout-taps-wait-for-signal.md). It carries `at`, the moment the finger hit the glass. The row
// takes it only if it is newer than the reading already there, so a phone that comes back into signal ten minutes
// late can never overwrite what another driver read five minutes ago. It is still logged, with applied = false.

export type AirportField = 'cleans' | 'returns' | 'aisle';
export const AIRPORT_FIELDS: readonly AirportField[] = ['cleans', 'returns', 'aisle'];

/** The notches run 0..4 (cleans 0 Empty..4 Full, returns 0 Packed..4 Clear); the aisle is 0 clear, 1 cars in it. */
export const NOTCH_MAX = 4;

/** A queued tap older than this is refused rather than written: a reading from last shift is not a reading. */
export const READING_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface AirportRequest { action: 'reading'; field: AirportField; value: number; at: string; by: string }

export interface AirportRow {
  cleans: number | null; cleans_at: string | null;
  returns: number | null; returns_at: string | null;
  aisle: boolean; aisle_at: string | null;
}

export interface AirportChange {
  /** null = a fresher reading is already on the row; nothing to write. */
  patch: Record<string, string | number | boolean> | null;
  tap: { field: AirportField; value: number; prev: number | null; tapped_by: string; tapped_at: string; applied: boolean };
}

const isField = (v: unknown): v is AirportField => typeof v === 'string' && (AIRPORT_FIELDS as readonly string[]).includes(v);

/** The body's reading, checked. `at` missing means "now"; a phone clock running ahead is pulled back to now. */
export function parseReading(b: Record<string, unknown>, by: string, nowMs: number): AirportRequest | { error: string } {
  if (!isField(b.field)) return { error: 'Not a reading on the airport page.' };
  const max = b.field === 'aisle' ? 1 : NOTCH_MAX;
  const v = b.value;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > max) return { error: 'That notch is not on the page.' };
  let atMs = nowMs;
  if (b.at != null) {
    const t = typeof b.at === 'string' ? Date.parse(b.at) : NaN;
    if (Number.isNaN(t)) return { error: 'That tap has no time on it.' };
    if (nowMs - t > READING_MAX_AGE_MS) return { error: 'That tap is more than 12 hours old, so it was not saved.' };
    atMs = Math.min(t, nowMs);
  }
  return { action: 'reading', field: b.field, value: v, at: new Date(atMs).toISOString(), by };
}

const prevOf = (row: AirportRow, field: AirportField): number | null =>
  field === 'aisle' ? (row.aisle ? 1 : 0) : row[field];

/** Apply only if newer than what the row holds for that field (or the field was never read). */
export function readingChange(row: AirportRow, req: AirportRequest): AirportChange {
  const heldAt = row[`${req.field}_at`];
  const applied = heldAt == null || Date.parse(req.at) > Date.parse(heldAt);
  const value = req.field === 'aisle' ? req.value === 1 : req.value;
  return {
    patch: applied ? { [req.field]: value, [`${req.field}_by`]: req.by, [`${req.field}_at`]: req.at } : null,
    tap: { field: req.field, value: req.value, prev: prevOf(row, req.field), tapped_by: req.by, tapped_at: req.at, applied },
  };
}

/** The same newer-wins rule as a PostgREST filter, for the UPDATE itself (api/lot.ts). Checking only the row read first
 *  leaves a gap: two phones read the same old row, both decide they are newer, and the older write can land last.
 *  With this on the update, the database refuses a write that is no longer newer. (Line-check, 2026-10-18.)
 *  The time is quoted because `.` and `:` are reserved inside PostgREST's or(). */
export function newerThanHeld(field: AirportField, at: string): string {
  return `${field}_at.is.null,${field}_at.lt."${at}"`;
}
