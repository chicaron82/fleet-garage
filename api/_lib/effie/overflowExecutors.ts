// Effie executors — overflow domain: read the overflow manifest (what's sent where) and draft a
// batch of overflow sends. OVERFLOW_DESTINATIONS is imported by exactly these two, so keeping them
// together keeps that import local. Split from effieExecutors.ts (2026-07-24, pure move).
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlate, resolveVehicleRow } from '../effieHelpers.js';
import { shiftBusinessDate } from '../shiftDay.js';
import {
  buildOverflowProposal,
  OVERFLOW_DESTINATIONS,
  type OverflowDestination,
  type OverflowLogProposal,
  type OverflowVehicle,
} from '../overflowProposal.js';

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
  const label = (r: SentRow) => r.vehicle_unit || r.vehicle_plate || 'Unknown';
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

/** Local 24h clock, the way the lot reads times. */
function hhmm(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Winnipeg', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

/** Read-only: the overflow manifest — which vehicles are at which overflow spot, grouped, for the
 *  operator to copy into a reply. See `groupOverflowSends` for what the scopes actually mean.
 *
 *  ⚠️ `shift` is not a third behaviour — it is `day` with today's business date. It used to be its
 *  own branch that deduped, which made the end-of-shift report quietly drop a car sent to two spots
 *  in one shift. Same question, same answer, one code path. */
export async function executeLookupSent(
  supabase: SupabaseClient,
  input: { scope?: string; date?: string },
): Promise<string> {
  const { data, error } = await supabase
    .from('vsa_trips')
    .select('vehicle_plate, vehicle_unit, arrive_location, depart_time')
    .in('arrive_location', [...OVERFLOW_DESTINATIONS])
    .order('depart_time', { ascending: false })
    .limit(1000);
  if (error) throw error;

  return JSON.stringify(resolveSentScope(data ?? [], input, new Date()));
}

/**
 * Which question was actually asked. Tolerant in both directions on purpose — the caller is a
 * language model, and a scope/date pair that disagree must still produce the honest answer:
 *   • a `date` given at all means a specific day, whatever the scope says;
 *   • `shift` or `day` with no date means today's business day;
 *   • anything else is 'current'.
 * ⚠️ The date goes through `shiftBusinessDate`, never a calendar day — the shift rolls over at
 * CUTOVER_HOUR, so a 23:40 send belongs to the day that started the evening before.
 */
export function resolveSentScope(rows: readonly SentRow[], input: { scope?: string; date?: string }, now: Date) {
  const asked = (input.date ?? '').trim();
  if (asked) return groupOverflowSends(rows, 'day', asked);
  if (input.scope === 'shift' || input.scope === 'day') return groupOverflowSends(rows, 'day', shiftBusinessDate(now));
  return groupOverflowSends(rows, 'current');
}

/**
 * Draft a batch of overflow sends — resolve each plate to a fleet row (so the trip
 * logs the canonical plate/unit) and build a confirm proposal. NEVER writes: the
 * client logs one completed one-way trip per vehicle only on the tap. Unresolved
 * plates are kept and flagged so the operator sees them before confirming.
 */
export async function executeProposeOverflowLog(
  supabase: SupabaseClient,
  input: { plates?: string[]; destination?: string },
): Promise<{ toolResult: string; proposal: OverflowLogProposal | null }> {
  const destination = (input.destination ?? '') as OverflowDestination;
  const plates = (input.plates ?? []).map((p) => (p ?? '').trim()).filter(Boolean);
  if (!OVERFLOW_DESTINATIONS.includes(destination) || plates.length === 0) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: 'Need at least one plate and a destination of AV Flight, FastAir, or Airport.',
      }),
    };
  }
  const vehicles: OverflowVehicle[] = [];
  for (const raw of plates) {
    const row = await resolveVehicleRow(supabase, raw);
    if (row) {
      vehicles.push({
        plate: row.license_plate,
        unit: row.unit_number ?? null,
        label: row.unit_number ? `Unit ${row.unit_number}` : row.license_plate,
        unresolved: false,
      });
    } else {
      vehicles.push({ plate: normalizePlate(raw), unit: null, label: raw.trim(), unresolved: true });
    }
  }
  const proposal = buildOverflowProposal(destination, vehicles);
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      drafted: `${vehicles.length} vehicle(s) → ${destination}`,
      unresolved: vehicles.filter((v) => v.unresolved).map((v) => v.label),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is logged, just that it is drafted to log on their tap',
    }),
  };
}
