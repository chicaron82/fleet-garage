import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAirportFlip, __resetAirportFlipStore } from '../../src/hooks/useAirportFlip';
import { businessDateOf } from '../../src/lib/shiftDay';

const KEY = 'fg_airport_flip';
const today = () => businessDateOf(new Date());

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetAirportFlipStore();
});

const ROW = { plate: 'LUR441', odo: '5513', fuel: '5/8', damaged: false, notes: '' };

describe('useAirportFlip — durability', () => {
  it('survives the app being KILLED (the live bug: ~7 recorded, 2 shown)', () => {
    const first = renderHook(() => useAirportFlip());
    act(() => { first.result.current.add(ROW); });
    act(() => { first.result.current.add({ ...ROW, plate: 'LZM512' }); });
    expect(first.result.current.rows).toHaveLength(2);
    first.unmount();

    // Android reclaims memory → the PWA process dies. Module state goes with it; storage must not.
    __resetAirportFlipStore();
    const relaunched = renderHook(() => useAirportFlip());
    expect(relaunched.result.current.rows.map(r => r.plate)).toEqual(['LUR441', 'LZM512']);
  });

  it('persists to localStorage, not sessionStorage — sessionStorage dies with the process', () => {
    const { result } = renderHook(() => useAirportFlip());
    act(() => { result.current.add(ROW); });
    expect(localStorage.getItem(KEY)).toBeTruthy();
  });

  it('still self-clears on a NEW shift-day — the guardrail the storage type never provided', () => {
    localStorage.setItem(KEY, JSON.stringify({ day: '2020-01-01', rows: [{ ...ROW, id: 'x', checked: true, sent: false }] }));
    const { result } = renderHook(() => useAirportFlip());
    expect(result.current.rows).toEqual([]);
  });

  it('adopts rows left in the old sessionStorage slot (mid-shift deploy)', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ day: today(), rows: [{ ...ROW, id: 'x', checked: true, sent: false }] }));
    const { result } = renderHook(() => useAirportFlip());
    expect(result.current.rows.map(r => r.plate)).toEqual(['LUR441']);
  });
});

describe('useAirportFlip — one shared store', () => {
  it('two mounted consumers see the same rows (they used to hold separate copies)', () => {
    const a = renderHook(() => useAirportFlip());
    const b = renderHook(() => useAirportFlip());

    act(() => { a.result.current.add(ROW); });

    expect(a.result.current.rows).toHaveLength(1);
    expect(b.result.current.rows).toHaveLength(1); // the whole point of the refactor
  });

  it('a consumer mounted BEFORE the write cannot clobber it back', () => {
    const stale = renderHook(() => useAirportFlip());   // mounts with []
    const writer = renderHook(() => useAirportFlip());
    act(() => { writer.result.current.add(ROW); });

    // The stale consumer re-rendering (any unrelated state change) must not restore its old copy.
    stale.rerender();
    expect(stale.result.current.rows).toHaveLength(1);

    __resetAirportFlipStore();
    const fresh = renderHook(() => useAirportFlip());
    expect(fresh.result.current.rows).toHaveLength(1);
  });
});
