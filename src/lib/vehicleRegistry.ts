import { supabase, writeWithRefresh } from './supabase';
import { withKeyedQueue } from './keyedQueue';
import { localDateStr } from '../hooks/useFleetBalance';
import type { VehicleRegistryEntry, RegistryLookupResult } from '../types';
import type { Database } from '../types/database.types';

type RegistryUpdate = Database['public']['Tables']['vehicle_registry']['Update'];

// ── Mapper ────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

export function mapEntry(row: Row): VehicleRegistryEntry {
  return {
    id:           row['id']         as string,
    branchId:     row['branch_id']  as string,
    vehicleId:    (row['vehicle_id']   as string  | null) ?? null,
    plate:        (row['plate']        as string  | null) ?? null,
    unitNumber:   (row['unit_number']  as string  | null) ?? null,
    make:         (row['make']         as string  | null) ?? null,
    model:        (row['model']        as string  | null) ?? null,
    year:         (row['year']         as number  | null) ?? null,
    color:        (row['color']        as string  | null) ?? null,
    arrivedAt:    (row['arrived_at']   as string  | null) ?? null,
    cleanedAt:    (row['cleaned_at']   as string  | null) ?? null,
    dispatchedAt: (row['dispatched_at']as string  | null) ?? null,
    needsReview:  (row['needs_review'] as boolean)        ?? false,
    createdAt:    row['created_at']  as string,
    date:         row['date']        as string,
  };
}

// ── Pure cores (extracted for unit testing) ───────────────────────────────────

/** Enrich = fill only the fields the existing record is currently missing. Pure. */
export function computeEnrichUpdates(
  existing: VehicleRegistryEntry,
  fields: {
    vehicleId?: string | null; plate?: string | null; unitNumber?: string | null;
    make?: string | null; model?: string | null; year?: number | null; color?: string | null;
    arrivedAt?: string | null; cleanedAt?: string | null; dispatchedAt?: string | null;
    needsReview?: boolean;
  },
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (fields.vehicleId   && !existing.vehicleId)   updates['vehicle_id']    = fields.vehicleId;
  if (fields.plate       && !existing.plate)       updates['plate']         = fields.plate;
  if (fields.unitNumber  && !existing.unitNumber)  updates['unit_number']   = fields.unitNumber;
  if (fields.make        && !existing.make)        updates['make']          = fields.make;
  if (fields.model       && !existing.model)       updates['model']         = fields.model;
  if (fields.year        && !existing.year)        updates['year']          = fields.year;
  if (fields.color       && !existing.color)       updates['color']         = fields.color;
  if (fields.arrivedAt   && !existing.arrivedAt)   updates['arrived_at']    = fields.arrivedAt;
  if (fields.cleanedAt   && !existing.cleanedAt)   updates['cleaned_at']    = fields.cleanedAt;
  if (fields.dispatchedAt && !existing.dispatchedAt) updates['dispatched_at'] = fields.dispatchedAt;
  if (fields.needsReview) updates['needs_review'] = true;
  return updates;
}

/**
 * Decide whether a found record is a clean match or a merge candidate — the
 * caller supplied an identifier the record lacks, or one that conflicts.
 * A confirmed pairing (`hasPair`) is trusted and suppresses the candidacy. Pure.
 */
export function classifyLookup(
  entry: VehicleRegistryEntry,
  plate: string | null | undefined,
  unitNumber: string | null | undefined,
  hasPair: boolean,
): 'found' | 'merge_candidate' {
  const missingPlate     = plate      && !entry.plate;
  const missingUnit      = unitNumber && !entry.unitNumber;
  const conflictingPlate = plate      && entry.plate      && entry.plate      !== plate;
  const conflictingUnit  = unitNumber && entry.unitNumber && entry.unitNumber !== unitNumber;
  if (!hasPair && (missingPlate || missingUnit || conflictingPlate || conflictingUnit)) {
    return 'merge_candidate';
  }
  return 'found';
}

/**
 * Resolve the surviving field values when merging two registry records:
 * keep-wins for identity fields, earliest-wins for timestamps. Pure.
 */
