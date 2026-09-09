// POST /api/keytag-read — auth, parse the photo, hand it to the reader, choose a status code.
//
// ⭐ THE READ ITSELF LIVES IN `_lib/keytagReader.ts`. It moved there 2026-09-09 so Effie's overflow
// tool reads tags through the SAME pipeline instead of a second one — Aaron's rule: *"anything that
// reads keytags shouldn't be tossing out valuable info"*, and his call on how: *"b properly."*
// A second reader would have been a model transcribing a photo, with none of the two-tier
// escalation, fleet corroboration, spend ledger, codices or rental-class pin that make this read
// what it is — while writing the same table.
//
// ⚠️ It also put this file back under the 330-line cap it had been over (378) since the escalation
// and codex work landed.
import { createClient } from '@supabase/supabase-js';
import { isAllowed } from './_lib/assistantAccess.js';
import { parseImageDataUrl } from './_lib/imageData.js';
import { readKeytagPhoto, isTransient } from './_lib/keytagReader.js';

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

    const read = await readKeytagPhoto(image, supabase, userData.user.id, apiKey);
    if (!read) {
      res.status(502).json({ error: "Couldn't read a key tag from that photo." });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ read });
  } catch (err) {
    // Full detail stays in the server log (Vercel) for debugging; the CLIENT gets a clean,
    // human message — never the raw Anthropic error JSON, which used to leak straight onto the
    // shift screen (the "Overloaded" incident, 2026-07-29). Overload / rate-limit / upstream 5xx
    // are transient → flag them `retryable` so the client can auto-retry + say "busy, try again".
    console.error('[keytag-read] handler error:', err);
    if (isTransient(err)) {
      res.status(503).json({ error: 'The scanner is busy right now — try again in a moment.', retryable: true });
      return;
    }
    res.status(500).json({ error: 'Could not read the key tag. Try again.' });
  }
}
