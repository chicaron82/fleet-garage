import { describe, it, expect } from 'vitest';
import { displayHoldFor, holdLatestActivity } from '../../src/lib/displayHold';
import type { Hold, VehicleStatus } from '../../src/types';

// Extracted from HoldsView 2026-08-22. The behaviour was never tested while it lived in the view;
// it is tested now, which is the point of moving it.

const hold = (over: Partial<Hold> & { id: string }): Hold => ({
  vehicleId: 'veh-1', holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
  damageDescription: 'Scratch', flaggedById: 'u-1', flaggedByName: 'A', flaggedByEmployeeId: '1',
  flaggedAt: '2026-08-01T00:00:00Z', notes: '', status: 'ACTIVE', branchId: 'YWG', ...over,
});
const activity = (h: Hold) => Date.parse(h.flaggedAt);

describe('displayHoldFor', () => {
  it('shows nothing when the car has no holds', () => {
    expect(displayHoldFor([], 'veh-1', 'CLEAR', activity)).toBeUndefined();
  });

  it('ignores holds belonging to another car', () => {
    const other = hold({ id: 'x', vehicleId: 'veh-2' });
    expect(displayHoldFor([other], 'veh-1', 'HELD', activity)).toBeUndefined();
  });

  it('⭐ a PRE_EXISTING car shows the pre-existing release, not the newest record', () => {
    // The row would otherwise contradict its own badge.
    const newest = hold({ id: 'new', status: 'REPAIRED', flaggedAt: '2026-08-20T00:00:00Z' });
    const pre = hold({ id: 'pre', status: 'RELEASED', flaggedAt: '2026-01-01T00:00:00Z',
                       release: { releaseType: 'PRE_EXISTING' } as Hold['release'] });
    expect(displayHoldFor([newest, pre], 'veh-1', 'PRE_EXISTING', activity)!.id).toBe('pre');
  });

  it('a HELD car shows the active hold', () => {
    const done = hold({ id: 'done', status: 'REPAIRED', flaggedAt: '2026-08-20T00:00:00Z' });
    const live = hold({ id: 'live', status: 'ACTIVE', flaggedAt: '2026-01-01T00:00:00Z' });
    expect(displayHoldFor([done, live], 'veh-1', 'HELD', activity)!.id).toBe('live');
  });

  it('an OUT_ON_EXCEPTION car shows the exception release', () => {
    const plain = hold({ id: 'plain' });
    const exc = hold({ id: 'exc', status: 'RELEASED',
                       release: { releaseType: 'EXCEPTION' } as Hold['release'] });
    expect(displayHoldFor([plain, exc], 'veh-1', 'OUT_ON_EXCEPTION', activity)!.id).toBe('exc');
  });

  it('falls back to the first hold when the status-specific one is missing', () => {
    const only = hold({ id: 'only', status: 'REPAIRED' });
    expect(displayHoldFor([only], 'veh-1', 'HELD', activity)!.id).toBe('only');
  });

  it('otherwise shows the most recently touched hold', () => {
    const old = hold({ id: 'old', flaggedAt: '2026-01-01T00:00:00Z' });
    const recent = hold({ id: 'recent', flaggedAt: '2026-08-20T00:00:00Z' });
    expect(displayHoldFor([old, recent], 'veh-1', 'CLEAR' as VehicleStatus, activity)!.id).toBe('recent');
  });

  it('does not reorder the caller\'s array', () => {
    const a = hold({ id: 'a', flaggedAt: '2026-01-01T00:00:00Z' });
    const b = hold({ id: 'b', flaggedAt: '2026-08-20T00:00:00Z' });
    const input = [a, b];
    displayHoldFor(input, 'veh-1', 'CLEAR' as VehicleStatus, activity);
    expect(input.map(h => h.id)).toEqual(['a', 'b']);
  });
});

// ── holdLatestActivity ────────────────────────────────────────────────────────
// Hoisted here 2026-08-25 from TWO byte-identical copies (HoldsView + VehicleHoldContext).
// It had never been tested in either home; the ladder it encodes is a real domain rule.
describe('holdLatestActivity', () => {
  const at = (iso: string) => Date.parse(iso);

  it('falls back to the flag time when nothing else has happened', () => {
    expect(holdLatestActivity(hold({ id: 'h1', flaggedAt: '2026-08-01T00:00:00Z' })))
      .toBe(at('2026-08-01T00:00:00Z'));
  });

  it('prefers the release over the flag', () => {
    const h = hold({
      id: 'h2', flaggedAt: '2026-08-01T00:00:00Z',
      release: { id: 'r1', releaseType: 'EXCEPTION', approvedAt: '2026-08-05T00:00:00Z' } as Hold['release'],
    });
    expect(holdLatestActivity(h)).toBe(at('2026-08-05T00:00:00Z'));
  });

  it('prefers the repair over BOTH the release and the flag — a repair is the latest thing that can happen', () => {
    const h = hold({
      id: 'h3', flaggedAt: '2026-08-01T00:00:00Z',
      release: { id: 'r1', releaseType: 'EXCEPTION', approvedAt: '2026-08-05T00:00:00Z' } as Hold['release'],
      repair: { id: 'p1', repairedAt: '2026-08-09T00:00:00Z' } as Hold['repair'],
    });
    expect(holdLatestActivity(h)).toBe(at('2026-08-09T00:00:00Z'));
  });

  it('takes the repair even when it PREDATES the release — the ladder is by kind, not by clock', () => {
    // Deliberate: the rungs encode "what stage is this hold at", not "which timestamp is biggest".
    // Pinned so a future refactor to Math.max() is a failing test rather than a silent reorder.
    const h = hold({
      id: 'h4', flaggedAt: '2026-08-01T00:00:00Z',
      release: { id: 'r1', releaseType: 'EXCEPTION', approvedAt: '2026-08-20T00:00:00Z' } as Hold['release'],
      repair: { id: 'p1', repairedAt: '2026-08-03T00:00:00Z' } as Hold['repair'],
    });
    expect(holdLatestActivity(h)).toBe(at('2026-08-03T00:00:00Z'));
  });

  it('never returns NaN — every hold has a flag time as its floor', () => {
    expect(Number.isNaN(holdLatestActivity(hold({ id: 'h5' })))).toBe(false);
  });

  it('sorts a car\'s holds newest-touched first, the way both call sites rely on', () => {
    const older = hold({ id: 'old', flaggedAt: '2026-08-01T00:00:00Z' });
    const newer = hold({ id: 'new', flaggedAt: '2026-08-10T00:00:00Z' });
    const sorted = [older, newer].sort((a, b) => holdLatestActivity(b) - holdLatestActivity(a));
    expect(sorted.map(h => h.id)).toEqual(['new', 'old']);
  });
});
