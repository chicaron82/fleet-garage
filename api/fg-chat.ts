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
  type HoldFact,
  type VehicleFact,
  type VehicleLookupResult,
} from './_lib/vehicleSummary.js';

// Minimal shapes of the Vercel Node serverless req/res — only what this handler
// touches. Hand-typed instead of depending on @vercel/node, whose transitive deps
// carried CVEs into the committed lockfile for what is purely build-time typing.
interface FgRequest {
  method?: string;
  headers: { authorization?: string };
  body?: { messages?: unknown };
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

Use dates exactly as the tool gives them (e.g. "Jun 19, 2026") — never reformat or recompute them.`;

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
];

/** Canonical plate form for matching — mirrors src/lib/vehicleByPlate.ts normalizePlate. */
function normalizePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** Run the read-only vehicle lookup as the asking user (RLS-scoped via the JWT client). */
async function executeLookup(supabase: SupabaseClient, rawPlate: string): Promise<VehicleLookupResult> {
  const norm = normalizePlate(rawPlate);
  if (!norm) return summarizeLookup(rawPlate, null, []);

  // The fleet is small and plates aren't stored normalized, so match in JS the
  // same way the app does (allVehicles.find). RLS limits the rows to this user's reach.
  const { data: vehicles, error: vErr } = await supabase
    .from('vehicles')
    .select('id, license_plate, unit_number, make, model, year, color')
    .is('archived_at', null);
  if (vErr) throw vErr;

  const match = (vehicles ?? []).find(
    (v) =>
      normalizePlate(v.license_plate ?? '') === norm ||
      (v.unit_number ? normalizePlate(v.unit_number) === norm : false),
  );
  if (!match) return summarizeLookup(rawPlate, null, []);

  const vehicle: VehicleFact = {
    plate: match.license_plate,
    unitNumber: match.unit_number ?? null,
    year: match.year ?? null,
    make: match.make ?? null,
    model: match.model ?? null,
    color: match.color ?? null,
  };

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

  return summarizeLookup(rawPlate, vehicle, holds);
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

    const messages = (req.body?.messages ?? []) as Anthropic.MessageParam[];
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'No messages provided.' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anthropic = new Anthropic({ apiKey });
    const convo: Anthropic.MessageParam[] = [...messages];

    let answer = '';
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
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
          const plate = (tu.input as { plate?: string }).plate ?? '';
          content = JSON.stringify(await executeLookup(supabase, plate));
        } catch {
          content = JSON.stringify({ error: 'Lookup failed — could not read vehicle records.' });
        }
        results.push({ type: 'tool_result', tool_use_id: tu.id, content });
      }
      convo.push({ role: 'user', content: results });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).end(answer || '(no answer)');
  } catch (err) {
    console.error('[fg-chat] handler error:', err);
    res.status(500).json({ error: `Assistant error: ${err instanceof Error ? err.message : String(err)}` });
  }
}
