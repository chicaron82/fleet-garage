// Schedule-photo parse endpoint. READ-ONLY: it reads a printed staff-schedule photo and
// returns a typed grid (ParsedSchedule) — it writes nothing. Handles a single week OR
// multiple weeks stacked, any day order, real times, and resolves each cell to an ISO
// date (years inferred from today). Structured output is forced via one required tool.
// Same key/JWT/allowlist gate as fg-chat.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { isAllowed } from './_lib/assistantAccess.js';
import { parseDocumentDataUrl } from './_lib/imageData.js';
import { isAvailabilityError } from './_lib/modelFallback.js';
import type { ParsedSchedule, ParsedShiftType } from './_lib/scheduleParse.js';
import { buildScheduleRequest, FALLBACK_VISION_MODEL, VISION_MODEL } from './_lib/scheduleVisionRequest.js';
import { priceUsage } from './_lib/apiSpend.js';
import { recordSpend } from './_lib/recordSpend.js';

interface FgRequest {
  method?: string;
  headers: { authorization?: string };
  body?: { image?: unknown };
}
interface FgResponse {
  setHeader(name: string, value: string): void;
  status(code: number): FgResponse;
  json(body: unknown): void;
}

// Both attempts share a budget that fits inside the Vercel function ceiling (5m). Note the
// SDK's own default timeout is 10m — double the ceiling — so without these an outright HANG
// died as a platform error the app could never explain.
const PRIMARY_TIMEOUT_MS = 150_000;
const FALLBACK_TIMEOUT_MS = 90_000;

interface RawCell { date?: string; startTime?: string; endTime?: string; type?: ParsedShiftType; raw?: string }
interface RawStaff { name?: string; cells?: RawCell[] }

/** Normalize the tool output to ParsedSchedule — empty strings → null, defensive defaults. */
function toSchedule(input: unknown): ParsedSchedule {
  const staff = (input as { staff?: RawStaff[] })?.staff ?? [];
  return {
    staff: staff.map((s) => ({
      name: (s.name ?? '').trim(),
      cells: (s.cells ?? []).map((c) => ({
        date: c.date?.trim() || null,
        type: c.type ?? 'unknown',
        startTime: c.startTime?.trim() || null,
        endTime: c.endTime?.trim() || null,
        raw: c.raw ?? '',
      })),
    })),
  };
}

export default async function handler(req: FgRequest, res: FgResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
      res.status(500).json({ error: 'Assistant is not configured.' });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
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

    const doc = parseDocumentDataUrl(req.body?.image);
    if (!doc) {
      res.status(400).json({ error: 'A schedule photo or PDF is required.' });
      return;
    }
    // Image → image block; PDF → a native document block (Claude reads the PDF directly,
    // far crisper than a photo of the same sheet).
    const docBlock: Anthropic.ContentBlockParam =
      doc.kind === 'pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.data } }
        : { type: 'image', source: { type: 'base64', media_type: doc.mediaType, data: doc.data } };

    const anthropic = new Anthropic({ apiKey });
    // MUST be sent with .stream(), never .create() — see SDK_NONSTREAMING_MAX_TOKENS.
    const request = buildScheduleRequest(docBlock);

    let message: Anthropic.Message;
    let degraded = false;
    try {
      message = await anthropic.messages
        .stream(request, {
          timeout: PRIMARY_TIMEOUT_MS,
          maxRetries: 0, // the fallback below is the retry — don't spend the budget twice over
        })
        .finalMessage();
    } catch (err) {
      if (!isAvailabilityError(err)) throw err; // config/request errors: fail loudly, don't burn a second call
      console.warn('[fg-schedule-parse] primary model unavailable, falling back:', err);
      degraded = true;
      message = await anthropic.messages
        .stream({ ...request, model: FALLBACK_VISION_MODEL }, { timeout: FALLBACK_TIMEOUT_MS, maxRetries: 1 })
        .finalMessage();
    }

    // Credit tracker: price against whichever model actually answered — the fallback is a
    // different rate, and a degraded read that goes unrecorded (or worse, gets priced as the
    // primary) would quietly skew the balance in the exact moment things are already going wrong.
    void recordSpend(supabase, 'fg-schedule-parse', [
      priceUsage(degraded ? FALLBACK_VISION_MODEL : VISION_MODEL, message.usage),
    ]);

    if (message.stop_reason === 'max_tokens') {
      res.status(502).json({ error: 'This schedule was too large to read in one pass — try a photo covering fewer weeks.' });
      return;
    }
    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) {
      res.status(502).json({ error: "Couldn't read a schedule from that photo." });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    // `degraded` tells the operator a backup model read this — silent degradation is worse
    // than none when the whole safety net is him eyeballing rows against the photo.
    res.status(200).json({ schedule: toSchedule(toolUse.input), degraded });
  } catch (err) {
    console.error('[fg-schedule-parse] handler error:', err);
    res.status(500).json({ error: `Parse error: ${err instanceof Error ? err.message : String(err)}` });
  }
}
