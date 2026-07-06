// Effie's tool executors — the read/query + draft-proposal logic behind each tool.
// Extracted verbatim from fg-chat (phase 2b) so the handler stays a thin dispatcher;
// each executor keeps the exact signature it had inline. A new tool's executor lands
// here beside its kin, never back in the god-file.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  summarizeLookup,
  describeVehicle,
  type HoldFact,
  type VehicleLookupResult,
} from './vehicleSummary.js';
import { shiftBusinessDate } from './shiftDay.js';
import {
  normalizePlate,
  resolveVehicleRow,
  toVehicleFact,
  SCHED_TZ,
  todayInWinnipeg,
  scheduleDateLabel,
  addDaysISO,
} from './effieHelpers.js';
import {
  buildHoldProposal,
  buildRegisterHoldProposal,
  buildRegisterVehicleProposal,
  describeProposal,
  type HoldProposal,
  type RegisterHoldProposal,
  type RegisterVehicleProposal,
} from './holdProposal.js';
import {
  buildLostItemProposal,
  describeLostItemProposal,
  type LostItemProposal,
} from './lostItemProposal.js';
import { buildMemoryProposal, describeMemoryProposal, type MemoryProposal } from './memoryProposal.js';
import { buildReminderProposal, describeReminderProposal, type ReminderProposal } from './reminderProposal.js';
import {
  buildOverflowProposal,
  OVERFLOW_DESTINATIONS,
  type OverflowDestination,
  type OverflowLogProposal,
  type OverflowVehicle,
} from './overflowProposal.js';
import { formatSchedule, type ScheduleGroup } from './scheduleSummary.js';
import { lookupVehicleClass } from './vehicleClassCodex.js';
import { buildNavigateProposal, type NavigateProposal } from './navProposal.js';
import {
  formatMyShifts,
  formatLostFound,
  formatIssues,
  type MyShiftRow,
  type LostItem,
  type IssueRow,
} from './moduleReads.js';

/** Run the read-only vehicle lookup as the asking user (RLS-scoped via the JWT client). */
export async function executeLookup(supabase: SupabaseClient, rawPlate: string): Promise<VehicleLookupResult> {
  const match = await resolveVehicleRow(supabase, rawPlate);
  if (!match) return summarizeLookup(rawPlate, null, []);

  // ACTIVE holds block; RELEASED holds are worth-knowing context (esp. verbal
  // overrides). Embed the release detail so the answer can name who authorized it.
  const { data: holdRows, error: hErr } = await supabase
    .from('holds')
    .select(
      'hold_type, status, damage_description, flagged_at, flagged_by_name, releases(release_method, release_type, override_authorization)',
    )
    .eq('vehicle_id', match.id)
    .in('status', ['ACTIVE', 'RELEASED']);
  if (hErr) throw hErr;

  const holds: HoldFact[] = (holdRows ?? []).map((h) => {
    const rel = Array.isArray(h.releases) ? h.releases[0] : h.releases;
    return {
      holdType: h.hold_type,
      status: h.status,
      damageDescription: h.damage_description ?? '',
      flaggedAt: h.flagged_at,
      flaggedByName: h.flagged_by_name ?? null,
      release: rel
        ? { method: rel.release_method, type: rel.release_type, authorizedBy: rel.override_authorization ?? null }
        : null,
    };
  });

  return summarizeLookup(rawPlate, toVehicleFact(match), holds);
}

/**
 * Draft a hold for an EXISTING vehicle — resolves it and builds a proposal. NEVER
 * writes: the proposal goes to the client as a confirm card, and only a user tap
 * calls the real addHold. The tool result tells the model the draft is pending so
 * it won't claim the hold was created.
 */
export async function executeProposeHold(
  supabase: SupabaseClient,
  input: { plate?: string; hold_type?: string; damage_description?: string },
): Promise<{ toolResult: string; proposal: HoldProposal | null }> {
  const match = await resolveVehicleRow(supabase, input.plate ?? '');
  if (!match) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: `No vehicle on record for "${input.plate ?? ''}". It would have to be registered before a hold can be opened.`,
      }),
    };
  }
  const proposal = buildHoldProposal(
    { vehicleId: match.id, plate: match.license_plate, label: describeVehicle(toVehicleFact(match)) },
    (input.hold_type ?? 'damage').toLowerCase(),
    input.damage_description ?? '',
  );
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown to the user; do NOT say the hold is created, just that it is drafted for them to confirm',
    }),
  };
}

