// POST /api/lot — the ONE writer of the Lot Lookout board (lot_stalls, lot_aisle, lot_taps), and of Erin St's
// count (lot_bay, lot_bay_taps — migration 153).
//
// The /lot page has no FG login; a driver opens it with a shared PIN (Aaron, 2026-10-14). Migration 151 makes
// the three tables read-only to the browser's keys, so this function checks the PIN and writes with the
// service role. It touches nothing but the lot tables. Rules: _lib/lotRequest.ts.
import { createClient } from '@supabase/supabase-js';
import { bearerOf, parseLotRequest, pinMatches } from './_lib/lotRequest.js';
import { bayChange } from './_lib/lotBay.js';
import { shiftBusinessDate } from './_lib/shiftDay.js';

interface LotHttpRequest {
  method?: string;
  body?: unknown;
  headers?: { authorization?: string };
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
  const parsed = parseLotRequest(body);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Two doors: the shared PIN (a driver with no FG login), or a signed-in FG session (FG's My Day card, 2026-10-15:
  // *"May I suggest adding the cleans steppers here"*). FG is trusted-crew-only; the PIN is for everyone else.
  const pinOk = pinMatches(body?.pin, pin);
  const token = bearerOf(req.headers?.authorization);
  const signedIn = !pinOk && token != null && !(await db.auth.getUser(token)).error;
  if (!pinOk && !signedIn) {
    res.status(401).json({ error: token ? 'Your FG sign-in has run out. Sign in again.' : 'That PIN is not right.' });
    return;
  }
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
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
    if (parsed.action === 'cleans' || parsed.action === 'dirties') {
      const { data: row, error: readErr } = await db.from('lot_bay').select('cleans, dirties, used, used_on').eq('id', 1).single();
      if (readErr) throw readErr;
      const change = bayChange(row, parsed, now, shiftBusinessDate(new Date(now)));
      if ('error' in change) {
        res.status(409).json({ error: change.error });
        return;
      }
      const { data: saved, error } = await db.from('lot_bay').update(change.patch).eq('id', 1).select().single();
      if (error) throw error;
      await db.from('lot_bay_taps').insert(change.tap);
      res.status(200).json({ ok: true, bay: saved });
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
