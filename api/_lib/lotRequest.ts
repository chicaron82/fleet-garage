// Lot Lookout's request rules for api/lot.ts — pure, so the PIN check and the shape check are tested
// without a server. (Ticket: docs/ticket-lot-lookout-live-airport-stall-board.md.)
//
// ⚠️ The PIN is the ONLY thing between the public /lot page and the board: migration 151 makes the lot tables
// read-only to every key the browser holds, and this function is the one writer. His ruling, 2026-10-14:
// *"separate page with a pin works"*. If it leaks, the damage is a wrong stall map and he changes LOT_PIN.
import { timingSafeEqual } from 'node:crypto';
import type { BayRequest } from './lotBay.js';

// 'taken' (migration 152): a customer's or staff car in the stall; the page marks it by holding the stall.
const STATES = ['open', 'clean', 'dirty', 'taken'] as const;
type State = typeof STATES[number];
// Mirrors LOT_RUNS in src/lib/lotLookout.ts and migration 151's seed: O1 is the cart return, N1–N2 the HIR booth.
const RUNS: Record<string, [number, number]> = { S: [1, 6], P: [1, 20], O: [2, 20], N: [3, 20] };

export type LotRequest =
  | { action: 'check'; by: string }
  | { action: 'stall'; stall: string; state: State; by: string }
  | { action: 'undo'; stall: string; prev: { state: State | null; by: string | null; at: string | null }; by: string }
  | { action: 'aisle'; delta: 1 | -1; by: string }
  | BayRequest;

/** A typed dirty count at Erin St. A cap, so a fat-fingered 2300 is refused rather than shown. */
export const DIRTIES_MAX = 300;

export function pinMatches(given: unknown, expected: string | undefined): boolean {
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given.trim());
  const b = Buffer.from(expected.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isStallId(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = /^([SPON])(\d{1,2})$/.exec(v);
  if (!m) return false;
  const [lo, hi] = RUNS[m[1]];
  const n = Number(m[2]);
  return n >= lo && n <= hi;
}

const isState = (v: unknown): v is State => typeof v === 'string' && (STATES as readonly string[]).includes(v);

/** Who tapped: the initials the phone remembers. A label, not security; capped so it stays a label. */
export function cleanBy(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  return s.slice(0, 12) || 'Lot';
}

export function parseLotRequest(body: unknown): LotRequest | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Nothing was sent.' };
  const b = body as Record<string, unknown>;
  const by = cleanBy(b.by);
  switch (b.action) {
    case 'check':
      return { action: 'check', by };
    case 'stall':
      if (!isStallId(b.stall)) return { error: 'That is not a stall on the lot.' };
      if (!isState(b.state)) return { error: 'A stall is open, clean, dirty or taken.' };
      return { action: 'stall', stall: b.stall, state: b.state, by };
    case 'undo': {
      if (!isStallId(b.stall)) return { error: 'That is not a stall on the lot.' };
      const p = (b.prev ?? {}) as Record<string, unknown>;
      const state = p.state == null ? null : isState(p.state) ? p.state : undefined;
      if (state === undefined) return { error: 'Nothing to undo to.' };
      const at = typeof p.at === 'string' && !Number.isNaN(Date.parse(p.at)) ? p.at : null;
      const prevBy = typeof p.by === 'string' ? cleanBy(p.by) : null;
      return { action: 'undo', stall: b.stall, prev: { state, by: prevBy, at }, by };
    }
    case 'aisle':
      if (b.delta !== 1 && b.delta !== -1) return { error: 'The aisle moves one car at a time.' };
      return { action: 'aisle', delta: b.delta, by };
    // Erin St's count (migration 153).
    case 'cleans':
      if (b.delta !== 1 && b.delta !== -1) return { error: 'Cleans move one car at a time.' };
      return { action: 'cleans', delta: b.delta, fix: b.delta === -1 && b.fix === true, by };
    case 'dirties': {
      const n = typeof b.count === 'number' ? b.count : typeof b.count === 'string' && /^\d+$/.test(b.count.trim()) ? Number(b.count) : NaN;
      if (!Number.isInteger(n) || n < 0 || n > DIRTIES_MAX) return { error: `Type the dirty count as a number from 0 to ${DIRTIES_MAX}.` };
      return { action: 'dirties', count: n, by };
    }
    default:
      return { error: 'Unknown action.' };
  }
}
