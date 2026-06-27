// "Hey FG" assistant — Tier 1 proxy (conversational vehicle lookup).
//
// The API key lives here, server-side, and NEVER reaches the browser. The FAB
// POSTs the conversation plus the signed-in crew member's Supabase access token;
// this function builds a per-request Supabase client WITH that token, so every
// read the AI makes is RLS-scoped to exactly what that user could see in the UI.
// No service-role key in this path — the AI reads as the real role.
//
// Flow: forward JWT → Claude (Haiku, read-only `lookup_vehicle` tool) → stream
// the answer back as plain text. Read-only by design; write tools are Tier 2,
// behind a human confirm gate.
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
// Explicit .js extension + co-located under api/_lib: Vercel TRANSPILES functions
// (doesn't bundle), so this import stays live at runtime as Node ESM — which needs
// the extension and a path inside the function dir. A cross-dir extensionless
// import (../src/...) resolves locally but ERR_MODULE_NOT_FOUNDs on Vercel.
import {
  summarizeLookup,
  describeVehicle,
  type HoldFact,
  type VehicleFact,
  type VehicleLookupResult,
} from './_lib/vehicleSummary.js';
import { isAllowed } from './_lib/assistantAccess.js';
import {
  buildHoldProposal,
  buildRegisterHoldProposal,
  describeProposal,
  type HoldProposal,
  type RegisterHoldProposal,
  type Proposal,
} from './_lib/holdProposal.js';
import {
  buildLostItemProposal,
  describeLostItemProposal,
  LOST_ITEM_LOCATIONS,
  type LostItemProposal,
} from './_lib/lostItemProposal.js';
import { formatSchedule, type ScheduleGroup } from './_lib/scheduleSummary.js';
import { parseImageDataUrl } from './_lib/imageData.js';
import { lookupVehicleClass } from './_lib/vehicleClassCodex.js';
import { buildNavigateProposal, NAV_DESTINATIONS, type NavigateProposal } from './_lib/navProposal.js';
import {
  formatMyShifts,
  formatLostFound,
  formatIssues,
  type MyShiftRow,
  type LostItem,
  type IssueRow,
} from './_lib/moduleReads.js';

// Minimal shapes of the Vercel Node serverless req/res — only what this handler
// touches. Hand-typed instead of depending on @vercel/node, whose transitive deps
// carried CVEs into the committed lockfile for what is purely build-time typing.
interface FgRequest {
  method?: string;
  headers: { authorization?: string };
  body?: { messages?: unknown; module?: unknown; image?: unknown };
}
interface FgResponse {
  headersSent: boolean;
  writableEnded: boolean;
  setHeader(name: string, value: string): void;
  status(code: number): FgResponse;
  json(body: unknown): void;
  end(chunk?: string): void;
}

const MODEL = 'claude-haiku-4-5'; // fast + cheap; a plate lookup needs no more.
// Tier 3: a damage photo gets stronger eyes. Vision turns route to Opus (ticket
// specced Opus 4.7+); text turns stay on Haiku. Cost is trivial — a handful of
// photos a shift — and a suggest-then-confirm read is worth the better model.
const VISION_MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 1024;
const MAX_TOOL_TURNS = 4; // a lookup answer is one tool call; cap the loop defensively.