export function mergeEntries(
  keep: VehicleRegistryEntry,
  merge: VehicleRegistryEntry,
): Record<string, unknown> {
  const earliest = (a: string | null | undefined, b: string | null | undefined): string | null => {
    if (!a && !b) return null;
    if (!a) return b!;
    if (!b) return a;
    return a < b ? a : b;
  };
  return {
    plate:         keep.plate       ?? merge.plate,
    unit_number:   keep.unitNumber  ?? merge.unitNumber,
    vehicle_id:    keep.vehicleId   ?? merge.vehicleId,
    make:          keep.make        ?? merge.make,
    model:         keep.model       ?? merge.model,
    year:          keep.year        ?? merge.year,
    color:         keep.color       ?? merge.color,
    arrived_at:    earliest(keep.arrivedAt,    merge.arrivedAt),
    cleaned_at:    earliest(keep.cleanedAt,    merge.cleanedAt),
    dispatched_at: earliest(keep.dispatchedAt, merge.dispatchedAt),
    needs_review:  false,
  };
}

// ── Pairing lookup ────────────────────────────────────────────────────────────

async function resolveConfirmedPair(
  plate?: string | null,
  unitNumber?: string | null,
): Promise<{ plate: string; unitNumber: string } | null> {
  if (!plate && !unitNumber) return null;

  let query = supabase
    .from('vehicle_identifiers')
    .select('plate, unit_number')
    .eq('confirmed', true);

  if (plate)       query = query.eq('plate', plate);
  else if (unitNumber) query = query.eq('unit_number', unitNumber);

  const { data } = await query.maybeSingle();
  if (!data) return null;
  return { plate: data.plate as string, unitNumber: data.unit_number as string };
}

// ── Core lookup ───────────────────────────────────────────────────────────────

export async function lookupRegistry(params: {
  plate?: string | null;
  unitNumber?: string | null;
  branchId: string;
  date?: string; // defaults to today
}): Promise<RegistryLookupResult> {
  const { plate, unitNumber, branchId, date } = params;
  const targetDate = date ?? localDateStr(0);

  // 1. Resolve confirmed pair first — if we know this vehicle, go straight to both
  const pair = await resolveConfirmedPair(plate, unitNumber);

  let query = supabase
    .from('vehicle_registry')
    .select('*')
    .eq('branch_id', branchId)
    .eq('date', targetDate);

  if (pair) {
    query = query.or(`plate.eq.${pair.plate},unit_number.eq.${pair.unitNumber}`);
  } else if (plate) {
    query = query.eq('plate', plate);
  } else if (unitNumber) {
    query = query.eq('unit_number', unitNumber);
  } else {
    return { status: 'not_found' };
  }

  const { data } = await query.maybeSingle();
  if (!data) return { status: 'not_found' };

  const entry = mapEntry(data as Row);

  // 2. Clean match, or a merge candidate (caller knows something the record doesn't)?
  return classifyLookup(entry, plate, unitNumber, !!pair) === 'merge_candidate'
    ? { status: 'merge_candidate', existing: entry }
    : { status: 'found', entry };
}

/**
 * Cross-date "have we ever seen this plate" recall. lookupRegistry is scoped to a
 * single day (the arrival/throughput flow); this scans every date for the most
 * recent sighting — the permanent memory that lets a plate entered once be
 * recognized on later days. Returns null when the plate was never seen. The
 * caller passes a normalized plate (see normalizePlate in lib/vehicleByPlate).
 */
export async function lookupRegistryAnyDate(
  plate: string,
  branchId: string,
): Promise<VehicleRegistryEntry | null> {
  if (!plate) return null;
  const { data } = await supabase
    .from('vehicle_registry')
    .select('*')
    .eq('branch_id', branchId)
    .eq('plate', plate)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapEntry(data as Row) : null;
}

// ── Create or enrich ──────────────────────────────────────────────────────────

interface CreateOrEnrichParams {
  branchId:     string;
  vehicleId?:   string | null;
  plate?:       string | null;
  unitNumber?:  string | null;
  make?:        string | null;
  model?:       string | null;
  year?:        number | null;
  color?:       string | null;
  arrivedAt?:   string | null;
  cleanedAt?:   string | null;
  dispatchedAt?: string | null;
  needsReview?: boolean;
  date?: string;
}

