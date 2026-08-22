import { describe, it, expect } from 'vitest';
import { displayHoldFor } from '../../src/lib/displayHold';
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