/**
 * Draft REGISTER + hold for an UNKNOWN plate — the AI gathered the vehicle details.
 * NEVER writes: the proposal goes to the client, and only a confirm tap calls the
 * real addVehicle then addHold. Refuses if the plate is already in the fleet (use
 * propose_hold instead).
 */
export async function executeProposeRegisterHold(
  supabase: SupabaseClient,
  input: {
    plate?: string;
    unit_number?: string;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    hold_type?: string;
    damage_description?: string;
  },
): Promise<{ toolResult: string; proposal: RegisterHoldProposal | null }> {
  const existing = await resolveVehicleRow(supabase, input.plate ?? '');
  if (existing) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: `"${input.plate ?? ''}" is already on record (${describeVehicle(toVehicleFact(existing))}). Use a normal hold, not registration.`,
      }),
    };
  }
  const missing = (['plate', 'unit_number', 'make', 'model', 'year', 'color'] as const).filter(
    (k) => input[k] === undefined || input[k] === null || `${input[k]}`.trim() === '',
  );
  if (missing.length > 0) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: `Still need: ${missing.join(', ')}. Ask the user for these before proposing.` }),
    };
  }
  const proposal = buildRegisterHoldProposal(
    {
      unitNumber: `${input.unit_number}`.trim(),
      plate: `${input.plate}`.trim().toUpperCase(),
      make: `${input.make}`.trim(),
      model: `${input.model}`.trim(),
      year: Number(input.year),
      color: `${input.color}`.trim(),
    },
    (input.hold_type ?? 'damage').toLowerCase(),
    input.damage_description ?? '',
  );
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is registered/held, just that it is drafted for them to confirm',
    }),
  };
}

/**
 * Draft a register-ONLY (new to fleet, no hold) for a plate not yet on record.
 * NEVER writes: the client calls addVehicle on the confirm tap. Mirrors the
 * register-and-hold guards (already-on-record, missing fields) minus the hold.
 */
export async function executeProposeRegisterVehicle(
  supabase: SupabaseClient,
  input: { plate?: string; unit_number?: string; make?: string; model?: string; year?: number; color?: string },
): Promise<{ toolResult: string; proposal: RegisterVehicleProposal | null }> {
  const existing = await resolveVehicleRow(supabase, input.plate ?? '');
  if (existing) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: `"${input.plate ?? ''}" is already on record (${describeVehicle(toVehicleFact(existing))}). Nothing to register.`,
      }),
    };
  }
  const missing = (['plate', 'unit_number', 'make', 'model', 'year', 'color'] as const).filter(
    (k) => input[k] === undefined || input[k] === null || `${input[k]}`.trim() === '',
  );
  if (missing.length > 0) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: `Still need: ${missing.join(', ')}. Read them off the key tag or ask the user before proposing.` }),
    };
  }
  // Tesla → the confirm card asks for cable/adapter at intake. Lowercase compare so
  // "TESLA"/"tesla" from a class-code lookup all resolve (mirrors ev-detection's isTeslaMake).
  const isTesla = `${input.make ?? ''}`.trim().toLowerCase() === 'tesla';
  const proposal = buildRegisterVehicleProposal(
    {
      unitNumber: `${input.unit_number}`.trim(),
      plate: `${input.plate}`.trim().toUpperCase(),
      make: `${input.make}`.trim(),
      model: `${input.model}`.trim(),
      year: Number(input.year),
      color: `${input.color}`.trim(),
    },
    isTesla,
  );
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is registered, just that it is drafted for them to confirm',
    }),
  };
}


