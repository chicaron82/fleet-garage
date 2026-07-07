// Effie (PerZeePhone) — the Fleet Garage shop assistant proxy.
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
import { createClient } from '@supabase/supabase-js';
// Explicit .js extension + co-located under api/_lib: Vercel TRANSPILES functions
// (doesn't bundle), so this import stays live at runtime as Node ESM — which needs
// the extension and a path inside the function dir. A cross-dir extensionless
// import (../src/...) resolves locally but ERR_MODULE_NOT_FOUNDs on Vercel.
import { isAllowed } from './_lib/assistantAccess.js';
import { SYSTEM_PROMPT } from './_lib/effiePrompt.js';
import { TOOLS } from './_lib/effieTools.js';
import { todayInWinnipeg, todayLabelWinnipeg } from './_lib/effieHelpers.js';
import { PHOTO_CONTEXTS, type PhotoContext } from './_lib/photoRequest.js';
import { type Proposal } from './_lib/holdProposal.js';
import { parseImageDataUrl } from './_lib/imageData.js';
import {
  executeLookup,
  executeProposeHold,
  executeProposeRegisterHold,
  executeProposeRegisterVehicle,
  executeLookupSchedule,
  executeLookupMyShift,
  executeSearchLostFound,
  executeLookupIssues,
  executeLookupHeld,
  executeLookupVehicleLocation,
  executeLookupSent,
  executeProposeLostItem,
  executeProposeMemory,
  executeProposeReminder,
  executeProposeOverflowLog,
  executeProposeNavigation,
  executeLookupVehicleClass,
} from './_lib/effieExecutors.js';

// Minimal shapes of the Vercel Node serverless req/res — only what this handler
// touches. Hand-typed instead of depending on @vercel/node, whose transitive deps
// carried CVEs into the committed lockfile for what is purely build-time typing.
interface FgRequest {
  method?: string;
  headers: { authorization?: string };
  body?: { messages?: unknown; module?: unknown; image?: unknown; callSign?: unknown };
}
interface FgResponse {
  headersSent: boolean;
  writableEnded: boolean;
  setHeader(name: string, value: string): void;
  status(code: number): FgResponse;
  json(body: unknown): void;
  end(chunk?: string): void;
}

