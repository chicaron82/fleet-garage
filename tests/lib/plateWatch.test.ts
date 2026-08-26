import { describe, it, expect } from 'vitest';
import { watchFor, liveWatches, normalizeWatchPlate, type PlateWatch } from '../../src/lib/plateWatch';

// Aaron, 2026-08-26, off a whiteboard: "can I add a license plate to watch for? it doesn't exist in
// FG. so if I scanned it, it would tell me to hold it."

const w = (over: Partial<PlateWatch> = {}): PlateWatch => ({
  id: 'w1', plate: 'DFDA712', reason: 'HOLD PLS', createdAt: '2026-08-26T12:00:00Z',
  resolvedAt: null, ...over,
});

describe('watchFor', () => {
  // ⭐⭐ THE WHOLE POINT: this car is not in FG. The match is on the PLATE, never a vehicle id,
  // because a stranger car has no id to match on — and a stranger car is the easiest one to clean
  // and send straight back out with nothing objecting.
  it('hits on a plate FG has no vehicle for', () => {
    expect(watchFor('DFDA712', [w()])?.reason).toBe('HOLD PLS');
  });

  it('shrugs off the punctuation and case a read or a human adds', () => {
    for (const typed of ['dfda712', ' DFDA 712 ', 'DFDA-712', 'dfda-712  ']) {
      expect(watchFor(typed, [w()]), typed).not.toBeNull();
    }
    expect(watchFor('DFDA712', [w({ plate: ' dfda-712 ' })])).not.toBeNull();
  });

  it('does not fire on a different car', () => {
    expect(watchFor('LUR489', [w()])).toBeNull();
    expect(watchFor('DFDA713', [w()])).toBeNull();
    // ⚠️ Not a prefix match — a watch that fired on "starts with" would stop the wrong cars.
    expect(watchFor('DFDA7', [w()])).toBeNull();
    expect(watchFor('DFDA7120', [w()])).toBeNull();
  });

  // ⭐ A cleared watch has done its job. Clearing is an EVENT (resolved_at), not a delete, so the
  // history survives — but it must never stop him again.
  it('a resolved watch never fires', () => {
    expect(watchFor('DFDA712', [w({ resolvedAt: '2026-08-26T15:00:00Z' })])).toBeNull();
  });

  it('picks the live one when a plate has been watched before', () => {
    const hit = watchFor('DFDA712', [
      w({ id: 'old', reason: 'previous', resolvedAt: '2026-08-01T00:00:00Z' }),
      w({ id: 'now', reason: 'current' }),
    ]);
    expect(hit?.id).toBe('now');
  });

  it('says nothing on an absent or unreadable plate', () => {
    for (const p of [null, undefined, '', '   ', '---']) expect(watchFor(p, [w()])).toBeNull();
  });

  it('is silent with no watches at all — the common scan', () => {
    expect(watchFor('LUR489', [])).toBeNull();
  });
});

describe('liveWatches', () => {
  it('shows only unresolved, newest first', () => {
    const list = liveWatches([
      w({ id: 'a', createdAt: '2026-08-20T00:00:00Z' }),
      w({ id: 'b', createdAt: '2026-08-26T00:00:00Z' }),
      w({ id: 'c', createdAt: '2026-08-25T00:00:00Z', resolvedAt: '2026-08-25T09:00:00Z' }),
    ]);
    expect(list.map(x => x.id)).toEqual(['b', 'a']);
  });
});

describe('normalizeWatchPlate', () => {
  it('keeps every plate FG actually sees', () => {
    expect(normalizeWatchPlate('lur489')).toBe('LUR489');       // Manitoba, AAA111
    expect(normalizeWatchPlate('dfda712')).toBe('DFDA712');     // Ontario, AAAA999
    expect(normalizeWatchPlate('0ET028')).toBe('0ET028');       // leading digit, real MB unit
  });

  // ⚠️ NO SHAPE RULE. A watch is the one place a stranger plate is the EXPECTED input, so refusing
  // an unfamiliar format would reject exactly the cars this feature exists for.
  it('does not judge the shape of an out-of-province plate', () => {
    expect(normalizeWatchPlate('ABC 12 XY')).toBe('ABC12XY');
    expect(normalizeWatchPlate('12345')).toBe('12345');
  });

  it('returns empty for nothing usable', () => {
    for (const p of [null, undefined, '', '  ', '-- --']) expect(normalizeWatchPlate(p)).toBe('');
  });
});
