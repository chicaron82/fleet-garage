// The overflow MANIFEST — what was sent where, grouped. A LEAF module on purpose: the Effie
// executor that used to own this imports the key-tag reader and a server Supabase client, so a
// client surface importing it would drag server-only code into the browser bundle. Split out
// 2026-09-11 when My Day grew a "what went to AV Flight / FastAir" card, so the card and Effie's
// `lookup_sent` answer the question with ONE implementation rather than two that drift.
import { shiftBusinessDate } from './shiftDay.js';

/** One `vsa_trips` row, as much of it as the manifest needs. */
export interface SentRow {
  vehicle_plate?: string | null;
  vehicle_unit?: string | null;
  arrive_location?: string | null;
  depart_time?: string | null;
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
    const onDay = rows
      .filter((r) => r.depart_time && shiftBusinessDate(new Date(r.depart_time)) === day)
      .sort((a, b) => (a.depart_time! < b.depart_time! ? -1 : a.depart_time! > b.depart_time! ? 1 : 0));
    for (const r of onDay) push(r.arrive_location ?? 'Unknown', `${label(r)} · ${hhmm(r.depart_time!)}`);
    const groups = [...byDest.entries()].map(([destination, vehicles]) => ({ destination, count: vehicles.length, vehicles }));
    return { scope: 'day', date: day, total: onDay.length, groups };
  }

  // 'current': latest send per vehicle. Rows arrive newest-first, so the first one wins.
  // There is no return-logging in FG, so this is "last sent", never "confirmed still there".
  const seen = new Set<string>();
  for (const r of rows) {
    const key = label(r).toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    push(r.arrive_location ?? 'Unknown', label(r));
  }
  const groups = [...byDest.entries()].map(([destination, vehicles]) => ({ destination, count: vehicles.length, vehicles }));
  return { scope: 'current', total: seen.size, groups };
}

/** Local 24h clock, the way the lot reads times. Exported: the executor's unsend candidates
 *  stamp their times with the SAME formatter the manifest uses. */
export function hhmm(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Winnipeg', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}
