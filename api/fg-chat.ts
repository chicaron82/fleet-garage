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
import { formatSchedule, type ScheduleGroup } from './_lib/scheduleSummary.js';

// Minimal shapes of the Vercel Node serverless req/res — only what this handler
// touches. Hand-typed instead of depending on @vercel/node, whose transitive deps
// carried CVEs into the committed lockfile for what is purely build-time typing.
interface FgRequest {
  method?: string;
  headers: { authorization?: string };
  body?: { messages?: unknown; module?: unknown };
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
const MAX_TOKENS = 1024;
const MAX_TOOL_TURNS = 4; // a lookup answer is one tool call; cap the loop defensively.

const SYSTEM_PROMPT = `You are FG, the assistant for a vehicle rental wash-and-return operation. A VSA (the person working the lot) asks you about vehicles in plain language — usually "anything on <plate>?" or about a vehicle's status or holds.

Use the lookup_vehicle tool to check before answering — never guess or invent holds, damage, or vehicle details. Report only what the tool returns.

Answer like a colleague on the lot: short, direct, no preamble. If a vehicle is clean, say so plainly ("Nothing on LUR187 — Unit 1234, 2023 Camry"). If the plate isn't in the fleet, say it's not on record.

Lead with ACTIVE holds — those block the car. Then mention any RELEASED holds as context worth knowing, especially verbal overrides ("no active hold, but it had a paint scratch released on a verbal override by MK"). A released hold means it was flagged then cleared — history, not a current block. Don't bury an active hold under released history.

Use dates exactly as the tool gives them (e.g. "Jun 19, 2026") — never reformat or recompute them.

When the user wants to FLAG or HOLD a vehicle for damage ("there's a scratch on the bumper of LFJ438", "put a hold on LUR187, cracked windshield"), call propose_hold with the plate, the hold type (default "damage"), and a short damage description. This does NOT create the hold — it drafts a confirm card the user must tap. So phrase it as a draft awaiting their confirmation ("Drafted a damage hold on Unit 1234 for the bumper scuff — confirm below"), never as done.

For schedule questions ("who's closing with me tonight?", "who's on tomorrow?"), call lookup_schedule (it defaults to today; pass shift_type like "closing" to narrow). Answer with the names, naturally ("Closing with you tonight: Geoff and Marycel.").

If the plate is NOT on record and the user wants to hold it, it has to be registered first. Gather the missing vehicle details by ASKING the user — you need all of: unit number, make, model, year, colour (plus the damage). Ask only for what you don't have yet, in one short question. Once you have them all, call propose_register_and_hold (which also drafts a confirm card — never claim it's registered/held). Don't invent vehicle details; if the user doesn't know a field, ask again rather than guessing.`;

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
    const system = moduleName
      ? `${SYSTEM_PROMPT}\n\nContext: the user is currently on the "${moduleName}" screen. Be relevant to it, but answer anything they ask.`
      : SYSTEM_PROMPT;

    let answer = '';
    let proposal: Proposal | null = null; // a drafted hold / register+hold to confirm, if any
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const message = await anthropic.messages.create({
        model: MODEL,
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
