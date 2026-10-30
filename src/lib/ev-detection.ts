import { supabase, writeWithRefresh } from './supabase';
import { isNetworkBlip, BLIP_RETRY_MS, READ_TIMEOUT_MS } from './networkBlip';
import { foldOZero, oZeroVariants } from './plateFold';
import type { EvAssetStatus } from '../types';

export interface TeslaDetectionResult {
  isTesla: boolean;
  lastCable: EvAssetStatus | null;
  lastAdapter: EvAssetStatus | null;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: number;
    color: string;
  };
}

export interface TeslaVehicleRow {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
}

export interface EvStatusRow {
  ev_cable_status: string | null;
  ev_adapter_status: string | null;
}

export function isTeslaMake(make: string | null | undefined): boolean {
  return (make ?? '').toLowerCase() === 'tesla';
}

/** The vehicle record stores each EV asset as a nullable boolean; every UI that edits one speaks
 *  `EvAssetStatus`. Shared rather than re-declared per screen — two copies of a converter is how
 *  two screens end up disagreeing about what `null` means. `null` stays null: never assessed. */
export const toEvStatus = (b: boolean | null | undefined): EvAssetStatus | null =>
  b == null ? null : b ? 'present' : 'missing';

/** The EV-kit status to surface at scan time (tag in hand), from the vehicle's canonical asset
 *  record. Mirrors evDispatchWarning's honesty: only a known-`false` counts as MISSING; a `null`
 *  (never assessed) is claimed neither way — so "complete" requires BOTH assets confirmed present,
 *  never fabricated off an unchecked one. Returns null for non-Teslas AND for a Tesla with nothing
 *  worth surfacing (partial/unassessed, none missing) — the scan card shows a line only when non-null.
 *  It's a LAST-SEEN status (the last recorded state), not a live check — the copy says so. */
export type EvScanStatus =
  | { kind: 'complete' }
  | { kind: 'missing'; missing: ('cable' | 'adapter')[] };

export function evAssetScanStatus(v: {
  isTesla?: boolean | null;
  make?: string | null;
  hasMobileCable?: boolean | null;
  hasJ1772Adapter?: boolean | null;
}): EvScanStatus | null {
  if (!v.isTesla && !isTeslaMake(v.make)) return null;
  const missing: ('cable' | 'adapter')[] = [];
  if (v.hasMobileCable === false) missing.push('cable');
  if (v.hasJ1772Adapter === false) missing.push('adapter');
  if (missing.length > 0) return { kind: 'missing', missing };
  if (v.hasMobileCable === true && v.hasJ1772Adapter === true) return { kind: 'complete' };
  return null; // partially/never assessed, none known-missing → nothing honest to surface
}

/**
 * Pure resolution of a Tesla detection result from a vehicle row and (when the
 * vehicle is a Tesla) the latest EV-status trip row. No I/O — `detectTeslaByPlate`
 * fetches the rows and delegates here. `lastTrip` is ignored for non-Teslas.
 */
export function classifyTesla(
  vehicle: TeslaVehicleRow | null,
  lastTrip: EvStatusRow | null,
): TeslaDetectionResult {
  if (!vehicle) return { isTesla: false, lastCable: null, lastAdapter: null };

  const info = { id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, color: vehicle.color };

  if (!isTeslaMake(vehicle.make)) {
    return { isTesla: false, lastCable: null, lastAdapter: null, vehicle: info };
  }

  return {
    isTesla: true,
    lastCable:   (lastTrip?.ev_cable_status   as EvAssetStatus) ?? null,
    lastAdapter: (lastTrip?.ev_adapter_status as EvAssetStatus) ?? null,
    vehicle: info,
  };
}

