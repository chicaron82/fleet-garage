// The odo box moves to the middle of what the keypad leaves (Aaron, 2026-10-14, Pixel 10). Two passes, because the keypad's
// resize lands after the focus: now, and again once the viewport has settled.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { centreAfterKeypad } from '../../src/lib/centreAfterKeypad';

afterEach(() => { vi.useRealTimers(); });

describe('centreAfterKeypad', () => {
  it('centres now and again when the keypad has settled', () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    centreAfterKeypad({ scrollIntoView } as unknown as HTMLElement);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    vi.advanceTimersByTime(449);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
