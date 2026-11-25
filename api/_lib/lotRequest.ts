// Lot Lookout's request rules for api/lot.ts — pure, so the shape check is tested without a server.
// (Ticket: docs/ticket-lot-lookout-live-airport-stall-board.md.)
//
// Migration 151 makes the lot tables read-only to every key the browser holds, and api/lot.ts is the one writer. Its
// only door is a signed-in FG session (bearerOf + auth.getUser). The shared PIN that once let a driver with no FG login
// write (2026-10-14) was retired with the last page that used it, /lot/erin, on 2026-11-05.
import type { BayRequest } from './lotBay.js';
import { parseBayLog, BAY_LOG_ACTIONS, type BayLogRequest } from './lotBayLog.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The airport is gone (2026-10-29): first the stall map (151, 152 → 157, *"scrap the stale time and stall map"*), then
// its two readings: *"airport lot data is hard to keep track of that's why i proposed cutting it altogether and focusing
// on erin st"*. Its tables stay as history. Lot Lookout is Erin St's count and the bay log (161).
/** Which pause (migration 171, docs/ticket-lot-bay-pulled-away.md): On break, or Pulled away onto other work. */
export type BayPauseKind = 'break' | 'pulled';
const PAUSE_KINDS: readonly BayPauseKind[] = ['break', 'pulled'];
/** His own line on Pulled away (migration 172, docs/ticket-lot-bay-pulled-away-note.md). Mirrors the column's check. */
export const PAUSE_NOTE_MAX = 80;

export type LotRequest =
  | BayRequest
  | BayLogRequest
  | { action: 'leaveOff'; user: string; off: boolean; by: string }
  // On break (migration 166): on = he's off the floor, off = he's back. Any later tap ends it on its own.
  // note (migration 172): his own line, Pulled away only; null = none.
  | { action: 'bayBreak'; on: boolean; by: string; kind: BayPauseKind; note: string | null };

/** A typed count at Erin St (dirties, and cleans since migration 156). A cap, so a fat-fingered 2300 is refused. */
export const DIRTIES_MAX = 300;
/** Drain / fill move one carload per driver on; more than this is not a crew, it's a bug. */
const CREW_TAP_MAX = 20;

/** A whole count 0..DIRTIES_MAX, from a number or a digits-only string; null otherwise. */
function countOf(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= DIRTIES_MAX ? n : null;
}

/** The token from an `Authorization: Bearer …` header, or null. The caller checks it with auth.getUser. */
export function bearerOf(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const m = /^Bearer\s+(\S+)$/.exec(header.trim());
  return m ? m[1] : null;
}

/** Who tapped: the initials the phone remembers. A label, not security; capped so it stays a label. */
export function cleanBy(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  return s.slice(0, 12) || 'Lot';
}

