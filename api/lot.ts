// POST /api/lot — the ONE writer of the Lot Lookout board (lot_stalls, lot_aisle, lot_taps).
//
// The /lot page has no FG login; a driver opens it with a shared PIN (Aaron, 2026-10-14). Migration 151 makes
// the three tables read-only to the browser's keys, so this function checks the PIN and writes with the
// service role. It touches nothing but the lot tables. Rules: _lib/lotRequest.ts.
import { createClient } from '@supabase/supabase-js';
import { parseLotRequest, pinMatches } from './_lib/lotRequest.js';

interface LotHttpRequest {
  method?: string;
  body?: unknown;
}
interface LotHttpResponse {
  status(code: number): LotHttpResponse;
  json(body: unknown): void;
}

export default async function handler(req: LotHttpRequest, res: LotHttpResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const pin = process.env.LOT_PIN;
  if (!url || !serviceKey || !pin) {
    res.status(500).json({ error: 'The lot board is not set up yet.' });
    return;
  }
  const body = (typeof req.body === 'string' ? safeJson(req.body) : req.body) as Record<string, unknown> | null;
  if (!pinMatches(body?.pin, pin)) {
    res.status(401).json({ error: 'That PIN is not right.' });
    return;
  }
  const parsed = parseLotRequest(body);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date().toISOString();

  try {
    if (parsed.action === 'check') {
      res.status(200).json({ ok: true });
      return;
    }
    if (parsed.action === 'stall' || parsed.action === 'undo') {
      const { data: before, error: readErr } = await db.from('lot_stalls').select('state').eq('stall', parsed.stall).single();
      if (readErr) throw readErr;
      const next = parsed.action === 'stall'
        ? { state: parsed.state, tapped_by: parsed.by, tapped_at: now }
        : { state: parsed.prev.state, tapped_by: parsed.prev.by, tapped_at: parsed.prev.at };
      const { error } = await db.from('lot_stalls').update(next).eq('stall', parsed.stall);
      if (error) throw error;
      await db.from('lot_taps').insert({
        stall: parsed.stall, state: next.state, prev_state: before?.state ?? null,
        tapped_by: parsed.by, kind: parsed.action,
      });
      res.status(200).json({ ok: true, stall: parsed.stall, ...next });
      return;
    }
    // aisle
    const { data: row, error: readErr } = await db.from('lot_aisle').select('cars').eq('id', 1).single();
    if (readErr) throw readErr;
    const cars = Math.max(0, (row?.cars ?? 0) + parsed.delta);
    const { error } = await db.from('lot_aisle').update({ cars, tapped_by: parsed.by, tapped_at: now }).eq('id', 1);
    if (error) throw error;
    await db.from('lot_taps').insert({ stall: null, state: String(cars), prev_state: String(row?.cars ?? 0), tapped_by: parsed.by, kind: 'aisle' });
    res.status(200).json({ ok: true, cars });
  } catch (e) {
    console.error('[api/lot]', e);
    res.status(500).json({ error: 'The board did not save. Try the tap again.' });
  }
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
