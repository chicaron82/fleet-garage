import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStartCollisionGuard } from '../../src/hooks/useStartCollisionGuard';

describe('useStartCollisionGuard', () => {
  it('fires the start immediately when nothing is blocking', () => {
    const { result } = renderHook(() => useStartCollisionGuard(null));
    const start = vi.fn();
    act(() => result.current.guard(start));
    expect(start).toHaveBeenCalledTimes(1);
    expect(result.current.guardActive).toBe(false);
  });

  it('holds the start behind the guard when something is running', () => {
    const blocking = { id: 'oth-1' };
    const { result } = renderHook(() => useStartCollisionGuard(blocking));
    const start = vi.fn();
    act(() => result.current.guard(start));
    expect(start).not.toHaveBeenCalled();
    expect(result.current.guardActive).toBe(true);
  });

  it('proceed runs the held start and closes the guard', () => {
    const { result } = renderHook(() => useStartCollisionGuard({ id: 'x' }));
    const start = vi.fn();
    act(() => result.current.guard(start));
    act(() => result.current.proceed());
    expect(start).toHaveBeenCalledTimes(1);
    expect(result.current.guardActive).toBe(false);
  });

  it('dismiss closes the guard without starting (go-end-the-old-one path)', () => {
    const { result } = renderHook(() => useStartCollisionGuard({ id: 'x' }));
    const start = vi.fn();
    act(() => result.current.guard(start));
    act(() => result.current.dismiss());
    expect(start).not.toHaveBeenCalled();
    expect(result.current.guardActive).toBe(false);
  });
});
