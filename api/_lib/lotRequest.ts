// Lot Lookout's request rules for api/lot.ts — pure, so the PIN check and the shape check are tested
// without a server. (Ticket: docs/ticket-lot-lookout-live-airport-stall-board.md.)
//
// ⚠️ The PIN is the ONLY thing between the public /lot page and the board: migration 151 makes the lot tables
// read-only to every key the browser holds, and this function is the one writer. His ruling, 2026-10-14:
// *"separate page with a pin works"*. If it leaks, the damage is a wrong reading and he changes LOT_PIN.
// The one other door (2026-10-15): a signed-in FG session, for FG's own My Day card (bearerOf + auth.getUser).
import { timingSafeEqual } from 'node:crypto';
import type { BayRequest } from './lotBay.js';
import type { CrewState } from './lotCrew.js';
import { parseReading, type AirportRequest } from './lotAirport.js';

const CREW_SET = ['cleaning', 'moving', 'airport', 'other', 'out', 'clear'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The airport's stall / undo / aisle actions (151, 152) were retired with the stall map on 2026-10-18 (migration 157):
// *"scrap the stale time and stall map"*. The airport is two readings and an aisle flag now (`reading`).
export type LotRequest =
  | { action: 'check'; by: string }
  | AirportRequest
  | BayRequest
  | { action: 'crew'; users: string[]; state: CrewState | 'clear'; by: string }
  | { action: 'leaveOff'; user: string; off: boolean; by: string };

/** A typed count at Erin St (dirties, and cleans since migration 156). A cap, so a fat-fingered 2300 is refused. */
export const DIRTIES_MAX = 300;
/** Drain / fill move one carload per driver on; more than this is not a crew, it's a bug. */
const CREW_TAP_MAX = 20;

/** A whole count 0..DIRTIES_MAX, from a number or a digits-only string; null otherwise. */
function countOf(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= DIRTIES_MAX ? n : null;
}

export function pinMatches(given: unknown, expected: string | undefined): boolean {
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given.trim());
  const b = Buffer.from(expected.trim());
  return a.length === b.length && timingSafeEqual(a, b);
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

export function parseLotRequest(body: unknown, nowMs = Date.now()): LotRequest | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Nothing was sent.' };
  const b = body as Record<string, unknown>;
  const by = cleanBy(b.by);
  switch (b.action) {
    case 'check':
      return { action: 'check', by };
    // The airport (migration 157): a notch on room for cleans or returns, or the aisle flag, with its tap time.
    case 'reading':
      return parseReading(b, by, nowMs);
    // Erin St's count (migration 153).
    case 'cleans':
      if (b.delta !== 1 && b.delta !== -1) return { error: 'Cleans move one car at a time.' };
      return { action: 'cleans', delta: b.delta, fix: b.delta === -1 && b.fix === true, by };
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
      return { action: 'bayUndo', field: b.field, to: { cleans, dirties, used, usedOn }, by };
    }
    // Today's crew (migration 154). Signed-in FG only; api/lot.ts enforces that, not the PIN.
    case 'crew': {
      const users = Array.isArray(b.users) ? b.users : [];
      if (users.length === 0 || users.length > 40 || !users.every(u => typeof u === 'string' && UUID.test(u))) {
        return { error: 'Pick who this is for.' };
      }
      if (!(CREW_SET as readonly unknown[]).includes(b.state)) return { error: 'Not a crew state.' };
      return { action: 'crew', users: [...new Set(users as string[])], state: b.state as CrewState | 'clear', by };
    }
    // Left off the crew line (migration 155). Signed-in FG only, like 'crew'.
    case 'leaveOff':
      if (typeof b.user !== 'string' || !UUID.test(b.user)) return { error: 'Pick who this is for.' };
      if (typeof b.off !== 'boolean') return { error: 'Leave off, or bring back?' };
      return { action: 'leaveOff', user: b.user, off: b.off, by };
    default:
      return { error: 'Unknown action.' };
  }
}
