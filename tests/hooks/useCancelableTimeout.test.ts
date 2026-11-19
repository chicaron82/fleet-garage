// A setTimeout that dies with its component. GitHub CI on f7968ac8 (2026-11-19): all 5349 tests passed and the run
// failed on "window is not defined", a search box's 200 ms blur-close firing after its test had torn the page down.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCancelableTimeout } from '../../src/hooks/useCancelableTimeout';

describe('useCancelableTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('⭐ unmounting cancels a pending timer: nothing fires after the screen is gone', () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useCancelableTimeout());
    result.current.later(fn, 200);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('a second later() replaces the first, so two blurs never stack two closes', () => {
    const a = vi.fn(); const b = vi.fn();
    const { result } = renderHook(() => useCancelableTimeout());
    result.current.later(a, 200);
    result.current.later(b, 200);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(200);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });

  it('cancel() drops it (a refocus keeps the list open)', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useCancelableTimeout());
    result.current.later(fn, 200);
    result.current.cancel();
    vi.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
  });

  it('control: an uncancelled timer does fire', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useCancelableTimeout());
    result.current.later(fn, 200);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce();
  });
});
