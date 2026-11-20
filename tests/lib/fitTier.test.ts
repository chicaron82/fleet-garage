// fitTier (docs/ticket-lot-view-left-column-fits.md): the first step that fits, else the scroll step.
import { describe, it, expect } from 'vitest';
import { fitTier } from '../../src/lib/fitTier';

const heights = [770, 640, 540];
const at = (t: number) => heights[t];

describe('fitTier', () => {
  it('⭐ full size when it fits (his monitor)', () => expect(fitTier(at, 847, 3)).toBe(0));
  it('steps down one at a time, to the first that fits', () => {
    expect(fitTier(at, 700, 3)).toBe(1);
    expect(fitTier(at, 600, 3)).toBe(2);
  });
  it('an exact fit counts as fitting', () => expect(fitTier(at, 640, 3)).toBe(1));
  it('nothing fits: the last step, where the column scrolls', () => expect(fitTier(at, 400, 3)).toBe(3));
  it('measures no further than it needs to', () => {
    const seen: number[] = [];
    fitTier(t => { seen.push(t); return heights[t]; }, 700, 3);
    expect(seen).toEqual([0, 1]);
  });
});
