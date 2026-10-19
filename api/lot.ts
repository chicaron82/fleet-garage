// POST /api/lot — the ONE writer of the airport's readings (lot_airport, lot_airport_taps — migration 157), of Erin St's
// count (lot_bay, lot_bay_taps — migration 153), and of today's crew marks (lot_crew — migration 154).
// GET /api/lot — today's crew: numbers for anyone (the read-only /lot/view), names only for a signed-in FG session.
//
// The /lot page has no FG login; a driver opens it with a shared PIN (Aaron, 2026-10-14). Migration 151 makes
// the lot tables read-only to the browser's keys, so this function checks the PIN and writes with the
// service role. It touches nothing but the lot tables. Rules: _lib/lotRequest.ts.
import { createClient } from '@supabase/supabase-js';
import { bearerOf, parseLotRequest, pinMatches } from './_lib/lotRequest.js';
import { BAY_ACTIONS, bayChange, type BayRequest } from './_lib/lotBay.js';
import { newerThanHeld, readingChange } from './_lib/lotAirport.js';
import type { LotRequest } from './_lib/lotRequest.js';
import { shiftBusinessDate } from './_lib/shiftDay.js';
import { leaveOff, loadCrew, markCrew } from './_lib/lotCrewDb.js';

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
  if (req.method !== 'POST' && req.method !== 'GET') {
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
  if (req.method === 'GET') {
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = bearerOf(req.headers?.authorization);
    const signedIn = token != null && !(await db.auth.getUser(token)).error;
    try {
      res.status(200).json(await loadCrew(db, Date.now(), signedIn));
    } catch (e) {
      console.error('[api/lot GET]', e);
      res.status(500).json({ error: 'The crew did not load.' });
    }
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
    if (parsed.action === 'reading') {
      const { data: row, error: readErr } = await db.from('lot_airport')
        .select('cleans, cleans_at, returns, returns_at, aisle, aisle_at').eq('id', 1).single();
      if (readErr) throw readErr;
      const change = readingChange(row, parsed);
      let airport: unknown = null;
      if (change.patch) {
        // The newer-wins check rides IN the update, not only in the read above: two phones out of the parkade at
        // once both read the old row, and without it the older tap could land last and win.
        const { data: saved, error } = await db.from('lot_airport').update(change.patch).eq('id', 1)
          .or(newerThanHeld(parsed.field, change.tap.tapped_at)).select().maybeSingle();
        if (error) throw error;
        if (saved) airport = saved;
        else {
          // Another phone's fresher reading landed between our read and this write: logged, not written.
          change.tap.applied = false;
          const { data: fresh } = await db.from('lot_airport').select().eq('id', 1).single();
          airport = fresh;
        }
      }
      await db.from('lot_airport_taps').insert(change.tap);
      // applied = false is still a 200: the tap reached us, it was just older than what another phone had sent.
      res.status(200).json({ ok: true, applied: change.tap.applied, airport });
      return;
    }
    if (parsed.action === 'crew' || parsed.action === 'leaveOff') {
      // People, not cars: only a signed-in FG session may change the crew. The PIN never could.
      if (!signedIn) {
        res.status(403).json({ error: 'Sign in to FG to change the crew.' });
        return;
      }
      if (parsed.action === 'leaveOff') {
        await leaveOff(db, parsed.user, parsed.off, parsed.by, now);
        res.status(200).json({ ok: true, crew: await loadCrew(db, Date.parse(now), true) });
        return;
      }
      const problem = await markCrew(db, parsed.users, parsed.state, parsed.by, now);
      if (problem) {
        res.status(409).json({ error: problem });
        return;
      }
      res.status(200).json({ ok: true, crew: await loadCrew(db, Date.parse(now), true) });
      return;
    }
    if (isBayRequest(parsed)) {
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
    res.status(400).json({ error: 'Unknown action.' });
  } catch (e) {
    console.error('[api/lot]', e);
    res.status(500).json({ error: 'The board did not save. Try the tap again.' });
  }
}

/** Erin St's count: every action that writes lot_bay (the +1/−1, the typed dirties, and migration 156's quick taps). */
function isBayRequest(r: LotRequest): r is BayRequest {
  return (BAY_ACTIONS as readonly string[]).includes(r.action);
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