const SYSTEM_PROMPT = `You are FG, the assistant for a vehicle rental wash-and-return operation. A VSA (the person working the lot) asks you about vehicles in plain language — usually "anything on <plate>?" or about a vehicle's status or holds.

Use the lookup_vehicle tool to check before answering — never guess or invent holds, damage, or vehicle details. Report only what the tool returns.

Answer like a colleague on the lot: short, direct, no preamble. If a vehicle is clean, say so plainly ("Nothing on LUR187 — Unit 1234, 2023 Camry"). If the plate isn't in the fleet, say it's not on record.

Lead with ACTIVE holds — those block the car. Then mention any RELEASED holds as context worth knowing, especially verbal overrides ("no active hold, but it had a paint scratch released on a verbal override by MK"). A released hold means it was flagged then cleared — history, not a current block. Don't bury an active hold under released history.

Use dates exactly as the tool gives them (e.g. "Jun 19, 2026") — never reformat or recompute them.

When the user wants to FLAG or HOLD a vehicle for damage ("there's a scratch on the bumper of LFJ438", "put a hold on LUR187, cracked windshield"), call propose_hold with the plate, the hold type (default "damage"), and a short damage description. This does NOT create the hold — it drafts a confirm card the user must tap. So phrase it as a draft awaiting their confirmation ("Drafted a damage hold on Unit 1234 for the bumper scuff — confirm below"), never as done.

For schedule questions ("who's closing with me tonight?", "who's on tomorrow?", "who am I working with on July 3?"), call lookup_schedule (it defaults to today; pass an ISO date in the CURRENT year for a named day, and shift_type like "closing" to narrow). Answer with the names, naturally ("Closing with you tonight: Geoff and Marycel."). If it returns no one, say the schedule shows nobody for that day — don't assume the lot is closed.

For the user's own shifts ("when am I working?", "am I closing this week?"), call lookup_my_shift. For lost & found ("any lost items?", "did anyone turn in a wallet?"), call search_lost_found. For facility issues ("any open issues?", "what's flagged?"), call lookup_issues. These are read-only — just report what they return.

When the user wants to LOG a found item into lost & found ("someone left a black wallet in the back seat of LUR224", "log a phone charger, found under the seat"), call propose_lost_item with a short description (required) and — only if the user mentioned them — the location (visor, front_seat, back_seat, trunk, under_seat, or other), the license plate, and any notes. Like a hold, this DRAFTS a confirm card the user must tap; phrase it as drafted awaiting confirmation, never as logged. Don't invent details the user didn't give.

If the plate is NOT on record and the user wants to hold it, it has to be registered first. Gather the missing vehicle details by ASKING the user — you need all of: unit number, make, model, year, colour (plus the damage). Ask only for what you don't have yet, in one short question. Once you have them all, call propose_register_and_hold (which also drafts a confirm card — never claim it's registered/held). Don't invent vehicle details; if the user doesn't know a field, ask again rather than guessing.

When the user attaches a PHOTO of vehicle damage, look at it carefully and identify what you see — the damage type and where it is (e.g. "deep scratch along the rear driver-side door", "cracked left tail light", "dent on the front bumper"). Then call propose_hold for the plate from the conversation, using your read of the photo as the damage_description and the best-fitting hold_type. This is a SUGGESTION the user confirms — phrase it as "From the photo, looks like <what you saw> — drafted a hold on <vehicle>, confirm below." If no plate has been given yet, ask which vehicle before proposing. NEVER guess or read a plate off the image; the plate comes from what the user told you. If the photo doesn't show vehicle damage, say so plainly instead of inventing a hold.

When the user attaches a photo of a KEY TAG (a printed vehicle tag showing fields like "Veh #", "Lic Plate", a class code line such as "CCVL 25", and a colour/body line such as "WHI 4DR"), read these off it:
- "Veh #" → the unit number (join the digit groups, e.g. "542 0427" → "5420427").
- "Lic Plate" → the license plate.
- The class line (e.g. "CCVL 25"): call lookup_vehicle_class with the code ("CCVL") to get make + model; the trailing number is the model YEAR ("25" → 2025).
- The colour/body line (e.g. "WHI 4DR"): the colour code (WHI = White, BLK = Black, SIL = Silver, GRY = Gray, BLU = Blue, RED = Red) and body style.
Once you have make + model (from lookup_vehicle_class), year, colour, unit, and plate, you can register and flag the vehicle. If the plate is already on record, just say so. If the user has described what's wrong with it, call propose_register_and_hold with all those fields plus the damage. If they haven't said what the issue is, ask — registering a vehicle in FG goes hand-in-hand with putting it on hold, so don't invent a damage reason. If lookup_vehicle_class returns unknown, ask the user for the make/model; never guess it.

When the user wants to IMPORT THE SCHEDULE from a photo ("I want to import the new schedule", "load the schedule from a photo"), that's done on the Schedule screen — confirm it's possible and call propose_navigation with destination "schedule-import" to OFFER to take them there. More generally, if they want to go to or do something that lives on another screen (lost & found, issue log, my shift, check-in, movement log), offer propose_navigation for the right destination. Phrase it as an offer — "That's on the Schedule screen — want me to take you there?" — and let the confirm card do the navigating. Never claim you navigated or performed the action yourself.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_vehicle',
    description:
      'Look up a fleet vehicle by license plate or unit number and report its identity, any ACTIVE holds (blocking), and any RELEASED holds (recent history/context). Use whenever the user asks whether there is "anything on" a vehicle, or about its status, holds, or damage.',
    input_schema: {
      type: 'object',
      properties: {
        plate: {
          type: 'string',
          description: 'License plate or unit number as the user said it, e.g. "LUR187" or "1234567".',
        },
      },
      required: ['plate'],
    },
  },
  {
    name: 'propose_hold',
    description:
      'Draft a damage/mechanical/detail hold on an existing fleet vehicle for the user to confirm. Use when the user wants to flag or hold a vehicle. This does NOT create the hold — it returns a draft the user must tap to confirm. Only works for a vehicle already on record.',
    input_schema: {
      type: 'object',
      properties: {
        plate: { type: 'string', description: 'License plate or unit number of the vehicle to hold.' },
        hold_type: {
          type: 'string',
          enum: ['damage', 'mechanical', 'detail', 'hail'],
          description: 'The kind of hold. Default "damage".',
        },
        damage_description: {
          type: 'string',
          description: 'Short description of what is wrong, e.g. "cracked windshield", "bumper scuff".',
        },
      },
      required: ['plate', 'damage_description'],
    },
  },
  {
    name: 'propose_register_and_hold',
    description:
      'Draft REGISTER + hold for a plate NOT yet in the fleet (the user wants to flag a vehicle that is not on record). Gather the vehicle details first, then call this. Does NOT write — returns a draft the user must tap to confirm.',
    input_schema: {
      type: 'object',
      properties: {
        plate: { type: 'string', description: 'License plate.' },
        unit_number: { type: 'string', description: 'Fleet unit number.' },
        make: { type: 'string', description: 'e.g. "Toyota".' },
        model: { type: 'string', description: 'e.g. "Camry".' },
        year: { type: 'integer', description: 'Model year, e.g. 2025.' },
        color: { type: 'string', description: 'e.g. "White".' },
        hold_type: { type: 'string', enum: ['damage', 'mechanical', 'detail', 'hail'], description: 'Default "damage".' },
        damage_description: { type: 'string', description: 'What is wrong, e.g. "cracked windshield".' },
      },
      required: ['plate', 'unit_number', 'make', 'model', 'year', 'color', 'damage_description'],
    },
  },
  {
    name: 'lookup_schedule',
    description:
      'Look up who is on which shift for a date — e.g. "who\'s closing with me tonight?". Works from any screen. Defaults to today; pass shift_type to narrow (e.g. "closing").',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date YYYY-MM-DD. Omit for today.' },
        shift_type: {
          type: 'string',
          enum: ['opening', 'mid', 'closing'],
          description: 'Narrow to one shift, e.g. "closing" for "who\'s closing".',
        },
      },
      required: [],
    },
  },
  {
    name: 'lookup_my_shift',
    description:
      "The asking user's OWN upcoming shifts + rough scheduled hours (\"when am I working?\", \"am I closing this week?\"). Defaults to the next 7 days. This is NOT the dollar pay estimate — that lives on the My Shift card.",
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Days ahead to include (default 7).' } },
      required: [],
    },
  },
  {
    name: 'search_lost_found',
    description:
      'Search the lost & found for current (not-yet-returned) items, optionally by text (description / location / plate). E.g. "any lost items?", "did anyone turn in a black wallet?".',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional text to match against description/location/plate.' },
        status: { type: 'string', enum: ['current', 'all'], description: 'Default current (unreturned).' },
      },
      required: [],
    },
  },
  {
    name: 'lookup_issues',
    description:
      'List open facility issues from the Issue Log ("any open issues?", "what\'s flagged?"). Defaults to open (uncleared).',
    input_schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['open', 'all'], description: 'Default open.' } },
      required: [],
    },
  },
  {
    name: 'propose_lost_item',
    description:
      'Draft a found item to log into lost & found for the user to confirm. Use when the user reports finding or turning in an item ("someone left a black wallet in the back seat of LUR224", "log a phone charger found under the seat"). This does NOT log it — it returns a draft the user must tap to confirm.',
    input_schema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Short description of the item, e.g. "black leather wallet", "USB-C phone charger".',
        },
        location: {
          type: 'string',
          enum: [...LOST_ITEM_LOCATIONS],
          description: 'Where in the vehicle it was found — only if the user said so.',
        },
        license_plate: { type: 'string', description: 'Plate or unit of the vehicle it was found in, if mentioned.' },
        notes: { type: 'string', description: 'Any extra context the user gives.' },
      },
      required: ['description'],
    },
  },
  {
    name: 'propose_navigation',
    description:
      'Offer to take the user to a screen for something that lives there. Use when they want to DO something the chat can\'t do inline — MOST IMPORTANTLY import a schedule from a photo (destination "schedule-import"). Returns a confirm card the user taps to navigate; do NOT pretend to do the action in chat yourself.',
    input_schema: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          enum: [...NAV_DESTINATIONS],
          description: 'Where to take them — "schedule-import" to import a schedule photo.',
        },
      },
      required: ['destination'],
    },
  },
  {
    name: 'lookup_vehicle_class',
    description:
      'Resolve a Hertz vehicle CLASS CODE (e.g. "CCVL", "CUES") to its make and model. Use when reading a key tag — the tag prints a class code plus model year (e.g. "CCVL 25"), not the make/model spelled out. Returns make + model; an unknown code means you should ask the user for the make/model rather than guess.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The class code from the tag, e.g. "CCVL" (a trailing year like "25" is fine).' },
      },
      required: ['code'],
    },
  },
];

/** Canonical plate form for matching — mirrors src/lib/vehicleByPlate.ts normalizePlate. */
function normalizePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** The minimal vehicle row the tools work from. */
interface VehicleRow {
  id: string;
  license_plate: string;
  unit_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
}

/** Resolve a plate/unit to its fleet row (RLS-scoped), matched in JS like the app does. */
async function resolveVehicleRow(supabase: SupabaseClient, rawPlate: string): Promise<VehicleRow | null> {
  const norm = normalizePlate(rawPlate);
  if (!norm) return null;
  // The fleet is small and plates aren't stored normalized, so match in JS the same
  // way the app does (allVehicles.find). RLS limits the rows to this user's reach.
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, license_plate, unit_number, make, model, year, color')
    .is('archived_at', null);
  if (error) throw error;
  return (
    (vehicles ?? []).find(
      (v) =>
        normalizePlate(v.license_plate ?? '') === norm ||
        (v.unit_number ? normalizePlate(v.unit_number) === norm : false),
    ) ?? null
  );
}

function toVehicleFact(row: VehicleRow): VehicleFact {
  return {
    plate: row.license_plate,
    unitNumber: row.unit_number ?? null,
    year: row.year ?? null,
    make: row.make ?? null,
    model: row.model ?? null,
    color: row.color ?? null,
  };
}

/** Run the read-only vehicle lookup as the asking user (RLS-scoped via the JWT client). */
async function executeLookup(supabase: SupabaseClient, rawPlate: string): Promise<VehicleLookupResult> {
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
async function executeProposeHold(
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
async function executeProposeRegisterHold(
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

const SCHED_TZ = 'America/Winnipeg'; // FG is a single-region YWG pilot
function todayInWinnipeg(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: SCHED_TZ }); // YYYY-MM-DD
}
function scheduleDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}
/** "Saturday, June 27, 2026" — weekday + full date so the model can anchor bare dates. */
function todayLabelWinnipeg(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** Read-only: who's on which shift for a date ("who's closing with me tonight?"). */
async function executeLookupSchedule(
  supabase: SupabaseClient,
  input: { date?: string; shift_type?: string },
): Promise<string> {
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : todayInWinnipeg();
  const { data: shiftRows, error } = await supabase.from('shifts').select('user_id, shift_type').eq('date', date);
  if (error) throw error;
  const rows = shiftRows ?? [];

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
  const shiftType = typeof input.shift_type === 'string' ? input.shift_type : undefined;
  return JSON.stringify({ date, groups, summary: formatSchedule(scheduleDateLabel(date), groups, shiftType) });
}

function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Read-only: the asking user's own upcoming shifts + rough scheduled hours. */
async function executeLookupMyShift(supabase: SupabaseClient, userId: string, input: { days?: number }): Promise<string> {
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
async function executeSearchLostFound(supabase: SupabaseClient, input: { query?: string; status?: string }): Promise<string> {
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
async function executeLookupIssues(supabase: SupabaseClient, input: { status?: string }): Promise<string> {
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

/**
 * Draft a found item for lost & found — NEVER writes. The proposal goes to the
 * client as a confirm card, and only a user tap calls the real addLostFoundItem
 * (which resolves the plate, stamps found_by/found_at, and uploads any photos).
 * Pure — no DB read needed; the AI parsed the item from the user's words.
 */
function executeProposeLostItem(input: {
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

/**
 * Offer to navigate the user to a screen. NEVER writes or navigates — it returns a
 * confirm card the client renders; only the user's tap navigates (and even then, only
 * changes screens, no data write). Safe by construction.
 */
function executeProposeNavigation(input: { destination?: string }): { toolResult: string; proposal: NavigateProposal | null } {
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
function executeLookupVehicleClass(input: { code?: string }): string {
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

export default async function handler(req: FgRequest, res: FgResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Everything is wrapped: a throw anywhere — env read, createClient, the
  // Anthropic constructor, the tool loop — is logged (Vercel runtime logs) AND
  // returned as JSON for the FAB to show. Nothing escapes as a blind platform 500.
  //
  // Buffer-then-send (not res.write streaming): a Vercel serverless res doesn't
  // reliably accept writes from inside an SDK event listener — that throw is
  // uncaught and 500s the function. Tier 1 answers are a sentence or two, so we
  // run the loop, collect the final turn's text, and send it once.
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
      res.status(500).json({ error: 'Assistant is not configured.' });
      return;
    }

    // Require the caller's Supabase session — reads run as this crew member (RLS).
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Cost gate: this runs on a personal Anthropic key, so the assistant is gated to
    // the allowlisted account(s). Validate the JWT (getUser verifies the signature —
    // a forged token can't pass and reach a billable Claude call) and check the
    // employee ID (the part before @fleet-garage.internal) against the allowlist.
    // Empty allowlist = open to all authed.
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7));
    if (userErr || !userData.user) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const employeeId = (userData.user.email ?? '').split('@')[0];
    if (!isAllowed(employeeId, process.env.VITE_FG_ASSISTANT_ALLOWED_EMPLOYEE_IDS)) {
      res.status(403).json({ error: "The assistant isn't enabled for this account." });
      return;
    }

    const messages = (req.body?.messages ?? []) as Anthropic.MessageParam[];
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'No messages provided.' });
      return;
    }

    const anthropic = new Anthropic({ apiKey });
    const convo: Anthropic.MessageParam[] = [...messages];

    // Context-awareness: the FAB sends the screen the user is on. Tell the model so
    // it can be relevant ("you're on My Shift") — but it can still answer about any
    // module (the schedule/vehicle tools work from anywhere).
    const moduleName = typeof req.body?.module === 'string' ? req.body.module : '';
    const todayISO = todayInWinnipeg();
    const contextBits = [
      `Today is ${todayLabelWinnipeg(todayISO)} (${todayISO}, America/Winnipeg). When the user names a date or day with no year ("July 3", "this Friday", "tomorrow"), resolve it to the CURRENT year / the nearest such day — never a past year.`,
    ];
    if (moduleName) {
      contextBits.push(`The user is currently on the "${moduleName}" screen — be relevant to it, but answer anything they ask.`);
    }
    const system = `${SYSTEM_PROMPT}\n\nContext: ${contextBits.join(' ')}`;

    // Tier 3 vision: a damage photo (base64 data URL) rides alongside the turns.
    // Attach it to the latest user message as an image block, and give that request
    // the vision model. Parsed defensively — a bad value is just ignored.
    const image = parseImageDataUrl(req.body?.image);
    if (image && convo.length > 0) {
      const last = convo[convo.length - 1];
      if (last.role === 'user' && typeof last.content === 'string') {
        const text = last.content.trim();
        last.content = [
          ...(text ? [{ type: 'text', text } as Anthropic.TextBlockParam] : []),
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
        ];
      }
    }
    const model = image ? VISION_MODEL : MODEL;

    let answer = '';
    let proposal: Proposal | null = null; // a drafted hold / register+hold to confirm, if any
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const message = await anthropic.messages.create({
        model,
        max_tokens: MAX_TOKENS,
        system,
        tools: TOOLS,
        messages: convo,
      });

      if (message.stop_reason !== 'tool_use') {
        answer = message.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        break;
      }

      const toolUses = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      convo.push({ role: 'assistant', content: message.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        let content: string;
        try {
          if (tu.name === 'propose_hold') {
            const out = await executeProposeHold(
              supabase,
              tu.input as { plate?: string; hold_type?: string; damage_description?: string },
            );
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'propose_register_and_hold') {
            const out = await executeProposeRegisterHold(
              supabase,
              tu.input as Parameters<typeof executeProposeRegisterHold>[1],
            );
            if (out.proposal) proposal = out.proposal;
            content = out.toolResult;
          } else if (tu.name === 'lookup_schedule') {
            content = await executeLookupSchedule(supabase, tu.input as { date?: string; shift_type?: string });
          } else if (tu.name === 'lookup_my_shift') {
            content = await executeLookupMyShift(supabase, userData.user.id, tu.input as { days?: number });
          } else if (tu.name === 'search_lost_found') {
            content = await executeSearchLostFound(supabase, tu.input as { query?: string; status?: string });
          } else if (tu.name === 'lookup_issues') {
            content = await executeLookupIssues(supabase, tu.input as { status?: string });
          } else if (tu.name === 'propose_navigation') {
            const out = executeProposeNavigation(tu.input as { destination?: string });
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'lookup_vehicle_class') {
            content = executeLookupVehicleClass(tu.input as { code?: string });
          } else if (tu.name === 'propose_lost_item') {
            const out = executeProposeLostItem(
              tu.input as { description?: string; location?: string; license_plate?: string; notes?: string },
            );
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else {
            const plate = (tu.input as { plate?: string }).plate ?? '';
            content = JSON.stringify(await executeLookup(supabase, plate));
          }
        } catch {
          content = JSON.stringify({ error: 'That action failed — could not read vehicle records.' });
        }
        results.push({ type: 'tool_result', tool_use_id: tu.id, content });
      }
      convo.push({ role: 'user', content: results });
    }

    // Envelope: text answer + an optional drafted hold the client renders as a
    // confirm card. The proxy never writes — the write happens on the user's tap.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ text: answer || '(no answer)', proposal });
  } catch (err) {
    console.error('[fg-chat] handler error:', err);
    res.status(500).json({ error: `Assistant error: ${err instanceof Error ? err.message : String(err)}` });
  }
}
