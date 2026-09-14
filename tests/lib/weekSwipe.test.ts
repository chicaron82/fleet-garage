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

describe('resolveWeekSwipe — judged from where the gesture STARTED (Aaron, 2026-09-14)', () => {
  // "the swipe to saturday stops nicely, but the swipe back to monday almost always shifts back to the
  //  previous week". The edge used to be read at touchEND — after the finger had already dragged the
  //  grid to scrollLeft 0 — so the swipe that REVEALED Monday also counted as "already at the edge".
  const PHONE = { scrollWidth: 586, clientWidth: 412 }; // ~174px of sideways travel at 412px

  it('⭐ a swipe that scrolls the grid back to Monday does NOT change the week', () => {
    const atStart = { ...PHONE, scrollLeft: 174 };            // on Saturday when the finger lands
    expect(resolveWeekSwipe(-150, atStart, { endScrollLeft: 0 })).toBeNull();
  });

  it('⭐ the NEXT flick, starting on Monday and moving nothing, goes back a week', () => {
    expect(resolveWeekSwipe(-150, { ...PHONE, scrollLeft: 0 }, { endScrollLeft: 0 })).toBe('prev');
  });

  it('the same on the Sunday side: revealing the weekend never also advances the week', () => {
    expect(resolveWeekSwipe(150, { ...PHONE, scrollLeft: 0 }, { endScrollLeft: 174 })).toBeNull();
    expect(resolveWeekSwipe(150, { ...PHONE, scrollLeft: 174 }, { endScrollLeft: 174 })).toBe('next');
  });

  it('a week that does not overflow still navigates on the first swipe', () => {
    expect(resolveWeekSwipe(-150, { scrollLeft: 0, scrollWidth: 412, clientWidth: 412 }, { endScrollLeft: 0 })).toBe('prev');
  });
});
