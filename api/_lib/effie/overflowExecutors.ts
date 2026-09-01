// Effie executors — overflow domain: read the overflow manifest (what's sent where) and draft a
// batch of overflow sends. OVERFLOW_DESTINATIONS is imported by exactly these two, so keeping them
// together keeps that import local. Split from effieExecutors.ts (2026-07-24, pure move).
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlate, resolveVehicleRow } from '../effieHelpers.js';
import { shiftBusinessDate } from '../shiftDay.js';
import {
  buildUnsendProposal,
  describeCandidate,
  pickUnsendTarget,
  type SentCandidate,
  type UnsendProposal,
} from '../unsendProposal.js';
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
    .is('voided_at', null)   // a voided send did not happen
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

/**
 * Draft the removal of a logged send that never happened.
 *
 * ⭐ Aaron, 2026-09-01: *"maybe a way for me to delete something that was 'sent'. I think the only
 * way to do it is to ask you or hunt for it myself in supabase."* The record is written from the
 * INTENDED manifest, so when a driver ignores the note on the board it keeps the plan rather than
 * the reality — and until now the only correction was a human editing the database by hand.
 *
 * ⚠️⚠️ IT REFUSES RATHER THAN GUESSES. A car sent to FastAir in the morning and AV Flight in the
 * afternoon is the exact case that produced this feature, and the row he wants gone is the
 * EARLIER one — so "take the most recent" is wrong precisely where it matters. Worse, a wrong
 * void is indistinguishable from a right one afterwards: nothing surfaces it, and the record ends
 * up holding a different lie than the one it started with. So more than one match returns the
 * candidates and NO proposal, and the model has to ask him which.
 */
export async function executeProposeUnsend(
  supabase: SupabaseClient,
  input: { plate?: string; destination?: string; date?: string; time?: string; reason?: string },
): Promise<{ toolResult: string; proposal: UnsendProposal | null }> {
  const raw = (input.plate ?? '').trim();
  if (!raw) {
    return { proposal: null, toolResult: JSON.stringify({ ok: false, reason: 'Need the plate or unit number of the vehicle whose send should be removed.' }) };
  }
  // Accept a unit number as readily as a plate — he reads whichever the key tag shows him.
  const row = await resolveVehicleRow(supabase, raw);
  const plate = row?.license_plate ?? normalizePlate(raw);

  const { data, error } = await supabase
    .from('vsa_trips')
    .select('id, vehicle_plate, vehicle_unit, arrive_location, depart_time')
    .is('voided_at', null)   // a voided send did not happen
    .in('arrive_location', [...OVERFLOW_DESTINATIONS])
    .ilike('vehicle_plate', plate)
    .order('depart_time', { ascending: false })
    .limit(50);
  if (error) throw error;

  let candidates: SentCandidate[] = (data ?? [])
    .filter((r) => r.depart_time)
    .map((r) => ({
      id: r.id as string,
      plate: (r.vehicle_plate as string) ?? plate,
      unit: (r.vehicle_unit as string | null) ?? null,
      destination: (r.arrive_location as string) ?? 'Unknown',
      day: shiftBusinessDate(new Date(r.depart_time as string)),
      time: hhmm(r.depart_time as string),
    }));

  // Narrow only by what he actually said. Each filter is optional; together they are usually
  // enough to reach exactly one, and when they are not, the refusal below does its job.
  const dest = (input.destination ?? '').trim().toLowerCase();
  const day = (input.date ?? '').trim();
  const time = (input.time ?? '').trim();
  if (dest) candidates = candidates.filter((c) => c.destination.toLowerCase() === dest);
  if (day) candidates = candidates.filter((c) => c.day === day);
  if (time) candidates = candidates.filter((c) => c.time === time);

  const target = pickUnsendTarget(candidates);
  if (!target.ok && target.why === 'none') {
    return { proposal: null, toolResult: JSON.stringify({ ok: false, reason: `No logged send on record for ${plate} matching that. It may already have been removed, or it was logged under a different plate.` }) };
  }
  if (!target.ok) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: 'more than one send matches — ASK which one, do not choose',
        candidates: target.candidates.map(describeCandidate),
      }),
    };
  }
  const proposal = buildUnsendProposal(target.trip, input.reason);
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      drafted: describeCandidate(target.trip),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is removed, just that it is drafted to remove on their tap',
    }),
  };
}
