// POST /api/lot — the ONE writer of Erin St's count (lot_bay, lot_bay_taps — migration 153), of the bay log (lot_bay_log
// — migration 161), and of who is left off the crew line (migration 155). The airport's readings (157) were retired on
// 2026-10-29: *"airport lot data is hard to keep track of ... focusing on erin st"*.
// GET /api/lot — today's crew: numbers for anyone (the read-only /lot/view), names only for a signed-in FG session.
//
// Migration 151 makes the lot tables read-only to the browser's keys, so this function checks the caller and writes
// with the service role. It touches nothing but the lot tables. Rules: _lib/lotRequest.ts.
// ⭐ ONE DOOR: a signed-in FG session. The shared PIN (2026-10-14) was for pages with no FG login: the drivers' airport
// page (retired 2026-10-29) and /lot/erin (retired 2026-11-05, *"It's unused and just keeping the read-only"*).
import { createClient } from '@supabase/supabase-js';
import { bearerOf, parseLotRequest } from './_lib/lotRequest.js';
import { BAY_ACTIONS, bayChange, type BayRequest } from './_lib/lotBay.js';
import { moveCountSafely } from './_lib/lotCount.js';
import { BAY_LOG_ACTIONS, type BayLogRequest } from './_lib/lotBayLog.js';
import { addCleaned, BayLogRefusal, bumpToNextUp, clearStandby, exitCar, linkHold, removeRow, setNote, setStandby, startCar, undoAdd, undoExit } from './_lib/lotBayLogDb.js';
import { changeExit, sentUpByTrip, setSentUp } from './_lib/lotBayLogChange.js';
import type { LotRequest } from './_lib/lotRequest.js';
import { shiftBusinessDate } from './_lib/shiftDay.js';
import { leaveOff, loadCrew } from './_lib/lotCrewDb.js';

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
  if (!url || !serviceKey) {
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
  // The one door: a signed-in FG session (FG is trusted-crew-only). A body still carrying a PIN gets no further.
  const token = bearerOf(req.headers?.authorization);
  const signedIn = token != null && !(await db.auth.getUser(token)).error;
  if (!signedIn) {
    res.status(401).json({ error: token ? 'Your FG sign-in has run out. Sign in again.' : 'Sign in to FG to change the lot.' });
    return;
  }
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const now = new Date().toISOString();

  try {
    if (isBayLogRequest(parsed)) {
      // His log, his taps: a signed-in FG session only, never the shared PIN (ticket-lot-lookout-bay-log).
      if (!signedIn) {
        res.status(403).json({ error: 'Sign in to FG to use the bay log.' });
        return;
      }
      const today = shiftBusinessDate(new Date(now));
      try {
        const out = parsed.action === 'bayStart' ? await startCar(db, parsed.vehicleId, parsed.by, now, today)
          : parsed.action === 'bayExit' ? await exitCar(db, parsed.id, parsed.exit, parsed.by, now, today, parsed.odometer, parsed.pull !== false, parsed.sent === true)
          : parsed.action === 'bayExitUndo' ? await undoExit(db, parsed.id, parsed.by, now, today)
          : parsed.action === 'bayStandbySet' ? await setStandby(db, parsed.vehicleId, parsed.by, now, today)
          : parsed.action === 'bayStandbyClear' ? await clearStandby(db)
          : parsed.action === 'bayBumpToNextUp' ? await bumpToNextUp(db, parsed.id, parsed.by, now, today, parsed.replace)
          : parsed.action === 'bayNote' ? await setNote(db, parsed.id, parsed.note)
          : parsed.action === 'bayLinkHold' ? await linkHold(db, parsed.id, parsed.holdId)
          : parsed.action === 'bayAdd' ? await addCleaned(db, parsed.vehicleId, parsed.by, now, today)
          : parsed.action === 'bayAddUndo' ? await undoAdd(db, parsed.id, parsed.by, now, today)
          : parsed.action === 'bayRemove' ? await removeRow(db, parsed.id, parsed.by, now, today)
          : parsed.action === 'bayChangeExit' ? await changeExit(db, parsed.id, parsed.exit, parsed.by, now, today)
          : parsed.action === 'baySentUp' ? await setSentUp(db, parsed.id, parsed.sent)
          : parsed.action === 'bayTripSentUp' ? await sentUpByTrip(db, parsed.plate, today)
          // Named, not a catch-all: a new bay-log action with no arm here must fail the type check, never quietly
          // clear his Next up car (2026-11-03, pass two after the "Unknown action." fix).
          : unhandledBayLog(parsed);
        res.status(200).json({ ok: true, ...out });
      } catch (e) {
        if (!(e instanceof BayLogRefusal)) throw e;
        res.status(409).json({ error: e.message });
      }
      return;
    }
    if (parsed.action === 'leaveOff') {
      // People, not cars: only a signed-in FG session may change the crew line. The PIN never could.
      if (!signedIn) {
        res.status(403).json({ error: 'Sign in to FG to change the crew.' });
        return;
      }
      await leaveOff(db, parsed.user, parsed.off, parsed.by, now);
      res.status(200).json({ ok: true, crew: await loadCrew(db, Date.parse(now), true) });
      return;
    }
    if (parsed.action === 'bayBreak') {
      // On break (migration 166, docs/ticket-lot-bay-on-break.md): a stamp, not a count. Moves no number, logs no tap.
      const { data: saved, error } = await db.from('lot_bay').update({ break_at: parsed.on ? now : null }).eq('id', 1).select().single();
      if (error) throw error;
      res.status(200).json({ ok: true, bay: saved });
      return;
    }
    if (isBayRequest(parsed)) {
      // moveCountSafely: two taps in flight together used to save one (docs/ticket-erin-count-drops-a-tap.md).
      const today = shiftBusinessDate(new Date(now));
      const moved = await moveCountSafely(db, row => bayChange(row, parsed, now, today));
      if (moved.kind === 'refused') {
        res.status(409).json({ error: moved.error });
        return;
      }
      res.status(200).json({ ok: true, bay: moved.kind === 'saved' ? moved.saved : moved.row });
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

function unhandledBayLog(r: never): never {
  throw new Error(`bay log: no handler for ${(r as { action?: string }).action}`);
}

function isBayLogRequest(r: LotRequest): r is BayLogRequest {
  return (BAY_LOG_ACTIONS as readonly string[]).includes(r.action);
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
