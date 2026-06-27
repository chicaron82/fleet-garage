// Schedule-photo parse endpoint. READ-ONLY: it reads a printed staff-schedule photo and
// returns a typed grid (ParsedSchedule) — it writes nothing. Handles a single week OR
// multiple weeks stacked, any day order, real times, and resolves each cell to an ISO
// date (years inferred from today). Structured output is forced via one required tool.
// Same key/JWT/allowlist gate as fg-chat.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { isAllowed } from './_lib/assistantAccess.js';
import { parseImageDataUrl } from './_lib/imageData.js';
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
const TZ = 'America/Winnipeg';

function todayParts(): { iso: string; label: string } {
  const iso = new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  const [y, m, d] = iso.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return { iso, label };
}

function buildPrompt(todayIso: string, todayLabel: string): string {
  return `You are reading a printed staff WORK SCHEDULE photo — people in rows, days in columns, each cell a shift. It may be a SINGLE week, or MULTIPLE weeks STACKED vertically (each week with its own day/date header row). Extract every person and ALL of their cells.

Today is ${todayLabel} (${todayIso}). Use it to resolve YEARS: the sheet shows dates like "17-Apr" or a header like "JUNE 22 - JUNE 28" with no year — assume the year that puts the date nearest to today (usually the current year).

Return ONE row per person, merging ALL their cells across every week shown (a person who appears in each weekly sub-table becomes one row). For each cell:
- "date": the cell's calendar date as ISO YYYY-MM-DD. Read it from the column's printed date (e.g. "17-Apr" → 2026-04-17), or derive it from the week's header range + the day-of-week column. If you genuinely can't tell, use "".
- "startTime"/"endTime": the shift's times as 24-hour "HH:MM" ("0645-1515" → "06:45"/"15:15"; "07:00 - 12:00" → "07:00"/"12:00"). For a day off or vacation, use "" for both.
- "type": classify (for colour only) — opening (early start), mid, closing (late end), day-off (an "OFF" cell or a BLANK cell), pto (VAC / vacation), sick, or unknown if unsure.
- "raw": exactly what is printed in the cell ("0645-1515", "OFF", "VAC", "", etc.).

Read each person's name as printed but DROP role markers like "(PT)" and labels like "UTILITY" — just the name. Call report_schedule with everything. If the image is not a staff schedule, return an empty staff array.`;
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

    const image = parseImageDataUrl(req.body?.image);
    if (!image) {
      res.status(400).json({ error: 'A schedule photo is required.' });
      return;
    }

    const { iso, label } = todayParts();
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 8192, // a 4-week grid is large
      system: buildPrompt(iso, label),
      tools: [REPORT_TOOL],
      tool_choice: { type: 'tool', name: 'report_schedule' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Parse this staff schedule.' },
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
          ],
        },
      ],
    });

    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) {
      res.status(502).json({ error: "Couldn't read a schedule from that photo." });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ schedule: toSchedule(toolUse.input) });
  } catch (err) {
    console.error('[fg-schedule-parse] handler error:', err);
    res.status(500).json({ error: `Parse error: ${err instanceof Error ? err.message : String(err)}` });
  }
}