/** Read-only: who's on which shift for a date ("who's closing with me tonight?"). */
export async function executeLookupSchedule(
  supabase: SupabaseClient,
  userId: string,
  input: { date?: string; shift_type?: string },
): Promise<string> {
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayInWinnipeg();
  const { data: shiftRows, error } = await supabase.from('shifts').select('user_id, shift_type').eq('date', date);
  if (error) throw error;
  // The asker's OWN shift, pulled before the self-filter below — so Effie can frame the
  // roster around it ("you're on mids, with you today: …") instead of asking the operator
  // what shift they're on. Undefined if they're not scheduled that day.
  const yourShift = (shiftRows ?? []).find((r) => r.user_id === userId)?.shift_type;

  // "Who's on WITH me" — exclude the asker from their own roster (this tool is always
  // "with me" framed). Mirrors the cockpit's teammatesOnToday self-filter. If the asker
  // is the only one on a shift, that group is empty → "nobody else", which is correct.
  const rows = (shiftRows ?? []).filter((r) => r.user_id !== userId);

  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
    for (const p of profs ?? []) names.set(p.id, p.name ?? 'Unknown');
  }

  const byType = new Map<string, string[]>();
  for (const r of rows) {
    const list = byType.get(r.shift_type) ?? [];
    list.push(names.get(r.user_id) ?? 'Unknown');
    byType.set(r.shift_type, list);
  }
  const groups: ScheduleGroup[] = [...byType].map(([shiftType, people]) => ({ shiftType, people }));
  // The teammates actually on the operator's OWN shift, computed from data (self already
  // excluded from `rows`). Empty = literally nobody else shares their shift — so Effie
  // states that from fact instead of grabbing an adjacent group to fill the gap.
  const yourShiftMates = yourShift ? (byType.get(yourShift) ?? []) : [];
  const shiftType = typeof input.shift_type === 'string' ? input.shift_type : undefined;
  return JSON.stringify({
    date,
    yourShift,
    yourShiftMates,
    groups,
    summary: formatSchedule(scheduleDateLabel(date), groups, shiftType),
  });
}


/** Read-only: the asking user's own upcoming shifts + rough scheduled hours. */
export async function executeLookupMyShift(supabase: SupabaseClient, userId: string, input: { days?: number }): Promise<string> {
  const days = Number.isFinite(input.days) ? Math.max(1, Math.min(31, Number(input.days))) : 7;
  const start = todayInWinnipeg();
  const end = addDaysISO(start, days);
  const { data, error } = await supabase
    .from('shifts')
    .select('date, shift_type')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw error;
  const rows: MyShiftRow[] = (data ?? []).map((r) => ({ dateLabel: scheduleDateLabel(r.date), shiftType: r.shift_type }));
  return JSON.stringify({ from: start, to: end, summary: formatMyShifts(rows) });
}

