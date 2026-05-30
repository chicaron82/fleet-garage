import { describe, it, expect } from 'vitest';
import { getTypeDefaults } from '../../src/lib/shiftDefaults';

describe('getTypeDefaults', () => {
  it('opening and mid are fixed year-round', () => {
    const off = getTypeDefaults(false);
    const peak = getTypeDefaults(true);
    expect(off.opening).toEqual({ start: '06:45', end: '15:15' });
    expect(peak.opening).toEqual({ start: '06:45', end: '15:15' });
    expect(off.mid).toEqual({ start: '10:30', end: '19:00' });
  });

  it('closing shifts one hour later in peak season', () => {
    expect(getTypeDefaults(false).closing).toEqual({ start: '13:30', end: '22:00' });
    expect(getTypeDefaults(true).closing).toEqual({ start: '14:30', end: '23:00' });
  });

  it('non-working types have empty times', () => {
    const d = getTypeDefaults(false);
    for (const t of ['day-off', 'pto', 'sick'] as const) {
      expect(d[t]).toEqual({ start: '', end: '' });
    }
  });
});
