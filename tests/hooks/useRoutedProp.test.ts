import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRoutedProp } from '../../src/hooks/useRoutedProp';

describe('useRoutedProp', () => {
  it('does NOT fire on the initial mount — useState already seeded that value', () => {
    const onChange = vi.fn();
    renderHook(({ p }) => useRoutedProp(p, onChange), { initialProps: { p: 'LUR437' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fires when the routed prop changes to a NEW value (the whole bug)', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(({ p }) => useRoutedProp(p, onChange), { initialProps: { p: 'LUR437' } });
    rerender({ p: 'LZM512' });
    expect(onChange).toHaveBeenCalledWith('LZM512');
  });

  it('fires once per distinct value — a later edit is not clobbered by re-renders', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(({ p }) => useRoutedProp(p, onChange), { initialProps: { p: 'A' } });
    rerender({ p: 'B' });
    rerender({ p: 'B' });
    rerender({ p: 'B' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('never fires for a falsy prop — an absent route must not blank typed input', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(({ p }) => useRoutedProp(p, onChange), { initialProps: { p: 'A' } });
    rerender({ p: '' });
    rerender({ p: undefined as unknown as string });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('re-fires if the same value returns after a different one', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(({ p }) => useRoutedProp(p, onChange), { initialProps: { p: 'A' } });
    rerender({ p: 'B' });
    rerender({ p: 'A' });
    expect(onChange).toHaveBeenNthCalledWith(2, 'A');
  });
});
