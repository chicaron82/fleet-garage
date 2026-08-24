// The EV asset check made at the car during registration. Two contracts matter here and both are
// about NOT claiming something FG didn't observe:
//   1. It starts closed — a registration that never opens the block must be indistinguishable
//      from one made before this feature existed (both assets null, nothing logged).
//   2. reset() genuinely returns to that closed state — the register form calls it when a new key
//      tag arrives, and a leaked `assessed` would log car A's cable status against car B.
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEvAssetCheck } from '../../src/hooks/useEvAssetCheck';

describe('useEvAssetCheck', () => {
  it('starts closed, so an untouched form asserts nothing', () => {
    const { result } = renderHook(() => useEvAssetCheck());
    expect(result.current.assessed).toBe(false);
  });

  it('opens with both assets present — the common car, one tap to confirm', () => {
    const { result } = renderHook(() => useEvAssetCheck());
    act(() => result.current.setAssessed(true));
    expect(result.current.assessed).toBe(true);
    expect(result.current.hasCable).toBe(true);
    expect(result.current.hasAdapter).toBe(true);
  });

  it('marks one asset missing without disturbing the other', () => {
    const { result } = renderHook(() => useEvAssetCheck());
    act(() => {
      result.current.setAssessed(true);
      result.current.setHasAdapter(false);
    });
    expect(result.current.hasCable).toBe(true);
    expect(result.current.hasAdapter).toBe(false);
  });

  it('reset() clears an assessment made for the previous car', () => {
    const { result } = renderHook(() => useEvAssetCheck());
    act(() => {
      result.current.setAssessed(true);
      result.current.setHasCable(false);
      result.current.setHasAdapter(false);
    });
    // A new key tag lands on the open form — everything about the old car goes with it.
    act(() => result.current.reset());
    expect(result.current.assessed).toBe(false);
    expect(result.current.hasCable).toBe(true);
    expect(result.current.hasAdapter).toBe(true);
  });
});
