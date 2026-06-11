import { describe, it, expect } from 'vitest';
import { resolveWeekSwipe } from '../../src/lib/weekSwipe';

// A grid scrolled to mid-week: 600px viewport over 1000px of content, currently
// at scrollLeft 200 (room to scroll both ways).
const MID = { scrollLeft: 200, scrollWidth: 1000, clientWidth: 600 };
// At the right edge (Sunday fully revealed): 400 + 600 === 1000.
const RIGHT = { scrollLeft: 400, scrollWidth: 1000, clientWidth: 600 };
// At the left edge.
const LEFT = { scrollLeft: 0, scrollWidth: 1000, clientWidth: 600 };
// A week that fits with no overflow — at both edges at once.
const NO_OVERFLOW = { scrollLeft: 0, scrollWidth: 600, clientWidth: 600 };

describe('resolveWeekSwipe', () => {
  it('swipe-left mid-scroll → null (scroll toward Sunday, do not navigate)', () => {
    expect(resolveWeekSwipe(120, MID)).toBeNull();
  });

  it('swipe-left at the right edge → next week', () => {
    expect(resolveWeekSwipe(120, RIGHT)).toBe('next');
  });

  it('swipe-right mid-scroll → null (scroll back, do not navigate)', () => {
    expect(resolveWeekSwipe(-120, MID)).toBeNull();
  });

  it('swipe-right at the left edge → prev week', () => {
    expect(resolveWeekSwipe(-120, LEFT)).toBe('prev');
  });

  it('a flick below the min distance → null regardless of edge', () => {
    expect(resolveWeekSwipe(40, RIGHT)).toBeNull();
    expect(resolveWeekSwipe(-40, LEFT)).toBeNull();
  });

  it('non-overflowing week → swipe-nav works on the first swipe both ways', () => {
    expect(resolveWeekSwipe(120, NO_OVERFLOW)).toBe('next');
    expect(resolveWeekSwipe(-120, NO_OVERFLOW)).toBe('prev');
  });

  it('respects the edge epsilon — a sub-pixel gap still counts as the edge', () => {
    // 1px short of the true right edge — within the default 2px epsilon.
    const nearlyRight = { scrollLeft: 399, scrollWidth: 1000, clientWidth: 600 };
    expect(resolveWeekSwipe(120, nearlyRight)).toBe('next');
    // 1px off the left edge — still within epsilon.
    expect(resolveWeekSwipe(-120, { scrollLeft: 1, scrollWidth: 1000, clientWidth: 600 })).toBe('prev');
  });

  it('a left swipe not yet at the right edge does not navigate even one pixel early', () => {
    // 5px short — outside the 2px epsilon → scroll, don't navigate.
    const shortOfRight = { scrollLeft: 395, scrollWidth: 1000, clientWidth: 600 };
    expect(resolveWeekSwipe(120, shortOfRight)).toBeNull();
  });
});
