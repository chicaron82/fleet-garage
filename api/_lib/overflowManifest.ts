// The overflow MANIFEST — what was sent where, grouped. A LEAF module on purpose: the Effie
// executor that used to own this imports the key-tag reader and a server Supabase client, so a
// client surface importing it would drag server-only code into the browser bundle. Split out
// 2026-09-11 when My Day grew a "what went to AV Flight / FastAir" card, so the card and Effie's
// `lookup_sent` answer the question with ONE implementation rather than two that drift.
import { shiftBusinessDate } from './shiftDay.js';
import { OVERFLOW_DESTINATIONS, type OverflowDestination } from './overflowProposal.js';

/** One `vsa_trips` row, as much of it as the manifest needs. */
export interface SentRow {
  vehicle_plate?: string | null;
  vehicle_unit?: string | null;
  arrive_location?: string | null;
  depart_time?: string | null;
}

/**
 * ⭐⭐ THE RULE LIVES HERE, not in each caller's query (Aaron, 2026-09-11: *"anything sent to
 * Richardson doesn't count"*). Every surface that asks the manifest a question also filtered
 * `arrive_location` itself, which is three chances to get the set wrong — and the set WAS wrong:
 * 'Airport' is what the driver-trip flow writes for an ordinary shuttle run, so normal trips were
 * being counted as overflow sends. Filtering inside the manifest makes "what counts as overflow"
 * one decision instead of a rule repeated in the card, Effie's lookup, and whatever comes next.
 */
function onlyOverflow(rows: readonly SentRow[]): SentRow[] {
  return rows.filter((r) => OVERFLOW_DESTINATIONS.includes((r.arrive_location ?? '') as OverflowDestination));
}

/**
 * ⭐ TWO GENUINELY DIFFERENT QUESTIONS, and conflating them is the defect this shape exists to
 * prevent (Aaron, 2026-09-01: *"what was sent there yesterday"*).
 *
 *   'current' — WHERE IS EVERYTHING NOW. Latest send per vehicle, across all days. Dedups on
 *               purpose: a car moved twice should report where it actually is. This is the answer
 *               to a management "where are these vehicles?" email.
 *
 *   'day'     — WHAT WAS SENT ON THAT DAY. ⚠️ **Deliberately does NOT dedup**, and that is the
 *               whole point. A past day is a historical fact, not a current position: a car sent
 *               to AV Flight yesterday and moved to FastAir today still WENT to AV Flight
 *               yesterday. Deduping to the newest spot would silently delete exactly the rows
 *               someone asking about yesterday most wants to see. Two sends of one car in one day
 *               are two moves and read as two rows, distinguished by their times.
 *
 * ⚠️ Before this existed, "what went to FastAir yesterday" routed to 'current' and produced a
 * where-is-everything-NOW list wearing a what-happened-YESTERDAY costume — a plausible wrong
 * answer, which beats a blank only in the sense that nothing about it invites doubt.
 *
 * Pure, so the grouping is testable without a Supabase client.
 */
export function groupOverflowSends(
  rows: readonly SentRow[],
  mode: 'current' | 'day',
  /** Business date (YYYY-MM-DD) — required for 'day', ignored for 'current'. */
  day?: string,
): { scope: string; date?: string; total: number; groups: { destination: string; count: number; vehicles: string[] }[] } {
  // ⭐ PLATE FIRST, not unit (Aaron, 2026-09-01: *"showing up as a list with licence plates to copy
  // would be easier"*). This list exists to be COPIED into a reply, and a plate is what the person
  // on the other end can read off a car; a unit number is an internal key. Unit is the fallback
  // only — overflow sends always carry a plate, so it should essentially never fire.
  const label = (r: SentRow) => r.vehicle_plate || r.vehicle_unit || 'Unknown';
  const byDest = new Map<string, string[]>();
  const push = (dest: string, text: string) => {
    const list = byDest.get(dest) ?? byDest.set(dest, []).get(dest)!;
    list.push(text);
  };

  if (mode === 'day') {
    // Every send that day, oldest-first — a day reads as a sequence of moves, not a ranking.
    // ⚠️ The TIME rides along: without it two sends of one car look like a duplicated row
    // rather than the two real trips they are.
    const onDay = onlyOverflow(rows)
      .filter((r) => r.depart_time && shiftBusinessDate(new Date(r.depart_time)) === day)
      .sort((a, b) => (a.depart_time! < b.depart_time! ? -1 : a.depart_time! > b.depart_time! ? 1 : 0));
    for (const r of onDay) push(r.arrive_location ?? 'Unknown', `${label(r)} · ${hhmm(r.depart_time!)}`);
    const groups = [...byDest.entries()].map(([destination, vehicles]) => ({ destination, count: vehicles.length, vehicles }));
    return { scope: 'day', date: day, total: onDay.length, groups };
  }

  // 'current': latest send per vehicle. Rows arrive newest-first, so the first one wins.
  // There is no return-logging in FG, so this is "last sent", never "confirmed still there".
  const seen = new Set<string>();
  for (const r of onlyOverflow(rows)) {
    const key = label(r).toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    push(r.arrive_location ?? 'Unknown', label(r));
  }
  const groups = [...byDest.entries()].map(([destination, vehicles]) => ({ destination, count: vehicles.length, vehicles }));
  return { scope: 'current', total: seen.size, groups };
}

