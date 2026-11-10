// A past gas sheet, written to ITS day (migration 168, docs/ticket-odometer-history-and-past-gas-sheet.md). Aaron,
// 2026-11-09: *"I select a date and whatever I enter would write to that date"*.
// Pure: the sheet day's instants, which car a typed plate or unit is, and what each row says back.
//
// ⚠️ The day's instants are computed HERE, in the browser, through Intl's America/Winnipeg rules, and handed to the
// database: FG's Postgres has old tz tables (Manitoba kept UTC−5 from 2026-11-01) and would put the day an hour off.
import { normalizePlate } from './vehicleByPlate';
import type { Vehicle } from '../types';

const ZONE = 'America/Winnipeg';
const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const DAY_LABEL = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, weekday: 'short', month: 'short', day: 'numeric' });

/** How far Winnipeg's wall clock is ahead of UTC at this instant (negative: behind). */
function offsetMs(utcMs: number): number {
  const p = Object.fromEntries(PARTS.formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!) - utcMs;
}

/** The instant Winnipeg's clock reads `hour`:00 on `day` (YYYY-MM-DD). */
export function winnipegInstant(day: string, hour: number): string {
  const [y, m, d] = day.split('-').map(Number);
  // One pass is exact for the only hours used, midnight and noon. The offset is probed at the wall time read as UTC,
  // which lands on the same side of a 02:00 clock change as the instant wanted (the evening before, for midnight; that
  // morning after 02:00, for noon). tests/lib/sheetDay pins it across a spring-forward day.
  const wall = Date.UTC(y!, m! - 1, d!, hour);
  return new Date(wall - offsetMs(wall)).toISOString();
}

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}

/**
 * The sheet day as instants: its start and end (the next day's start), and the one time every row of it is read at.
 * The sheet carries no times (and he ruled 2026-10-03 that pump times aren't needed), so every row reads at noon:
 * the DAY is the fact, and nothing FG ranks uses the hour.
 */
export function sheetDayBounds(day: string): { start: string; end: string; readAt: string } {
  return { start: winnipegInstant(day, 0), end: winnipegInstant(nextDay(day), 0), readAt: winnipegInstant(day, 12) };
}

/** Winnipeg's calendar day at this instant, YYYY-MM-DD. */
export function winnipegDay(ms: number): string {
  return DAY_KEY.format(new Date(ms));
}

/** "Sat, Nov 7" for a day key; "Nov 9"-style for an instant goes through `dayOfInstant`. */
export function dayLabel(day: string): string {
  return DAY_LABEL.format(new Date(winnipegInstant(day, 12))).replace(/\./g, '');
}
export function dayOfInstant(iso: string): string {
  return DAY_LABEL.format(new Date(iso)).replace(/\./g, '');
}

/** A sheet can be today's or older, never a day that hasn't happened. */
export function isSheetDay(day: string, nowMs: number): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= winnipegDay(nowMs);
}

export type SheetCar = Pick<Vehicle, 'id' | 'licensePlate' | 'unitNumber' | 'make' | 'model' | 'year' | 'archivedAt'> & Partial<Pick<Vehicle, 'isHybrid' | 'isTesla'>>;
export type SheetMatch = { kind: 'one'; car: SheetCar } | { kind: 'none' } | { kind: 'many'; cars: SheetCar[] };

/**
 * The car a sheet row names: its plate, or its unit number (the sheet's first column), typed any way ("lur 247",
 * "5427752", "542 7752"). An archived car still counts (archived is an inference, and the sheet just saw it), but an
 * active car with the same plate wins.
 */
export function matchSheetCar(typed: string, cars: readonly SheetCar[]): SheetMatch {
  const t = normalizePlate(typed);
  if (t.length < 3) return { kind: 'none' };
  const digits = t.replace(/\D/g, '');
  const hits = cars.filter(c => normalizePlate(c.licensePlate) === t
    || (c.unitNumber != null && (normalizePlate(c.unitNumber) === t || (digits.length >= 5 && digits === t && c.unitNumber.replace(/\D/g, '') === digits))));
  const live = hits.filter(c => !c.archivedAt);
  const pick = live.length ? live : hits;
  if (pick.length === 1) return { kind: 'one', car: pick[0]! };
  return pick.length ? { kind: 'many', cars: pick } : { kind: 'none' };
}

/** A typed odo: whole km, 1 to 9,999,999, commas and spaces allowed. */
export function parseOdo(typed: string): number | null {
  const s = typed.replace(/[\s,]/g, '');
  if (!/^\d{1,7}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

export const km = (n: number) => n.toLocaleString('en-CA');

/** What record_sheet_odometer answered (migration 168). */
export type SheetResult =
  | { status: 'saved'; reading_id: number; sighting_id: number | null; current: boolean; kept: { km: number; at: string | null } | null }
  | { status: 'conflict'; before: { km: number; at: string } | null; after: { km: number; at: string } | null }
  | { status: 'already' | 'no_car' | 'bad_km' | 'bad_day' | 'future' };

/** The row's own words. `tone` drives its colour; a conflict offers Save anyway. */
export function sheetRowWords(r: SheetResult, odo: number, day: string): { text: string; tone: 'ok' | 'note' | 'warn' } {
  switch (r.status) {
    case 'saved':
      if (r.current) return { text: `✓ ${km(odo)} on ${dayLabel(day)}, now the car's odo`, tone: 'ok' };
      if (r.kept) return { text: `✓ ${km(odo)} on ${dayLabel(day)}. Kept the newer ${km(r.kept.km)}${r.kept.at ? ` (${dayOfInstant(r.kept.at)})` : ''} as the car's odo`, tone: 'ok' };
      return { text: `✓ ${km(odo)} on ${dayLabel(day)}`, tone: 'ok' };
    case 'conflict': {
      const n = r.before ?? r.after!;
      const side = r.before ? 'higher' : 'lower';
      return { text: `Doesn't fit: ${dayOfInstant(n.at)} read ${km(n.km)}, ${side} than this. A misread on one of them?`, tone: 'warn' };
    }
    case 'already': return { text: `Already in for ${dayLabel(day)}`, tone: 'note' };
    case 'no_car': return { text: 'FG has no car by that id', tone: 'warn' };
    case 'future': return { text: "That day hasn't happened yet", tone: 'warn' };
    default: return { text: "That odo didn't take", tone: 'warn' };
  }
}
