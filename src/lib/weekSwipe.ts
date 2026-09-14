// Decide whether a horizontal flick in the Week view should navigate weeks or be
// left to native horizontal scroll. ⚠️ Judged from where the grid was when the finger LANDED — see
// `endScrollLeft` below for the bug reading it at lift caused. The schedule grid is `overflow-x-auto` AND
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
  /**
   * ⚠️⚠️ WHERE THE GRID ENDED UP when the finger lifted. `scroll` must be the metrics captured at
   * TOUCH START; if the gesture itself moved the grid more than the epsilon, it was spent scrolling
   * and never navigates.
   *
   * Aaron, 2026-09-14: *"the swipe to saturday stops nicely, but the swipe back to monday almost always
   * shifts back to the previous week"*. The edge used to be read at touchEND — after the finger had
   * dragged the grid all the way to scrollLeft 0 (at 412px the whole sideways range is ~174px, one
   * swipe) — so the swipe that REVEALED Monday also counted as "already at the edge". Left is a clean
   * 0 and tripped almost every time; the right edge rarely lands inside 2px, which is why Saturday
   * looked fine. Omitted = the old end-only behaviour, kept for callers without a start reading.
   */
  endScrollLeft?: number;
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
  // The gesture scrolled the grid → it was a scroll, not a week change.
  if (opts.endScrollLeft !== undefined && Math.abs(opts.endScrollLeft - scroll.scrollLeft) > edge) return null;

  if (deltaX > 0) {
    // swipe-left → next week, only if already scrolled to the right edge
    const atRightEdge = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - edge;
    return atRightEdge ? 'next' : null;
  }
  // swipe-right → prev week, only if already at the left edge
  const atLeftEdge = scroll.scrollLeft <= edge;
  return atLeftEdge ? 'prev' : null;
}