// Effie outgrew "just a plate lookup" — she now routes ~18 tools, interprets inventory
// sheets, chains keytag→class→register, and reasons over schedule/overflow/memory. Sonnet
// handles that multi-step routing + narration far more reliably than Haiku (see the
// 2026-07-06 schedule-routing saga). The system prompt is cached (below), so at single-
// operator volume the cost delta is small.
const MODEL = 'claude-sonnet-4-6';
// Tier 3: a damage photo gets stronger eyes. Vision turns route to Opus (ticket
// specced Opus 4.7+); text turns stay on Haiku. Cost is trivial — a handful of
// photos a shift — and a suggest-then-confirm read is worth the better model.
const VISION_MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 1024;
const MAX_TOOL_TURNS = 4; // a lookup answer is one tool call; cap the loop defensively.

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
    const callSign = typeof req.body?.callSign === 'string' ? req.body.callSign.trim() : '';
    const todayISO = todayInWinnipeg();
    const contextBits = [
      `Today is ${todayLabelWinnipeg(todayISO)} (${todayISO}, America/Winnipeg). When the user names a date or day with no year ("July 3", "this Friday", "tomorrow"), resolve it to the CURRENT year / the nearest such day — never a past year.`,
    ];
    if (callSign) contextBits.push(`Address the operator as "${callSign}" — not by their profile name.`);
    if (moduleName) contextBits.push(`The user is currently on the "${moduleName}" screen — be relevant to it, but answer anything they ask.`);
    // Effie's durable memory (#2): inject the operator's saved facts so she personalizes.
    const { data: memRows } = await supabase
      .from('effie_memory')
      .select('content')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false })
      .limit(20); // bound the context — a fact store, not a transcript
    const memories = (memRows ?? []).map((m) => m.content).filter((c): c is string => !!c);
    if (memories.length > 0) {
      contextBits.push(`Standing notes the operator asked you to remember (use them naturally; don't recite the list): ${memories.map((m) => `• ${m}`).join(' ')}`);
    }
    // The system prompt is large + static; the Context tail (screen + saved memories) is small
    // + per-request. cache_control on the static block caches tools + prompt across turns, so
    // only the tiny Context tail and the messages are re-billed at full rate each call.
    const system: Anthropic.TextBlockParam[] = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `Context: ${contextBits.join(' ')}` },
    ];

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
    let photoRequest: PhotoContext | null = null; // an inline upload button to show, if Effie asked for a photo
    const debugTools: string[] = []; // TEMP instrument — which tools ran this request
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
        debugTools.push(tu.name); // TEMP instrument
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
          } else if (tu.name === 'propose_register_vehicle') {
            const out = await executeProposeRegisterVehicle(
              supabase,
              tu.input as Parameters<typeof executeProposeRegisterVehicle>[1],
            );
            if (out.proposal) proposal = out.proposal;
            content = out.toolResult;
          } else if (tu.name === 'lookup_schedule') {
            content = await executeLookupSchedule(supabase, userData.user.id, tu.input as { date?: string; shift_type?: string });
          } else if (tu.name === 'lookup_my_shift') {
            content = await executeLookupMyShift(supabase, userData.user.id, tu.input as { days?: number });
          } else if (tu.name === 'search_lost_found') {
            content = await executeSearchLostFound(supabase, tu.input as { query?: string; status?: string });
          } else if (tu.name === 'lookup_issues') {
            content = await executeLookupIssues(supabase, tu.input as { status?: string });
          } else if (tu.name === 'lookup_held') {
            content = await executeLookupHeld(supabase);
          } else if (tu.name === 'lookup_vehicle_location') {
            content = await executeLookupVehicleLocation(supabase, (tu.input as { plate?: string }).plate ?? '');
          } else if (tu.name === 'lookup_sent') {
            content = await executeLookupSent(supabase, tu.input as { scope?: string });
          } else if (tu.name === 'propose_navigation') {
            const out = executeProposeNavigation(tu.input as { destination?: string });
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'request_photo') {
            const ctx = (tu.input as { context?: string }).context;
            if (ctx && (PHOTO_CONTEXTS as readonly string[]).includes(ctx)) photoRequest = ctx as PhotoContext;
            content = JSON.stringify({
              ok: true,
              note: 'An inline upload button is now shown in your reply. Ask the operator for the photo in one short line; do NOT describe the button itself.',
            });
          } else if (tu.name === 'lookup_vehicle_class') {
            content = executeLookupVehicleClass(tu.input as { code?: string });
          } else if (tu.name === 'propose_lost_item') {
            const out = executeProposeLostItem(
              tu.input as { description?: string; location?: string; license_plate?: string; notes?: string },
            );
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'propose_memory') {
            const out = executeProposeMemory(tu.input as { content?: string });
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'propose_reminder') {
            const out = executeProposeReminder(tu.input as { text?: string });
            if (out.proposal) proposal = out.proposal; // captured out-of-band for the client
            content = out.toolResult;
          } else if (tu.name === 'propose_overflow_log') {
            const out = await executeProposeOverflowLog(supabase, tu.input as { plates?: string[]; destination?: string });
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
    const dbg = `\n\n⟨debug: tools=[${debugTools.join(', ')}] proposal=${proposal ? proposal.kind : 'null'}⟩`;
    res.status(200).json({ text: (answer || '(no answer)') + dbg, proposal, photoRequest });
  } catch (err) {
    console.error('[fg-chat] handler error:', err);
    res.status(500).json({ error: `Assistant error: ${err instanceof Error ? err.message : String(err)}` });
  }
}