/** Read-only: current (unreturned) lost & found items, optionally text-matched. */
export async function executeSearchLostFound(supabase: SupabaseClient, input: { query?: string; status?: string }): Promise<string> {
  let q = supabase
    .from('lost_found')
    .select('description, location, found_at, license_plate, resolved_at')
    .order('found_at', { ascending: false });
  if (input.status !== 'all') q = q.is('resolved_at', null);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data ?? [];
  const query = (input.query ?? '').trim().toLowerCase();
  if (query) {
    const terms = query.split(/\s+/);
    rows = rows.filter((r) => {
      const hay = `${r.description ?? ''} ${r.location ?? ''} ${r.license_plate ?? ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  const items: LostItem[] = rows.map((r) => ({
    description: r.description ?? '',
    location: r.location ?? null,
    foundLabel: scheduleDateLabel((r.found_at ?? '').slice(0, 10)),
    plate: r.license_plate ?? null,
  }));
  return JSON.stringify({ count: items.length, summary: formatLostFound(items, query || undefined) });
}

/** Read-only: open (uncleared) facility issues from the Issue Log. */
export async function executeLookupIssues(supabase: SupabaseClient, input: { status?: string }): Promise<string> {
  let q = supabase
    .from('facility_issues')
    .select('title, severity, reported_at, cleared_at')
    .order('reported_at', { ascending: false });
  if (input.status !== 'all') q = q.is('cleared_at', null);
  const { data, error } = await q;
  if (error) throw error;
  const items: IssueRow[] = (data ?? []).map((r) => ({
    title: r.title,
    severity: r.severity,
    reportedLabel: scheduleDateLabel((r.reported_at ?? '').slice(0, 10)),
  }));
  return JSON.stringify({ count: items.length, summary: formatIssues(items) });
}

/** Read-only: vehicles currently on an ACTIVE hold, grouped by vehicle with their
 *  reasons — the "what's held and why" / "held for maintenance" list management asks
 *  for. Reads live from the holds table, so it answers across any day (the Movement
 *  Log view is day-scoped; this is not). Archived/out-of-fleet vehicles are dropped. */
export async function executeLookupHeld(supabase: SupabaseClient): Promise<string> {
  const { data: holds, error } = await supabase
    .from('holds')
    .select('vehicle_id, hold_type, mechanical_sub_type, damage_description, flagged_at')
    .eq('status', 'ACTIVE')
    .order('flagged_at', { ascending: true });
  if (error) throw error;

  const ids = [...new Set((holds ?? []).map((h) => h.vehicle_id))];
  const veh = new Map<string, string>(); // vehicleId → display id (unit ?? plate)
  if (ids.length > 0) {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, unit_number, license_plate, archived_at')
      .in('id', ids)
      .is('archived_at', null);
    for (const v of vehicles ?? []) veh.set(v.id, v.unit_number ?? v.license_plate ?? 'Unknown');
  }

  const byVehicle = new Map<string, string[]>();
  for (const h of holds ?? []) {
    const label = veh.get(h.vehicle_id);
    if (!label) continue; // archived / not found — out of fleet
    const reason =
      (h.damage_description ?? '').trim() ||
      [h.hold_type, h.mechanical_sub_type].filter(Boolean).join(' · ') ||
      'held';
    (byVehicle.get(label) ?? byVehicle.set(label, []).get(label)!).push(reason);
  }
  const held = [...byVehicle.entries()].map(([id, reasons]) => `${id} — ${reasons.join('; ')}`);
  return JSON.stringify({ count: held.length, held });
}

/** Read-only: where a vehicle was last SENT, from its trip history (vsa_trips).
 *  Answers "where's LFJ285?" ACROSS DAYS — the Movement Log SCREEN is day-scoped,
 *  but the trip DATA persists here. Trips key off free-text plate/unit (no
 *  vehicle_id), so we match in JS like resolveVehicleRow does — robust to how a
 *  plate was typed. Returns the latest trip plus a short recent history. */
export async function executeLookupVehicleLocation(supabase: SupabaseClient, rawPlate: string): Promise<string> {
  const norm = normalizePlate(rawPlate);
  if (!norm) return JSON.stringify({ found: false, note: 'No plate given.' });

  // Resolve the fleet row (if any) so we can also match on its canonical plate/unit,
  // not just what the operator typed.
  const vehicle = await resolveVehicleRow(supabase, rawPlate);
  const ids = new Set<string>([norm]);
  if (vehicle?.license_plate) ids.add(normalizePlate(vehicle.license_plate));
  if (vehicle?.unit_number) ids.add(normalizePlate(vehicle.unit_number));

  // The table grows slowly (a handful of runs a day); a generous recent window
  // covers many months, and matching in JS sidesteps free-text formatting drift.
  const { data: trips, error } = await supabase
    .from('vsa_trips')
    .select('vehicle_plate, vehicle_unit, depart_location, arrive_location, depart_time, trip_type, status')
    .order('depart_time', { ascending: false })
    .limit(500);
  if (error) throw error;

  const mine = (trips ?? []).filter(
    (t) => ids.has(normalizePlate(t.vehicle_plate ?? '')) || ids.has(normalizePlate(t.vehicle_unit ?? '')),
  );
  const label = vehicle?.unit_number ?? vehicle?.license_plate ?? rawPlate.trim();
  if (mine.length === 0) {
    return JSON.stringify({
      plate: label,
      found: false,
      tripCount: 0,
      note: 'No trip on record — never logged out, or logged under a different plate.',
    });
  }

  const toEntry = (t: (typeof mine)[number]) => ({
    destination: t.arrive_location ?? t.depart_location ?? 'unknown',
    when: scheduleDateLabel(new Date(t.depart_time).toLocaleDateString('en-CA', { timeZone: SCHED_TZ })),
    tripType: t.trip_type,
    status: t.status,
  });
  return JSON.stringify({
    plate: label,
    found: true,
    tripCount: mine.length,
    lastSent: toEntry(mine[0]),
    recent: mine.slice(0, 5).map(toEntry),
  });
}

/** Read-only: the overflow manifest — which vehicles are at which overflow spot,
 *  grouped, for the operator to copy into a reply. scope 'current' = latest send per
 *  vehicle across days (where everything is NOW — the "where are these vehicles?"
 *  email); scope 'shift' = only what was sent this shift-day (the end-of-shift report).
 *  Both dedup to the latest send per vehicle, so a moved car shows its newest spot. */
export async function executeLookupSent(supabase: SupabaseClient, input: { scope?: string }): Promise<string> {
  const scope = input.scope === 'shift' ? 'shift' : 'current';
  const { data, error } = await supabase
    .from('vsa_trips')
    .select('vehicle_plate, vehicle_unit, arrive_location, depart_time')
    .in('arrive_location', [...OVERFLOW_DESTINATIONS])
    .order('depart_time', { ascending: false })
    .limit(1000);
  if (error) throw error;

  let rows = data ?? [];
  if (scope === 'shift') {
    const today = shiftBusinessDate(new Date());
    rows = rows.filter((r) => r.depart_time && shiftBusinessDate(new Date(r.depart_time)) === today);
  }
  // Dedup to the latest send per vehicle (rows are newest-first). A returned/re-sent
  // car reflects its newest spot; there's no return-logging, so this is "last sent".
  const seen = new Set<string>();
  const byDest = new Map<string, string[]>();
  for (const r of rows) {
    const label = r.vehicle_unit || r.vehicle_plate || 'Unknown';
    const key = label.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const dest = r.arrive_location ?? 'Unknown';
    (byDest.get(dest) ?? byDest.set(dest, []).get(dest)!).push(label);
  }
  const groups = [...byDest.entries()].map(([destination, vehicles]) => ({
    destination,
    count: vehicles.length,
    vehicles,
  }));
  return JSON.stringify({ scope, total: seen.size, groups });
}

/**
 * Draft a found item for lost & found — NEVER writes. The proposal goes to the
 * client as a confirm card, and only a user tap calls the real addLostFoundItem
 * (which resolves the plate, stamps found_by/found_at, and uploads any photos).
 * Pure — no DB read needed; the AI parsed the item from the user's words.
 */
export function executeProposeLostItem(input: {
  description?: string;
  location?: string;
  license_plate?: string;
  notes?: string;
}): { toolResult: string; proposal: LostItemProposal | null } {
  const description = (input.description ?? '').trim();
  if (!description) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: 'Need a short description of the item first — ask the user what it is.' }),
    };
  }
  const proposal = buildLostItemProposal({
    description,
    location: input.location ?? null,
    licensePlate: input.license_plate ?? null,
    notes: input.notes ?? null,
  });
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeLostItemProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is logged, just that it is drafted for them to confirm',
    }),
  };
}

/** Draft a memory to save about the operator. Pure — the write happens on the
 *  client's confirm tap (insert into effie_memory), never here. */
export function executeProposeMemory(input: { content?: string }): { toolResult: string; proposal: MemoryProposal | null } {
  const proposal = buildMemoryProposal({ content: input.content ?? null });
  if (!proposal) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: 'Need the specific thing to remember first — ask the operator what to note.' }),
    };
  }
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeMemoryProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is saved, just that it is drafted for them to confirm',
    }),
  };
}

/** Draft a next-shift whiteboard reminder. Pure — the write (a shift_board note filed
 *  under the operator's next shift-day) happens on the client's confirm tap, never here. */
export function executeProposeReminder(input: { text?: string }): { toolResult: string; proposal: ReminderProposal | null } {
  const text = (input.text ?? '').trim();
  if (!text) {
    return {
      proposal: null,
      toolResult: JSON.stringify({ ok: false, reason: 'Need the reminder text first — ask the operator what to note for next shift.' }),
    };
  }
  const proposal = buildReminderProposal(text);
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      proposed: describeReminderProposal(proposal),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is saved, just that it is drafted to land on their next shift',
    }),
  };
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
 * Offer to navigate the user to a screen. NEVER writes or navigates — it returns a
 * confirm card the client renders; only the user's tap navigates (and even then, only
 * changes screens, no data write). Safe by construction.
 */
export function executeProposeNavigation(input: { destination?: string }): { toolResult: string; proposal: NavigateProposal | null } {
  const proposal = buildNavigateProposal(input.destination ?? '');
  if (!proposal) {
    return { proposal: null, toolResult: JSON.stringify({ ok: false, reason: 'Unknown destination — only offer a known screen.' }) };
  }
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      offered: proposal.label,
      awaiting: 'user confirmation — a confirm card is shown; do NOT say you navigated, just offer to take them there',
    }),
  };
}

/** Read-only: resolve a key-tag class code to make/model (pure codex lookup, no I/O). */
export function executeLookupVehicleClass(input: { code?: string }): string {
  const vc = lookupVehicleClass(input.code);
  if (!vc) {
    return JSON.stringify({
      ok: false,
      code: input.code ?? '',
      reason: 'Unknown class code — ask the user for the make and model.',
    });
  }
  return JSON.stringify({ ok: true, make: vc.make, model: vc.model });
}