/**
 * The overflow spots as COLUMNS, in the order Aaron reads them — from his own sketch of the card
 * (2026-09-11): `FastAir    AV Flight`. Fixed order is the point: a day where nothing went to one
 * of them still shows that column empty, so the eye lands in the same place scanning day to day
 * instead of the columns swapping seats whenever a destination is quiet.
 *
 * ⚠️ Same SET as `OVERFLOW_DESTINATIONS`, different ORDER — that list is the domain rule (what
 * counts as overflow), this one is how the card reads. Adding a spot means touching both.
 */
export const MANIFEST_COLUMNS: readonly string[] = ['FastAir', 'AV Flight'];

/** One shift-day of sends, shaped for a column-per-destination read. */
export interface OverflowDay {
  /** Business shift-date (YYYY-MM-DD) — 04:00 cutover, so a 00:30 send belongs to the night before. */
  date: string;
  total: number;
  groups: { destination: string; count: number; vehicles: string[] }[];
}

/**
 * Every shift-day that had a send, NEWEST FIRST.
 *
 * ⭐ WHY THIS EXISTS (Aaron, 2026-09-11, after seeing the first cut): *"Ahh I was thinking to show
 * what was last sent there."* The card's first build answered "what went today", which on a normal
 * day is nothing — an empty card in the slot he'd just cleared of noise. The question he actually
 * carries is **when did we last send, and what went** — so the card leads with the newest day that
 * has anything in it, whether that is today or nine days ago.
 *
 * Days with no sends simply don't appear. A quiet Tuesday is not a row; it's the absence between
 * two rows, and printing it would pad the list with nothing.
 *
 * ⚠️ Every day is built through `groupOverflowSends(rows, 'day', …)` rather than a second grouping
 * pass, so a day here and Effie's "what was sent on the 9th" cannot disagree — same no-dedup rule,
 * same plate-first labels, same times.
 */
export function groupOverflowDays(rows: readonly SentRow[]): OverflowDay[] {
  const dates = [...new Set(
    onlyOverflow(rows).filter((r) => r.depart_time).map((r) => shiftBusinessDate(new Date(r.depart_time!))),
  )].sort().reverse();

  return dates.map((date) => {
    const day = groupOverflowSends(rows, 'day', date);
    const byDest = new Map(day.groups.map((g) => [g.destination, g]));
    return {
      date,
      total: day.total,
      groups: [
        ...MANIFEST_COLUMNS.map((d) => byDest.get(d) ?? { destination: d, count: 0, vehicles: [] }),
        // A destination outside the columns can no longer reach here — `onlyOverflow` drops it —
        // but the spread stays as a seam: add a spot to OVERFLOW_DESTINATIONS and forget the
        // columns, and its sends surface unstyled instead of vanishing without a trace.
        ...day.groups.filter((g) => !MANIFEST_COLUMNS.includes(g.destination)),
      ],
    };
  });
}

/** Local 24h clock, the way the lot reads times. Exported: the executor's unsend candidates
 *  stamp their times with the SAME formatter the manifest uses. */
export function hhmm(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Winnipeg', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}
