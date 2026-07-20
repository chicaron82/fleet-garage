// The schedule-photo vision request, built in one place so its SHAPE is testable.
//
// Why this is its own module: the handler's model call is the one part of this endpoint
// that no test ever exercised, and it broke twice in one day — a max_tokens raise that
// silently crossed an SDK guard, and a timeout set in the wrong options object. Both were
// invisible to tsc/eslint/vitest and only failed on the operator's phone. Building the
// request here lets tests assert its shape, and lets an opt-in live check actually send it.
import Anthropic from '@anthropic-ai/sdk';

export const VISION_MODEL = 'claude-opus-4-8'; // dense, multi-week grid → the strong vision model.

// Availability backup only. Sonnet is a real fidelity step down on a cramped, angled,
// pen-marked grid — accepted because this endpoint WRITES NOTHING: every row is verified
// against the photo in the preview before the operator confirms. A degraded read beats a
// dead import; the client is told which model read it so rows get a harder look.
export const FALLBACK_VISION_MODEL = 'claude-sonnet-5';

// Sized off cell-count math, not feel: ~45-50 tokens/cell × a worst-realistic-case
// 4-week × 14-staff sheet (≈390 cells) ≈ 19.5k tokens. 32k leaves real headroom.
export const SCHEDULE_MAX_TOKENS = 32000;

/**
 * The SDK's client-side ceiling for a NON-streaming request, derived from its own formula:
 *   expectedTime = (60min * max_tokens) / 128000;  throws if expectedTime > 10min
 * → max_tokens > (10/60) * 128000 = 21333.
 * Above this the SDK throws "Streaming is required..." before sending anything. A
 * per-request `timeout` does NOT waive it — the guard reads the CLIENT CONSTRUCTOR's
 * timeout. Exported so a test can pin the coupling between our max_tokens and streaming.
 */
export const SDK_NONSTREAMING_MAX_TOKENS = 21333;

const TZ = 'America/Winnipeg';

export function todayParts(now: Date = new Date()): { iso: string; label: string } {
  const iso = now.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  const [y, m, d] = iso.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return { iso, label };
}

export function buildPrompt(todayIso: string, todayLabel: string): string {
  return `You are reading a printed staff WORK SCHEDULE (a photo or a PDF) — people in rows, days in columns, each cell a shift. It may be a SINGLE week, or MULTIPLE weeks STACKED vertically (each week with its own day/date header row). Extract every person and ALL of their cells.

Today is ${todayLabel} (${todayIso}). Use it to resolve YEARS: the sheet shows dates like "17-Apr" or a header like "JUNE 22 - JUNE 28" with no year — assume the year that puts the date nearest to today (usually the current year).

Return ONE row per person, merging ALL their cells across every week shown (a person who appears in each weekly sub-table becomes one row). For each cell:
- "date": the cell's calendar date as ISO YYYY-MM-DD. Read it from the column's printed date (e.g. "17-Apr" → 2026-04-17), or derive it from the week's header range + the day-of-week column. If you genuinely can't tell, use "".
- "startTime"/"endTime": the shift's times as 24-hour "HH:MM" ("0645-1515" → "06:45"/"15:15"; "07:00 - 12:00" → "07:00"/"12:00"). For a day off or vacation, use "" for both.
- "type": classify (for colour only) — opening (early start), mid, closing (late end), day-off (an "OFF" cell or a BLANK cell), pto (VAC / vacation), sick, or unknown if unsure.
- "raw": exactly what is printed in the cell ("0645-1515", "OFF", "VAC", "", etc.).

Read each person's name as printed but DROP role markers like "(PT)" and labels like "UTILITY" — just the name. Call report_schedule with everything you can read — even if the photo is angled, low-contrast, or has pen marks / crossed-out cells over part of it, push through and read the rest (a crossed-out week is still that week's schedule). Only return an empty staff array if the image genuinely is NOT a staff schedule at all.`;
}

export const REPORT_TOOL: Anthropic.Tool = {
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

/**
 * Build the exact request the endpoint sends. MUST be used with `messages.stream(...)`,
 * never `messages.create(...)` — see SDK_NONSTREAMING_MAX_TOKENS.
 */
export function buildScheduleRequest(docBlock: Anthropic.ContentBlockParam, now?: Date): Anthropic.MessageStreamParams {
  const { iso, label } = todayParts(now);
  return {
    model: VISION_MODEL,
    max_tokens: SCHEDULE_MAX_TOKENS,
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
}
