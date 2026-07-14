// Damage read endpoint. READ-ONLY: it reads a photo of vehicle damage (usually circled by
// the operator) and returns a one-line description to seed a damage hold — it writes nothing
// and looks nothing up. Sibling to keytag-read; same key/JWT/allowlist gate, same forced-tool
// structured output. The description is a DRAFT: the operator confirms/edits it before the
// hold is staged, and approves the staged hold later — two gates behind this read.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { isAllowed } from './_lib/assistantAccess.js';
import { parseImageDataUrl } from './_lib/imageData.js';
import type { DamageRead } from './_lib/damageRead.js';

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

const VISION_MODEL = 'claude-opus-4-8'; // damage can be subtle/low-contrast → the strong vision model.

const PROMPT = `You are reading a photo of vehicle DAMAGE taken by a rental-lot operator to log a damage hold. The operator has often CIRCLED or marked the damage — usually in red pen/drawing. If there is a mark, focus on the marked area; that is the damage they want logged.

Describe the visible damage in ONE concise operator-style line: the TYPE (scrape, scratch, dent, crack, chip, scuff, ding, broken/cracked glass) and the LOCATION on the vehicle (panel + side as seen, e.g. "rear driver-side quarter panel", "front passenger door", "windshield", "front bumper"). Example: "Scrape on the rear driver-side quarter panel".

Report exactly what is visible — do not invent damage that isn't there, and do not describe dirt, water droplets, or reflections as damage. If no damage is visible at all, call report_damage with an empty description.`;

const REPORT_TOOL: Anthropic.Tool = {
  name: 'report_damage',
  description: 'Report the vehicle damage read from the photo.',
  input_schema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'One-line damage description: type + location, e.g. "Scrape on the rear driver-side quarter panel". "" if no damage is visible.',
      },
    },
    required: [],
  },
};

/** Normalize the tool output → DamageRead: empty/whitespace → undefined. */
function toDamageRead(input: unknown): DamageRead {
  const r = (input ?? {}) as { description?: string };
  const desc = r.description && r.description.trim() ? r.description.trim() : undefined;
  return { description: desc };
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
      res.status(400).json({ error: 'A damage photo is required.' });
      return;
    }

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 1024,
      system: PROMPT,
      tools: [REPORT_TOOL],
      tool_choice: { type: 'tool', name: 'report_damage' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Read the damage in this photo.' },
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
          ],
        },
      ],
    });

    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) {
      res.status(502).json({ error: "Couldn't read damage from that photo." });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ read: toDamageRead(toolUse.input) });
  } catch (err) {
    console.error('[damage-read] handler error:', err);
    res.status(500).json({ error: `Read error: ${err instanceof Error ? err.message : String(err)}` });
  }
}
