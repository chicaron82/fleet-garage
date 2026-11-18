// His recent cars on a plain search box (docs/ticket-recent-cars-everywhere-and-restore-from-find.md). Aaron, 2026-11-18,
// in Fleet: *"it doesn't show my last search. So I have to retype it"*.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const record = vi.fn(async () => {});
const recents = [{ license_plate: 'LUR528', unit_number: '5429451', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White', is_hybrid: false, is_tesla: false }];
vi.mock('../../src/hooks/useLookupRecents', () => ({ useLookupRecents: () => ({ recents, record }) }));
const { useRecentCarsBox } = await import('../../src/hooks/useRecentCarsBox');

const cars = [{ id: 'v1', licensePlate: 'LUR528', unitNumber: '5429451' }, { id: 'v2', licensePlate: 'LZM441', unitNumber: '5422283' }];

describe('useRecentCarsBox', () => {
  beforeEach(() => { record.mockClear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('the list shows only while the box is focused AND empty', () => {
    const { result, rerender } = renderHook(({ term }) => useRecentCarsBox(term, cars), { initialProps: { term: '' } });
    expect(result.current.showRecents).toBe(false);          // not focused yet
    act(() => result.current.onFocus());
    expect(result.current.showRecents).toBe(true);
    rerender({ term: 'LZ' });
    expect(result.current.showRecents).toBe(false);          // typing hides it
  });

  it('a blur hides it, but only after a tap on a recent has had time to land', () => {
    const { result } = renderHook(() => useRecentCarsBox('', cars));
    act(() => result.current.onFocus());
    act(() => result.current.onBlur());
    expect(result.current.showRecents).toBe(true);
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.showRecents).toBe(false);
  });

  it('⭐ a whole plate typed into a filter box is remembered, once', () => {
    const { rerender } = renderHook(({ term }) => useRecentCarsBox(term, cars), { initialProps: { term: 'LUR5' } });
    expect(record).not.toHaveBeenCalled();                    // half a plate is not a look-up
    rerender({ term: 'LUR528' });
    expect(record).toHaveBeenCalledExactlyOnceWith('v1');
    rerender({ term: 'LUR528' });                             // a re-render is not a second look-up
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('a whole unit number counts too', () => {
    renderHook(() => useRecentCarsBox('5422283', cars));
    expect(record).toHaveBeenCalledExactlyOnceWith('v2');
  });
});