export async function detectTeslaByPlate(plate: string): Promise<TeslaDetectionResult> {
  const trimmed = plate.trim();
  if (!trimmed) return { isTesla: false, lastCable: null, lastAdapter: null };

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, make, model, year, color')
    .ilike('license_plate', trimmed)
    .maybeSingle();

  if (!vehicle) return classifyTesla(null, null);

  // Only the EV-status query is gated on Tesla; fetch it lazily.
  let lastTrip: EvStatusRow | null = null;
  if (isTeslaMake(vehicle.make as string)) {
    const { data } = await supabase
      .from('vsa_trips')
      .select('ev_cable_status, ev_adapter_status')
      .is('voided_at', null)   // a voided send did not happen
      .ilike('vehicle_plate', trimmed)
      .not('ev_cable_status', 'is', null)
      .order('depart_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastTrip = data as EvStatusRow | null;
  }

  return classifyTesla(vehicle as TeslaVehicleRow, lastTrip);
}

export interface VehicleSearchResult {
  license_plate: string;
  /** ⭐ Carried so a result found BY the unit can show the key that matched it — FG never resolves
   *  on a weaker key without saying so, which is the rule the scan card already follows. */
  unit_number: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
  /** ⚡🔋 The powertrain flags, so the trip pickers can badge what they are offering. Added
   *  2026-08-28 with `VehicleName`: without them these two surfaces could render no badge, and a
   *  missing badge on a screen where every other car shows one reads as "this one is petrol" —
   *  an absence asserting a fact. Selecting them is cheaper than that lie. */
  is_hybrid: boolean;
  is_tesla: boolean;
  /** ⭐ Set when the car is archived. Kept FINDABLE on purpose — archived means nobody has seen it,
   *  never that it is gone ([[project_fg_archived_is_an_inference]]), and a man typing a plate he is
   *  holding is evidence the archive was wrong. It ranks below live matches and the UI marks it. */
  archived_at?: string | null;
}

/** The write-test sandbox's unit prefix — see reference_fg_mock_units. */
const MOCK_UNIT_PREFIX = 'HRZ-';

/**
 * ⚠️⚠️ MOCK ROWS ARE NEVER AN ANSWER, AND THIS CANNOT BE DONE IN THE QUERY.
 *
 * Aaron, 2026-09-17, typing `LUR486` into Find a car: *"Can you look into that mock vehicle showing
 * up"* — two results, a 2023 Malibu on unit `HRZ-3307` (mock, archived since 09-03) above the real
 * 2026 Trax on unit 5429592. `searchVehicles` read `vehicles` with no exclusion at all, so the
 * sandbox was offered on all three typed surfaces (header look-up, closing inventory, trip form).
 *
 * ⚠️ NOT `.not('unit_number','like','HRZ-%')`: `NOT LIKE` against a NULL unit yields NULL, which
 * would silently drop every plate-only car — including the geotab cars stamped 8199 that same
 * morning, none of which has a unit number. That is the canonical-filter NULL trap (CLAUDE.md READ
 * FIRST #5) and it would have traded a visible fake for an invisible absence. So: fetch wider,
 * filter in memory, then trim.
 *
 * ⭐ Live before archived, because the complaint was two identical plates with nothing to separate
 * them — not that the archived one appeared at all.
 *
 * ⭐⭐ THEN ALPHABETICAL, by plate. Aaron, 2026-10-15, typing `LZM53` for LZM532: *"i'll get to the
 * second last character and it's like never in the results to choose from ... was wondering if there
 * was an order to how it comes up."* There was none: when every row is a prefix hit (eleven LZM53x
 * records) nothing separated them, so the list was whatever order Postgres stored them in, and
 * LZM532 came back 9th of 11 behind a limit of 5. Alphabetical makes the list predictable, and
 * `SEARCH_SHOW_LIMIT` makes a whole last-digit run fit. The ranker sorts by plate ITSELF rather than
 * trusting the query's ORDER BY, so the rule lives in one tested place.
 * docs/ticket-lookup-second-last-character.md
 */
/** How many matches a typed look-up shows: a full run of last digits (…0 to …9) plus a duplicate. */
export const SEARCH_SHOW_LIMIT = 12;

export function rankVehicleMatches(
  rows: readonly VehicleSearchResult[],
  limit = 5,
  /** What he typed. Rows whose plate or unit STARTS with it rank above ones that merely contain it,
   *  so widening the filter to a contains-match (2026-09-29) cannot demote the obvious answer. */
  query = '',
): VehicleSearchResult[] {
  const q = foldOZero(query.trim());
  const startsWith = (v: VehicleSearchResult) =>
    !!q && (foldOZero(v.license_plate).startsWith(q) || foldOZero(v.unit_number ?? '').startsWith(q));
  return rows
    .filter(v => !(v.unit_number ?? '').startsWith(MOCK_UNIT_PREFIX))
    .slice()
    // Prefix before contains, then live before archived, then alphabetical by plate. Array#sort is
    // stable, so rows equal on all three keep the order the query gave them.
    .sort((a, b) => (Number(startsWith(b)) - Number(startsWith(a)))
      || (Number(!!a.archived_at) - Number(!!b.archived_at))
      || a.license_plate.toUpperCase().localeCompare(b.license_plate.toUpperCase()))
    .slice(0, limit);
}

/**
 * ⭐⭐⭐ ONE ANSWER TO "WHICH CAR IS THIS?" — matched on the PLATE **or** the UNIT NUMBER.
 *
 * Aaron, 2026-09-04, looking at the closing inventory's bare Look-up beside this typeahead: *"i feel
 * the look up should work like movement log… plate may be unreadable but you can still look up the
 * unit right? how does the header scanner work. just plate only? this isn't a new thing. its just
 * applied differently."*
 *
 * ⚠️⚠️ HE WAS RIGHT, AND THE AUDIT WAS WORSE THAN HE PUT IT. Four surfaces answered that question
 * four ways: this one prefix-matched the PLATE ONLY; the closing inventory and the airport flip did
 * an EXACT in-memory `===` on the plate; and the **scan resolver** — the one nobody has to type into
 * — is the only implementation that ever tried the unit number (`matchByUnitNumber`, reporting
 * `matchedByUnit` so the card can say which key did the work). **The capability existed in exactly
 * one place, and it was the place least likely to need it**: a scanned tag usually has both keys,
 * while the man typing is typing *because* one of them is unreadable.
 *
 * ⚠️ The query input is sanitised before it reaches `.or()`, which takes a FILTER STRING — a comma
 * or a parenthesis in the raw text would not be an injection into SQL but it would silently change
 * the shape of the filter, which is its own kind of wrong answer.
 */
/**
 * ⭐⭐⭐ WHAT A SEARCH ANSWERED — matches, AND whether it got to ask at all.
 *
 * Aaron, 2026-09-29: *"sometimes i'll start typing and nothing appears until i 'look up'."* He typed
 * `LFJ334` in full and got silence; the row was there the whole time. This function used to do
 * `const { data } = await …` and **throw the error away**, so a dead request returned `[]` — which is
 * the same value as "no such car". ⚠️ **An empty list cannot mean two things.** The caller could not
 * tell a broken search from an honest miss, and neither could he.
 *
 * ⭐ It also explains why "Look up" kept working: that path never touches the network — it resolves
 * against the fleet already in memory — so an expired session silences the typeahead alone.
 * docs/September/ticket-lookup-goes-quiet.md
 */
export interface VehicleSearch {
  matches: VehicleSearchResult[];
  /** The request failed (after an auth refresh and ONE network retry). The caller must SAY so, never render silence. */
  failed: boolean;
}

export async function searchVehicles(query: string): Promise<VehicleSearch> {
  // Letters, digits and dashes are the whole alphabet of a plate and a unit number; anything else
  // is either a typo or a character that would re-punctuate the filter below.
  const trimmed = query.trim().replace(/[^A-Za-z0-9-]/g, '');
  if (trimmed.length < 2) return { matches: [], failed: false };

  // ⭐ CONTAINS, not starts-with. The old filter was `X%`, so typing the TAIL of a key found nothing:
  // measured live 2026-09-29, `LUR4` → 74 hits while `494` (tail of LUR494) and `9550` (tail of unit
  // 5429550) → 0 each. Reading the last digits off a tag or a gas sheet is the natural move precisely
  // when the front is the unreadable part, and it was the one shape that could not work.
  // `rankVehicleMatches` puts prefix hits first, so the common case is unchanged.
  // ⚠️ Fetch wider than we show: mock rows are removed AFTER the query, so a limit of 5 here could
  // spend slots on rows nobody may pick. Ordered by plate so the window it cuts is a predictable one
  // (2026-10-15: unordered, the 30 were storage order); 60 leaves a short contains-query room for
  // the prefix hits the ranker floats to the top.
  const run = () => supabase
    .from('vehicles')
    .select('license_plate, unit_number, make, model, year, color, is_hybrid, is_tesla, archived_at')
    // O and 0 are one key (oZeroVariants): OGK487 finds 0GK487.
    .or(oZeroVariants(trimmed).flatMap(t => [`license_plate.ilike.%${t}%`, `unit_number.ilike.%${t}%`]).join(','))
    .order('license_plate')
    .limit(60)
    // ⭐ postgrest-js's own retry is OFF here: it is three attempts with 1s/2s/4s backoff, which made
    // a dead network cost 7 seconds of silence (measured 2026-09-29). FG does ONE retry itself, below.
    .retry(false)
    // …and a connection that accepts the request and never answers gives up instead of hanging.
    // (Tighter than the shared limit in `requestTimeout` on purpose: he is typing and watching.)
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));

  // Same refresh-then-retry every WRITE in FG already gets (`writeWithRefresh`). A read that silently
  // returns nothing on an expired token is the more dangerous of the two, because nothing looks normal.
  // ⚠️⚠️ AND A THROW LANDS IN THE SAME STATE AS A RETURNED ERROR. postgrest CATCHES a dead fetch and
  // hands back `{ data: null, error }` — but Aaron's 2026-09-29 console (every request
  // `ERR_NAME_NOT_RESOLVED`) also shows FG catching a THROWN `TypeError: Failed to fetch` elsewhere,
  // so throws do happen here. A rejection would skip the line below entirely and the field would go
  // quiet again — the exact bug, re-entering through the one door the fix left open. The guarantee is
  // "never render silence", and it must not depend on which layer of the client caught what.
  const attempt = async () => {
    try { return await writeWithRefresh(run); } catch (thrown) { return { data: null, error: thrown }; }
  };
  let { data, error } = await attempt();
  // One retry, for a dropped request only (a cell handoff on the lot), then tell the truth.
  if (isNetworkBlip(error)) {
    await new Promise(resolve => setTimeout(resolve, BLIP_RETRY_MS));
    ({ data, error } = await attempt());
  }
  if (error) return { matches: [], failed: true };
  return { matches: rankVehicleMatches((data as VehicleSearchResult[]) || [], SEARCH_SHOW_LIMIT, trimmed), failed: false };
}
