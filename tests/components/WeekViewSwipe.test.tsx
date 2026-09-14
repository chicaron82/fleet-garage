import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// ⚠️ THE SEAM THAT HAD THE BUG. Aaron, 2026-09-14: "the swipe to saturday stops nicely, but the swipe
// back to monday almost always shifts back to the previous week". WeekView read the grid's scroll
// position at touchEND — after the finger had dragged it to Monday — so the swipe that revealed Monday
// also counted as "already at the edge". lib/weekSwipe decides; this pins that WeekView hands it the
// position from touchSTART.
const goToPrev = vi.fn();
const goToNext = vi.fn();
vi.mock('../../src/context/ScheduleContext', () => ({
  useSchedule: () => ({ shifts: [], currentDate: new Date(2026, 8, 16), canEditShift: () => false, loading: false, goToPrev, goToNext }),
}));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', role: 'VSA' } }) }));
vi.mock('../../src/hooks/useTeamMembers', () => ({ useTeamMembers: () => [] }));

import { WeekView } from '../../src/components/schedule/WeekView';

function grid(container: HTMLElement): HTMLElement {
  const el = container.querySelector('table')!.parentElement!;
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 586 });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: 412 });
  return el;
}

/** A quick flick: lands at startX with the grid at `from`, the grid scrolls to `to`, lifts at endX. */
function flick(el: HTMLElement, startX: number, endX: number, from: number, to: number) {
  el.scrollLeft = from;
  fireEvent.touchStart(el, { touches: [{ clientX: startX }] });
  el.scrollLeft = to;
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: endX }] });
}

beforeEach(() => { goToPrev.mockClear(); goToNext.mockClear(); });

describe('WeekView swipe — judged from where the finger landed', () => {
  it('⭐ swiping back from Saturday to Monday reveals Monday and does NOT change the week', () => {
    const { container } = render(<WeekView today="2026-09-16" visibleUserIds={new Set()} />);
    flick(grid(container), 100, 260, 174, 0);
    expect(goToPrev).not.toHaveBeenCalled();
  });

  it('the next flick, starting on Monday, goes back a week', () => {
    const { container } = render(<WeekView today="2026-09-16" visibleUserIds={new Set()} />);
    flick(grid(container), 100, 260, 0, 0);
    expect(goToPrev).toHaveBeenCalledTimes(1);
  });

  it('swiping to Saturday reveals the weekend and does not advance the week', () => {
    const { container } = render(<WeekView today="2026-09-16" visibleUserIds={new Set()} />);
    flick(grid(container), 260, 100, 0, 174);
    expect(goToNext).not.toHaveBeenCalled();
  });
});
