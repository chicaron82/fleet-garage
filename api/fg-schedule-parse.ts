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

const VISION_MODEL = 'claude-opus-4-8'; // dense, multi-week grid → the strong vision model.
// Availability backup only. Sonnet is a real fidelity step down on a cramped, angled,
// pen-marked grid — accepted because this endpoint WRITES NOTHING: every row is verified
// against the photo in the preview before the operator confirms. A degraded read beats a
// dead import; the client is told which model read it so rows get a harder look.
const FALLBACK_VISION_MODEL = 'claude-sonnet-5';
const TZ = 'America/Winnipeg';

// The Vercel function ceiling here is 5m and the SDK's own default timeout is 10m — so an
// Opus request that HANGS (rather than erroring) would blow the platform limit and surface
// as an infrastructure error page, never as an app message. These budgets keep both
// attempts inside the ceiling; the fallback IS the retry, hence maxRetries 0 on the primary.
const PRIMARY_TIMEOUT_MS = 150_000;
const FALLBACK_TIMEOUT_MS = 90_000;

function todayParts(): { iso: string; label: string } {
  const iso = new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  const [y, m, d] = iso.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return { iso, label };
}

function buildPrompt(todayIso: string, todayLabel: string): string {
  return `You are reading a printed staff WORK SCHEDULE (a photo or a PDF) — people in rows, days in columns, each cell a shift. It may be a SINGLE week, or MULTIPLE weeks STACKED vertically (each week with its own day/date header row). Extract every person and ALL of their cells.

Today is ${todayLabel} (${todayIso}). Use it to resolve YEARS: the sheet shows dates like "17-Apr" or a header like "JUNE 22 - JUNE 28" with no year — assume the year that puts the date nearest to today (usually the current year).

Return ONE row per person, merging ALL their cells across every week shown (a person who appears in each weekly sub-table becomes one row). For each cell:
- "date": the cell's calendar date as ISO YYYY-MM-DD. Read it from the column's printed date (e.g. "17-Apr" → 2026-04-17), or derive it from the week's header range + the day-of-week column. If you genuinely can't tell, use "".
- "startTime"/"endTime": the shift's times as 24-hour "HH:MM" ("0645-1515" → "06:45"/"15:15"; "07:00 - 12:00" → "07:00"/"12:00"). For a day off or vacation, use "" for both.
- "type": classify (for colour only) — opening (early start), mid, closing (late end), day-off (an "OFF" cell or a BLANK cell), pto (VAC / vacation), sick, or unknown if unsure.
- "raw": exactly what is printed in the cell ("0645-1515", "OFF", "VAC", "", etc.).

Read each person's name as printed but DROP role markers like "(PT)" and labels like "UTILITY" — just the name. Call report_schedule with everything you can read — even if the photo is angled, low-contrast, or has pen marks / crossed-out cells over part of it, push through and read the rest (a crossed-out week is still that week's schedule). Only return an empty staff array if the image genuinely is NOT a staff schedule at all.`;
}

const REPORT_TOOL: Anthropic.Tool = {
  name: 'report_schedule',
  description: 'Report the staff schedule grid parsed from the photo.',
  input_schema: {
    type: 'object',
    properties: {
      staff: {
        type: 'array',
        description: 'One entry per person, merging all their cells across every week shown.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: "The person's name as printed, minus role markers like (PT)/UTILITY." },
            cells: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'ISO date YYYY-MM-DD for this cell ("" if undeterminable).' },
                  startTime: { type: 'string', description: '24h HH:MM start, "" for off/vacation.' },
                  endTime: { type: 'string', description: '24h HH:MM end, "" for off/vacation.' },
                  type: {
                    type: 'string',
                    enum: ['opening', 'mid', 'closing', 'day-off', 'pto', 'sick', 'unknown'],
                    description: 'Classification for colour.',
                  },
                  raw: { type: 'string', description: 'Exact cell content (times / OFF / VAC / blank).' },
                },
                required: ['date', 'type', 'raw'],
              },
            },
          },
          required: ['name', 'cells'],
        },
      },
    },
    required: ['staff'],
  },
};

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

    const { iso, label } = todayParts();
    const anthropic = new Anthropic({ apiKey });
    // Sized off cell-count math, not feel: ~45-50 tokens/cell × a worst-realistic-case
    // 4-week × 14-staff sheet (≈390 cells) ≈ 19.5k tokens. 32k leaves real headroom.
    const request: Anthropic.MessageCreateParamsNonStreaming = {
      model: VISION_MODEL,
      max_tokens: 32000,
      system: buildPrompt(iso, label),
      tools: [REPORT_TOOL],
      tool_choice: { type: 'tool', name: 'report_schedule' },
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Parse this staff schedule.' }, docBlock],
        },
      ],
    };

    let message: Anthropic.Message;
    let degraded = false;
    try {
      message = await anthropic.messages.create(request, {
        timeout: PRIMARY_TIMEOUT_MS,
        maxRetries: 0, // the fallback below is the retry — don't spend the budget twice over
      });
    } catch (err) {
      if (!isAvailabilityError(err)) throw err; // config/request errors: fail loudly, don't burn a second call
      console.warn('[fg-schedule-parse] primary model unavailable, falling back:', err);
      degraded = true;
      message = await anthropic.messages.create(
        { ...request, model: FALLBACK_VISION_MODEL },
        { timeout: FALLBACK_TIMEOUT_MS, maxRetries: 1 },
      );
    }

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