/**
 * Serialize concurrent calls for the same vehicle+day. This find-or-insert is
 * hit from several fire-and-forget sites (check-in intake, new-hold, movement,
 * the lost-found plate `remember`) — two concurrent calls both saw "no row yet"
 * and both inserted a duplicate. Queued (not lock-dropped: each call can carry
 * enrichment the others don't), the second call runs after the first and finds
 * the fresh row to enrich. Keyed plate-first to match lookupRegistry's priority.
 * NB: a DB unique index would be the wrong fix — the merge_candidate flow
 * deliberately inserts a second same-day row pending a human merge.
 */
export async function createOrEnrichRegistry(params: CreateOrEnrichParams): Promise<VehicleRegistryEntry | null> {
  const targetDate = params.date ?? localDateStr(0);
  const queueKey = `registry:${params.branchId}:${targetDate}:${params.plate ?? params.unitNumber ?? 'anon'}`;
  return withKeyedQueue(queueKey, () => createOrEnrichUnqueued({ ...params, date: targetDate }));
}

async function createOrEnrichUnqueued(params: CreateOrEnrichParams): Promise<VehicleRegistryEntry | null> {
  const { branchId, date, ...fields } = params;
  const targetDate = date ?? localDateStr(0);

  // Try to find an existing entry for today
  const lookup = await lookupRegistry({
    plate:      fields.plate,
    unitNumber: fields.unitNumber,
    branchId,
    date:       targetDate,
  });

  if (lookup.status === 'found') {
    // Enrich: only update fields that are currently null
    const existing = lookup.entry;
    const updates = computeEnrichUpdates(existing, fields);

    if (Object.keys(updates).length === 0) return existing;

    const { data } = await supabase
      .from('vehicle_registry')
      .update(updates as unknown as RegistryUpdate)
      .eq('id', existing.id)
      .select()
      .single();

    return data ? mapEntry(data as Row) : null;
  }

  // Create new entry
  const { data } = await supabase
    .from('vehicle_registry')
    .insert({
      branch_id:    branchId,
      date:         targetDate,
      vehicle_id:   fields.vehicleId   ?? null,
      plate:        fields.plate       ?? null,
      unit_number:  fields.unitNumber  ?? null,
      make:         fields.make        ?? null,
      model:        fields.model       ?? null,
      year:         fields.year        ?? null,
      color:        fields.color       ?? null,
      arrived_at:   fields.arrivedAt    ?? null,
      cleaned_at:   fields.cleanedAt    ?? null,
      dispatched_at: fields.dispatchedAt ?? null,
      needs_review:  fields.needsReview  ?? false,
    })
    .select()
    .single();

  return data ? mapEntry(data as Row) : null;
}

// ── Confirm pairing ───────────────────────────────────────────────────────────

export async function confirmPairing(
  plate: string,
  unitNumber: string,
  confirmedBy = 'user',
): Promise<void> {
  await writeWithRefresh(() => supabase.from('vehicle_identifiers').upsert(
    { plate, unit_number: unitNumber, confirmed: true, confirmed_at: new Date().toISOString(), confirmed_by: confirmedBy },
    { onConflict: 'plate,unit_number' },
  ));
}

// ── Merge records ─────────────────────────────────────────────────────────────

export async function mergeRegistryRecords(
  keepId: string,
  mergeId: string,
): Promise<void> {
  const { data: rows } = await supabase
    .from('vehicle_registry')
    .select('*')
    .in('id', [keepId, mergeId]);

  if (!rows || rows.length !== 2) return;

  const keep  = mapEntry(rows.find((r: Row) => r['id'] === keepId)!  as Row);
  const merge = mapEntry(rows.find((r: Row) => r['id'] === mergeId)! as Row);

  const updates = mergeEntries(keep, merge);

  await writeWithRefresh(() => supabase.from('vehicle_registry').update(updates as unknown as RegistryUpdate).eq('id', keepId));
  await writeWithRefresh(() => supabase.from('vehicle_registry').delete().eq('id', mergeId));

  // Confirm the pairing now that we know both identifiers
  const plate      = (updates['plate']       as string | null);
  const unitNumber = (updates['unit_number'] as string | null);
  if (plate && unitNumber) {
    await confirmPairing(plate, unitNumber);
  }
}
