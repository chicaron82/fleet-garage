// Reading the vehicle change log back out — see migrations/118.
//
// The trail exists because /reflect 58 tried to audit a bad write and couldn't: a verify stub of
// mine had put invented data into a real car, and the best answer FG could give was "I think I only
// touched that one row." The DB now records what changed; this file turns that into something a
// person reads at a glance.
//
// ⚠️ THE LOG NEVER NAMES WHO. FG writes with the anon key under allow-all RLS, so no trigger can
// honestly attribute a change. Nothing here should invent an actor, imply one, or phrase a line as
// though somebody did it — the trail answers WHAT and WHEN, and stays silent on WHO on purpose.

export interface VehicleChangeRow {
  changedAt: string;                 // ISO
  op: 'UPDATE' | 'DELETE';
  changed: Record<string, unknown>;  // UPDATE: { col: {from,to} }. DELETE: the whole row.
}

export interface ChangeLine {
  field: string;
  label: string;
  from: string;
  to: string;
}

/** FG's own vocabulary for the columns, so the log reads like the app and not like the schema. */
const LABELS: Record<string, string> = {
  unit_number: 'Unit number',
  license_plate: 'Plate',
  make: 'Make',
  model: 'Model',
  year: 'Year',
  color: 'Colour',
  status: 'Status',
  rental_class: 'Class',
  key_count: 'Keys',
  owning_area: 'Owning',
  branch_id: 'Branch',
  archived_at: 'Archived',
  cover_photo_url: 'Cover photo',
  keytag_photo_url: 'Key tag photo',
  is_tesla: 'Tesla',
  is_hybrid: 'Hybrid',
  has_mobile_cable: 'Mobile cable',
  has_j1772_adapter: 'J1772 adapter',
  field_sources: 'Field sources',
};

// Columns whose churn says nothing about the CAR. Editing an edit-suggestion or bumping an EV
// timestamp is workflow noise, and a log where every real change is buried under bookkeeping is a
// log nobody opens twice. Nothing is hidden that could change what the car IS.
const NOISE = new Set([
  'id', 'created_at', 'updated_at',
  'edit_suggested_unit', 'edit_suggested_plate', 'edit_suggested_by', 'edit_suggested_at',
  'edit_suggestion_note', 'edit_status', 'edit_reviewed_by', 'edit_reviewed_at',
  'ev_last_updated_by', 'ev_last_updated_at', 'archived_by_id',
]);

export function fieldLabel(column: string): string {
  if (LABELS[column]) return LABELS[column];
  // An unmapped column still gets a readable line rather than being dropped — a column added later
  // must show up in the trail on the day it's added, not on the day someone remembers this map.
  const words = column.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One stored value, as a person reads it. Empty and null are the same thing to an operator. */
export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

/**
 * The readable lines for one logged change.
 *
 * A DELETE stores the whole row rather than a diff (there is nothing left to diff against), so it
 * renders as the row's identifying fields going to nothing — never as an empty change.
 */
export function changeLines(row: VehicleChangeRow): ChangeLine[] {
  const out: ChangeLine[] = [];
  for (const [field, value] of Object.entries(row.changed)) {
    if (NOISE.has(field)) continue;
    if (row.op === 'DELETE') {
      out.push({ field, label: fieldLabel(field), from: formatValue(value), to: '—' });
      continue;
    }
    // A malformed diff (hand-written row, a future trigger change) must not throw inside a render.
    const pair = value as { from?: unknown; to?: unknown } | null;
    if (!pair || typeof pair !== 'object') continue;
    out.push({ field, label: fieldLabel(field), from: formatValue(pair.from), to: formatValue(pair.to) });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * When it happened, precise enough to scope an incident.
 *
 * Deliberately NOT the coarse phrasing used for sightings ("3 days ago"). That wording exists to
 * prompt a question about a car; this one exists to answer "what changed in that window", and a
 * window needs a time of day.
 */
export function describeChangeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'unknown time';
  // ⚠️ Formatted by hand rather than via toLocaleTimeString: that reads the DEVICE locale, and it
  // rendered "22:55" on the verify run. Aaron reads times as AM/PM — we converted nanays to 12-hour
  // this same evening for exactly that reason — so a log that quietly shows 24-hour on one phone
  // and 12-hour on another is both inconsistent with him and unpredictable.
  const h24 = then.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const clock = `${h12}:${String(then.getMinutes()).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(then, now)) return `today ${clock}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(then, yesterday)) return `yesterday ${clock}`;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${MONTHS[then.getMonth()]} ${then.getDate()}, ${clock}`;
}

/** The collapsed header — how many changes this car's record has actually accumulated. */
export function changeCountLabel(rows: readonly VehicleChangeRow[]): string {
  const n = rows.length;
  if (n === 0) return 'No record changes logged';
  return n === 1 ? '1 record change' : `${n} record changes`;
}
