// Key-tag read endpoint. READ-ONLY: it reads a photo of a printed Hertz vehicle key tag
// and returns the structured fields on it (KeytagRead) — it writes nothing and does NOT
// look anything up in the fleet. Sibling to fg-schedule-parse; same key/JWT/allowlist gate,
// same forced-tool structured output. make/model are DERIVED from the class code downstream
// (a fleet class lookup), so this raw read leaves them empty and returns the class code.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { isAllowed } from './_lib/assistantAccess.js';
import { parseImageDataUrl } from './_lib/imageData.js';
import { lookupVehicleClass, normalizeClassCode } from './_lib/vehicleClassCodex.js';
import type { KeytagRead } from './_lib/keytagRead.js';

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

const VISION_MODEL = 'claude-opus-4-8'; // a smudged/angled tag → the strong vision model.

const PROMPT = `You are reading a photo of a printed Hertz vehicle KEY TAG. Read the fields printed on it and report them exactly as shown — do not guess or invent anything you cannot see.

The tag shows fields like these:
- The TOP line is the owning branch: a city name then a branch number and a RENTAL CLASS, e.g. "WINNIPEG / 08199  Q4". The short code AFTER the branch number (e.g. "Q4", "P4", "T", "L2") is the RENTAL CLASS — the car's size/type group, distinct from the class code below. Report it exactly. It is short (1–3 chars) and sits in the top corner next to the branch number.
- "Veh #" → the UNIT NUMBER. Join the digit groups into one string (e.g. "542 0427" → "5420427").
- "Lic Plate" → the LICENSE PLATE, exactly as printed.
- A CLASS line such as "CCVL 25": the letters are the class code ("CCVL"); the trailing number is the model YEAR ("25" → 2025). Report the class code and the year separately. Do NOT try to name the make or model — that's looked up from the class code elsewhere. The class code (a 4-char code on its own line) and the rental class (the short code by the branch number up top) are DIFFERENT fields — report both.
- A COLOUR / BODY line such as "WHI 4DR": map the colour code to a colour name (WHI→White, BLK→Black, SIL→Silver, GRY→Gray, BLU→Blue, RED→Red; if it's another code, give your best full-word reading). The body style is the rest ("4DR").

Push through an angled, low-contrast, or partially-obscured tag and read what you can. Leave a field empty only if it genuinely isn't legible. If the image is NOT a vehicle key tag at all, call report_keytag with everything empty. Call report_keytag with what you read.`;

const REPORT_TOOL: Anthropic.Tool = {
  name: 'report_keytag',
  description: 'Report the fields read off the vehicle key tag.',
  input_schema: {
    type: 'object',
    properties: {
      plate: { type: 'string', description: 'License plate ("Lic Plate"), exactly as printed. "" if not legible.' },
      unitNumber: { type: 'string', description: 'Unit number ("Veh #"), digit groups joined. "" if not legible.' },
      classCode: { type: 'string', description: 'The class-line letters, e.g. "CCVL". "" if not legible.' },
      rentalClass: { type: 'string', description: 'The rental class by the branch number up top, e.g. "Q4", "P4", "T". "" if not legible.' },
      year: { type: 'integer', description: 'Model year from the class line (e.g. 2025). 0 if not legible.' },
      color: { type: 'string', description: 'Colour name mapped from the code (WHI→White…). "" if not legible.' },
      bodyStyle: { type: 'string', description: 'Body style from the colour/body line (e.g. "4DR"). "" if none.' },
    },
    required: [],
  },
};

interface RawKeytag {
  plate?: string;
  unitNumber?: string;
  classCode?: string;
  rentalClass?: string;
  year?: number;
  color?: string;
  bodyStyle?: string;
}

/** Normalize the tool output → KeytagRead: empty strings → undefined, 2-digit year → 4-digit. */
function toKeytagRead(input: unknown): KeytagRead {
  const r = (input ?? {}) as RawKeytag;
  const s = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
  let year: number | undefined;
  if (typeof r.year === 'number' && r.year > 0) year = r.year < 100 ? 2000 + r.year : r.year;
  const classCode = s(r.classCode);
  // Resolve the class code → make/model here (the codex is server-side). An unknown code
  // leaves make/model empty — the caller then asks, exactly as Effie does in chat.
  const vc = lookupVehicleClass(classCode);
  return {
    plate: s(r.plate),
    unitNumber: s(r.unitNumber),
    classCode,
    rentalClass: s(r.rentalClass)?.toUpperCase(),
    make: vc?.make,
    model: vc?.model,
    isHybrid: vc?.isHybrid,
    year,
    color: s(r.color),
    bodyStyle: s(r.bodyStyle),
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
      res.status(400).json({ error: 'A key-tag photo is required.' });
      return;
    }

    // maxRetries: the SDK backs off + retries transient failures (429 / 500+ / 529 "Overloaded",
    // connection blips) with jitter before giving up — so a busy-Anthropic moment self-heals here
    // instead of bubbling a scary error onto Aaron's shift screen. 4 tries covers a real spike.
    const anthropic = new Anthropic({ apiKey, maxRetries: 4 });
    const message = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 1024,
      system: PROMPT,
      tools: [REPORT_TOOL],
      tool_choice: { type: 'tool', name: 'report_keytag' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Read this key tag.' },
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
          ],
        },
      ],
    });

    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) {
      res.status(502).json({ error: "Couldn't read a key tag from that photo." });
      return;
    }
    const read = toKeytagRead(toolUse.input);
    // The curated codex is tried first (in toKeytagRead). Only when it MISSES do we consult the
    // codes Aaron has taught — so a taught row fills a gap and can never silently override a
    // vetted mapping. One cheap keyed lookup, and only on the codes that would otherwise fail.
    if (!read.make && read.classCode) {
      const key = normalizeClassCode(read.classCode);
      const { data: taught } = await supabase
        .from('vehicle_class_codex')
        .select('make, model')
        .eq('code', key)
        .maybeSingle();
      if (taught?.make) { read.make = taught.make; read.model = taught.model; }
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ read });
  } catch (err) {
    // Full detail stays in the server log (Vercel) for debugging; the CLIENT gets a clean,
    // human message — never the raw Anthropic error JSON, which used to leak straight onto the
    // shift screen (the "Overloaded" incident, 2026-07-29). Overload / rate-limit / upstream 5xx
    // are transient → flag them `retryable` so the client can auto-retry + say "busy, try again".
    console.error('[keytag-read] handler error:', err);
    const status = (err as { status?: number })?.status;
    const msg = err instanceof Error ? err.message : String(err);
    const transient = status === 529 || status === 503 || status === 429 || /overload/i.test(msg);
    if (transient) {
      res.status(503).json({ error: 'The scanner is busy right now — try again in a moment.', retryable: true });
      return;
    }
    res.status(500).json({ error: 'Could not read the key tag. Try again.' });
  }
}
