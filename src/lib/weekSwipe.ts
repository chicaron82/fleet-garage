// Decide whether a horizontal flick in the Week view should navigate weeks or be
// left to native horizontal scroll. The schedule grid is `overflow-x-auto` AND
// carries the week-nav swipe on the same element, so a single swipe-left would
// both scroll toward Sunday and jump to next week. The rule: only navigate once
// the grid is already scrolled to the edge in the swipe direction — otherwise do
// nothing and let the browser scroll to reveal the rest of the week first.

export interface ScrollMetrics {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export interface WeekSwipeOpts {
  /** Minimum flick distance in px (matches the existing > 50px guard). */
  minDistance?: number;
  /** Edge tolerance in px so sub-pixel scroll positions still count as "at the edge." */
  edgeEpsilon?: number;
}

/**
 * `deltaX` is `startX - endX` (positive = swipe-left). Returns the week-nav action,
 * or null when the gesture should fall through to native scroll. On a layout that
 * doesn't overflow (`scrollWidth ≈ clientWidth`), the grid is at both edges at once,
 * so swipe-nav fires on the first swipe — no regression for non-scrolling weeks.
 */
export function resolveWeekSwipe(
  deltaX: number,
  scroll: ScrollMetrics,
  opts: WeekSwipeOpts = {},
): 'next' | 'prev' | null {
  const minDistance = opts.minDistance ?? 50;
  const edge = opts.edgeEpsilon ?? 2;
  if (Math.abs(deltaX) <= minDistance) return null;

  if (deltaX > 0) {
    // swipe-left → next week, only if already scrolled to the right edge
    const atRightEdge = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - edge;
    return atRightEdge ? 'next' : null;
  }
  // swipe-right → prev week, only if already at the left edge
  const atLeftEdge = scroll.scrollLeft <= edge;
  return atLeftEdge ? 'prev' : null;
}
