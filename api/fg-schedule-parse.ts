// Schedule-photo parse endpoint (Phase 1 of the import). READ-ONLY: it reads a printed
// staff-schedule photo and returns a typed grid (ParsedSchedule) — it writes nothing.
// Structured output is forced via a single required tool (report_schedule) rather than
// free text, so the response is reliably shaped. Same key/JWT/allowlist gate as fg-chat:
// the Anthropic key stays server-side and a billable call needs an allowlisted account.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { isAllowed } from './_lib/assistantAccess.js';
import { parseImageDataUrl } from './_lib/imageData.js';
import type { ParsedSchedule } from './_lib/scheduleParse.js';

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

const VISION_MODEL = 'claude-opus-4-8'; // dense grid → the strong vision model.

const PARSE_PROMPT = `You are reading a printed staff WORK SCHEDULE — a grid with people in rows and days in columns, each cell a shift. Extract every staff row and, for each, every day's cell.

For each cell:
- "raw" = exactly what is printed (times like "6:45a-3:15p", a code, "OFF", "PTO", "SICK", or blank).
- "type" = your best mapping to ONE of: opening (an early start), mid, closing (a late shift), day-off (OFF or blank), pto, sick, or "unknown" if you genuinely can't tell.
- "day" = the column/day label as shown ("Mon", "Jul 3", a date).

Read each person's name EXACTLY as printed. Report the week's start date in "weekStart" if the photo shows one. Call the report_schedule tool with everything. If the image is not a staff schedule, call it with an empty staff array.`;

const REPORT_TOOL: Anthropic.Tool = {
  name: 'report_schedule',
  description: 'Report the staff schedule grid parsed from the photo.',
  input_schema: {
    type: 'object',
    properties: {
      weekStart: { type: 'string', description: 'Week start date if shown (ISO YYYY-MM-DD preferred); empty if not shown.' },
      staff: {
        type: 'array',
        description: 'One entry per person/row in the grid.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: "The person's name exactly as printed on the row." },
            cells: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  day: { type: 'string', description: 'Column/day label as seen.' },
                  type: {
                    type: 'string',
                    enum: ['opening', 'mid', 'closing', 'day-off', 'pto', 'sick', 'unknown'],
                    description: 'Best mapping of the cell to a shift type.',
                  },
                  raw: { type: 'string', description: 'Exact cell content read (times/code/OFF/PTO/blank).' },
                },
                required: ['day', 'type', 'raw'],
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

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 4096,
      system: PARSE_PROMPT,
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
    const schedule = toolUse.input as ParsedSchedule;
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ schedule });
  } catch (err) {
    console.error('[fg-schedule-parse] handler error:', err);
    res.status(500).json({ error: `Parse error: ${err instanceof Error ? err.message : String(err)}` });
  }
}