export function parseLotRequest(body: unknown): LotRequest | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Nothing was sent.' };
  const b = body as Record<string, unknown>;
  const by = cleanBy(b.by);
  // The bay log (migration 161, Next up 163). Signed-in FG only; api/lot.ts enforces it. Routed off the one list,
  // BAY_LOG_ACTIONS: on 2026-11-03 Next up shipped with its two actions in that list and NOT in a hand-copied case list
  // here, so the server answered his first real Next up with "Unknown action." One list, so it cannot drift again.
  if ((BAY_LOG_ACTIONS as readonly unknown[]).includes(b.action)) return parseBayLog(b, by);
  switch (b.action) {
    // Erin St's count (migration 153).
    case 'cleans':
      if (b.delta !== 1 && b.delta !== -1) return { error: 'Cleans move one car at a time.' };
      return {
        action: 'cleans', delta: b.delta, fix: b.delta === -1 && b.fix === true,
        // Only a slip fix can give a dirty back (ticket-erin-clean-plus-takes-a-dirty).
        giveDirty: b.delta === -1 && b.fix === true && b.giveDirty === true, by,
      };
    case 'tripClean':
      if (b.delta !== 1 && b.delta !== -1) return { error: 'A trip takes one clean, or gives it back.' };
      return { action: 'tripClean', delta: b.delta, by };
    case 'dirties': {
      const n = countOf(b.count);
      if (n == null) return { error: `Type the dirty count as a number from 0 to ${DIRTIES_MAX}.` };
      return { action: 'dirties', count: n, by };
    }
    // The Erin pill's quick taps (migration 156).
    case 'cleansSet': {
      const n = countOf(b.count);
      if (n == null) return { error: `Type the clean count as a number from 0 to ${DIRTIES_MAX}.` };
      return { action: 'cleansSet', count: n, by };
    }
    case 'dirtiesStep':
      if (b.delta !== 1 && b.delta !== -1) return { error: 'Dirties move one car at a time.' };
      return { action: 'dirtiesStep', delta: b.delta, by };
    case 'drain':
    case 'fill': {
      const n = b.n;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > CREW_TAP_MAX) return { error: 'No drivers on to count.' };
      return b.action === 'drain' ? { action: 'drain', n, by } : { action: 'fill', n, by };
    }
    case 'bayUndo': {
      const t = (b.to ?? {}) as Record<string, unknown>;
      const cleans = countOf(t.cleans);
      const dirties = t.dirties == null ? null : countOf(t.dirties);
      const used = typeof t.used === 'number' && Number.isInteger(t.used) && t.used >= 0 && t.used <= 999 ? t.used : null;
      const usedOn = t.usedOn == null ? null : typeof t.usedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.usedOn) ? t.usedOn : undefined;
      if (b.field !== 'cleans' && b.field !== 'dirties') return { error: 'Nothing to undo.' };
      if (cleans == null || dirties === undefined || used == null || usedOn === undefined) return { error: 'Nothing to undo to.' };
      // What the tap left (line-check 2026-11-21 #4). Optional: a client from before it sends none.
      const l = b.left as Record<string, unknown> | undefined;
      const leftCleans = l ? countOf(l.cleans) : undefined;
      const leftDirties = l ? (l.dirties == null ? null : countOf(l.dirties)) : undefined;
      if (l && (leftCleans == null || leftDirties === undefined)) return { error: 'Nothing to undo to.' };
      const left = l ? { cleans: leftCleans as number, dirties: leftDirties as number | null } : undefined;
      return { action: 'bayUndo', field: b.field, to: { cleans, dirties, used, usedOn }, ...(left ? { left } : {}), by };
    }
    // Left off the crew line (migration 155). Signed-in FG only; api/lot.ts enforces that, not the PIN.
    // (The per-person 'crew' state action was retired 2026-10-24: the crew line is the schedule now.)
    case 'leaveOff':
      if (typeof b.user !== 'string' || !UUID.test(b.user)) return { error: 'Pick who this is for.' };
      if (typeof b.off !== 'boolean') return { error: 'Leave off, or bring back?' };
      return { action: 'leaveOff', user: b.user, off: b.off, by };
    case 'bayBreak': {
      if (typeof b.on !== 'boolean') return { error: 'On break, or back?' };
      // No kind = a break, so every client from before migration 171 means what it always meant.
      if (b.kind !== undefined && !PAUSE_KINDS.includes(b.kind as BayPauseKind)) return { error: 'A break, or pulled away?' };
      const kind = (b.kind as BayPauseKind | undefined) ?? 'break';
      // His note (migration 172): one line, whitespace folded. Only a Pulled away pause carries one; a break or Back
      // that sends one is refused rather than quietly dropping what he typed.
      if (b.note !== undefined && b.note !== null && typeof b.note !== 'string') return { error: 'The note is text.' };
      const note = typeof b.note === 'string' ? b.note.trim().replace(/\s+/g, ' ') : '';
      if (note && !(b.on && kind === 'pulled')) return { error: 'A note goes with Pulled away.' };
      if (note.length > PAUSE_NOTE_MAX) return { error: `Keep the note to ${PAUSE_NOTE_MAX} characters.` };
      return { action: 'bayBreak', on: b.on, by, kind, note: note || null };
    }
    default:
      return { error: 'Unknown action.' };
  }
}
