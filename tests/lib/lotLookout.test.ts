import { describe, it, expect } from 'vitest';
import {
  allStallIds, isStale, isMisparked, lotTotals, stallFromRow, isUndoTap, initialsOf, agoLabel,
  CLEANS_LOW, N_PULSE_AT, UNDO_MS, type LotStall,
} from '../../src/lib/lotLookout';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();
const st = (stall: string, state: LotStall['state'], ago: number | null): LotStall => ({
  stall, run: stall[0] as LotStall['run'], num: Number(stall.slice(1)), state,
  tappedBy: ago == null ? null : 'Krish', tappedAt: ago == null ? null : minsAgo(ago),
});
const noAisle = { cars: 0, tappedBy: null, tappedAt: null };

describe('allStallIds', () => {
  it('is the lot as it stands: 63 stalls, O1 and N1–N2 left out', () => {
    const ids = allStallIds();
    expect(ids).toHaveLength(63);
    expect(ids).toContain('O2');
    expect(ids).not.toContain('O1');
    expect(ids).not.toContain('N2');
    expect(ids[0]).toBe('S1');
  });
});

describe('isStale', () => {
  it('a stall nobody has tapped is stale', () => {
    expect(isStale(st('P1', null, null), NOW)).toBe(true);
  });
  it('fresh up to two hours, stale after', () => {
    expect(isStale(st('P1', 'clean', 120), NOW)).toBe(false);
    expect(isStale(st('P1', 'clean', 121), NOW)).toBe(true);
  });
});

describe('taken', () => {
  it('⚠️ never fades: a stall held hours ago is still taken, not "not looked at" (his ruling: "No fade")', () => {
    expect(isStale(st('P4', 'taken', 600), NOW)).toBe(false);
    const t = lotTotals([st('P4', 'taken', 600), st('P5', 'open', 5)], noAisle, NOW);
    expect(t.taken).toBe(1);
    expect(t.notLooked).toBe(0);
  });
  it('is not open, not a clean, not a dirty', () => {
    const t = lotTotals([st('P4', 'taken', 5)], noAisle, NOW);
    expect(t).toMatchObject({ open: 0, cleansSeen: 0, dirties: 0, misparked: 0 });
  });
  it('reads back from the database, and a hold again inside the window undoes it', () => {
    expect(stallFromRow({ stall: 'P4', run: 'P', num: 4, state: 'taken', tapped_by: 'AS', tapped_at: minsAgo(1) }).state).toBe('taken');
    const last = { stall: 'P4', state: 'taken' as const, atMs: NOW, prev: { state: 'open' as const, tappedBy: null, tappedAt: null } };
    expect(isUndoTap(last, 'P4', 'taken', NOW + 1000)).toBe(true);
  });
});

describe('isMisparked', () => {
  it('a dirty on the clean side is a misparked return; on N it is where it belongs', () => {
    expect(isMisparked(st('O7', 'dirty', 5))).toBe(true);
    expect(isMisparked(st('S2', 'dirty', 5))).toBe(true);
    expect(isMisparked(st('N7', 'dirty', 5))).toBe(false);
    expect(isMisparked(st('O7', 'clean', 5))).toBe(false);
  });
});

describe('lotTotals', () => {
  it('⚠️ counts only FRESH cleans toward "cleans seen", so an old green cannot pass as a car', () => {
    const t = lotTotals([st('P1', 'clean', 10), st('P2', 'clean', 300)], noAisle, NOW);
    expect(t.cleansSeen).toBe(1);
    expect(t.notLooked).toBe(1);
  });

  it(`is "low" under ${CLEANS_LOW} fresh cleans and not at ${CLEANS_LOW}`, () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => st(`P${i + 1}`, 'clean', 5));
    expect(lotTotals(many(CLEANS_LOW - 1), noAisle, NOW).low).toBe(true);
    expect(lotTotals(many(CLEANS_LOW), noAisle, NOW).low).toBe(false);
  });

  it(`pulses N at ${N_PULSE_AT} dirties, not at ${N_PULSE_AT - 1}`, () => {
    const n = (k: number) => Array.from({ length: k }, (_, i) => st(`N${i + 3}`, 'dirty', 5));
    expect(lotTotals(n(N_PULSE_AT - 1), noAisle, NOW).nPulse).toBe(false);
    expect(lotTotals(n(N_PULSE_AT), noAisle, NOW).nPulse).toBe(true);
  });

  it('dirties include the misparked ones, and says how many', () => {
    const t = lotTotals([st('N3', 'dirty', 5), st('O9', 'dirty', 5)], noAisle, NOW);
    expect(t.dirties).toBe(2);
    expect(t.misparked).toBe(1);
  });

  it('the aisle pulses whenever a car is in it', () => {
    expect(lotTotals([], { cars: 1, tappedBy: 'AS', tappedAt: minsAgo(3) }, NOW).aislePulse).toBe(true);
    expect(lotTotals([], noAisle, NOW).aislePulse).toBe(false);
  });

  it('last touch is the newest tap anywhere, the aisle included; null when nobody has tapped', () => {
    expect(lotTotals([st('P1', 'clean', 40)], { cars: 2, tappedBy: 'AS', tappedAt: minsAgo(4) }, NOW).lastTouchMin).toBe(4);
    expect(lotTotals([st('P1', null, null)], noAisle, NOW).lastTouchMin).toBeNull();
  });
});

describe('stallFromRow', () => {
  it('maps a row and reads an unknown state as "nobody has looked"', () => {
    const s = stallFromRow({ stall: 'O2', run: 'O', num: 2, state: 'purple', tapped_by: null, tapped_at: null });
    expect(s).toMatchObject({ stall: 'O2', run: 'O', state: null });
  });
});

describe('isUndoTap', () => {
  const last = { stall: 'P7', state: 'dirty' as const, atMs: NOW, prev: { state: 'clean' as const, tappedBy: 'K', tappedAt: minsAgo(30) } };
  it('the same colour on the same stall inside the window is an undo', () => {
    expect(isUndoTap(last, 'P7', 'dirty', NOW + UNDO_MS - 1)).toBe(true);
  });
  it('after the window the same colour means "looked, still true", not undo', () => {
    expect(isUndoTap(last, 'P7', 'dirty', NOW + UNDO_MS)).toBe(false);
  });
  it('a different colour or stall is a new tap', () => {
    expect(isUndoTap(last, 'P7', 'clean', NOW + 100)).toBe(false);
    expect(isUndoTap(last, 'P8', 'dirty', NOW + 100)).toBe(false);
    expect(isUndoTap(null, 'P7', 'dirty', NOW)).toBe(false);
  });
});

describe('labels', () => {
  it('initials and ages read the way the board shows them', () => {
    expect(initialsOf('Larry J')).toBe('LJ');
    expect(initialsOf('AS')).toBe('AS');
    expect(initialsOf(null)).toBe('');
    expect(agoLabel(null)).toBe('never');
    expect(agoLabel(0)).toBe('just now');
    expect(agoLabel(135)).toBe('2h 15m ago');
  });
});
