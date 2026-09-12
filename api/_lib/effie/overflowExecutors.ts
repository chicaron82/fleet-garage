// Effie executors — overflow domain: read the overflow manifest (what's sent where) and draft a
// batch of overflow sends. OVERFLOW_DESTINATIONS is imported by exactly these two, so keeping them
// together keeps that import local. Split from effieExecutors.ts (2026-07-24, pure move).
import type { SupabaseClient } from '@supabase/supabase-js';
import { readKeytagPhoto } from '../keytagReader.js';
import { normalizePlate, resolveVehicleRow } from '../effieHelpers.js';
import { shiftBusinessDate } from '../shiftDay.js';
import { groupOverflowSends, hhmm, type SentRow } from '../overflowManifest.js';
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

// The manifest grouping lives in ../overflowManifest (a leaf module the CLIENT can import too —
// My Day's overflow card reuses it). Re-exported here so this module's long-standing import path
// keeps working and there is still exactly one implementation.
export { groupOverflowSends, type SentRow } from '../overflowManifest.js';

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
/**
 * ⭐⭐⭐ THE TAG IS THE IDENTITY SOURCE, so when photos are attached they OUTRANK the model's
 * transcription of the plate.
 *
 * Aaron, 2026-09-08, after three cars went to overflow through the chat and one came out the far
 * side with an empty record: *"anything that reads keytags shouldn't be tossing out valuable
 * info"*. The tool's input is `plates: string[]`, so the model was looking at a tag carrying unit,
 * owning area, rental class, model code, VIN last-9 and colour, and could hand over one string.
 *
 * ⚠️ THE SHORTCUT WAS TO WIDEN THE SCHEMA AND LET THE MODEL TRANSCRIBE THE REST. He rejected it —
 * *"b properly"* — and he was right: `_lib/keytagReader` is a two-tier read measured on 40 of his
 * own tags (opus 13-0 on the ones haiku found hard), with fleet corroboration deciding escalation,
 * a spend ledger, both codices, and a human pin outranking the tag. Free-form vision output into
 * the same table would have been a second, unmeasured reader.
 *
 * ⭐ Typed plates still work and are unchanged — *"log LFJ379 and LUR175 to FastAir"* needs no
 * photo. Where both appear, the reads come first and any leftover typed plate is resolved the old
 * way, so a mixed message loses nothing.
 */
export async function executeProposeOverflowLog(
  supabase: SupabaseClient,
  input: { plates?: string[]; destination?: string },
  photos?: { images: readonly { mediaType: string; data: string }[]; apiKey: string; userId: string },
): Promise<{ toolResult: string; proposal: OverflowLogProposal | null }> {
  const destination = (input.destination ?? '') as OverflowDestination;
  const plates = (input.plates ?? []).map((p) => (p ?? '').trim()).filter(Boolean);
  const hasPhotos = (photos?.images.length ?? 0) > 0;
  if (!OVERFLOW_DESTINATIONS.includes(destination) || (plates.length === 0 && !hasPhotos)) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        // ⚠️ The airport is not an option: a run to Richardson is an ordinary trip, not an overflow
        // send, and logging it as one puts a rentable car on the "parked elsewhere" manifest.
        reason: 'Need at least one plate or key-tag photo, and a destination of AV Flight or FastAir.',
      }),
    };
  }
  const vehicles: OverflowVehicle[] = [];
  const seen = new Set<string>();

  // ── The photos first: each one is READ, not transcribed ──────────────────────────────────────
  for (let i = 0; hasPhotos && i < photos!.images.length; i++) {
    let read: Awaited<ReturnType<typeof readKeytagPhoto>> = null;
    try {
      read = await readKeytagPhoto(photos!.images[i]!, supabase, photos!.userId, photos!.apiKey);
    } catch {
      // ⚠️ One unreadable tag must not cost him the other nine. The batch continues and the tool
      // result names how many failed, so the model can say so instead of quietly logging fewer.
      read = null;
    }
    const tagPlate = (read?.plate ?? '').trim();
    if (!tagPlate) continue;
    const row = await resolveVehicleRow(supabase, tagPlate);
    const canonical = row ? row.license_plate : normalizePlate(tagPlate);
    if (seen.has(canonical)) continue;      // the same tag photographed twice
    seen.add(canonical);
    vehicles.push({
      plate: canonical,
      // ⭐ The tag speaks where the record is silent — the same rule `overflowScan.ts` follows on
      // the client. A blank is null OR empty, so this cannot be `??`.
      unit: (row?.unit_number ?? '').trim() || (read?.unitNumber ?? '').trim() || null,
      label: (row?.unit_number ?? '').trim() || (read?.unitNumber ?? '').trim()
        ? `Unit ${(row?.unit_number ?? '').trim() || (read?.unitNumber ?? '').trim()}`
        : canonical,
      unresolved: !row,
      read: read ?? undefined,
      photoIndex: i,
    });
  }

  // ── Then any typed plate the photos did not already account for ──────────────────────────────
  for (const raw of plates) {
    const row = await resolveVehicleRow(supabase, raw);
    if (seen.has(row ? row.license_plate : normalizePlate(raw))) continue;
    seen.add(row ? row.license_plate : normalizePlate(raw));
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
      fromPhotos: vehicles.filter((v) => v.read).length,
      unreadablePhotos: hasPhotos ? photos!.images.length - vehicles.filter((v) => v.read).length : 0,
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
