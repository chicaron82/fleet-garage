import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// The store pushes/pulls through this module on every mount and commit. Mocked so the suite is
// deterministic (no real Supabase reach) AND so the cross-device merge wiring is drivable — the
// pure merge is covered in lib/airportFlip.test.ts; this proves the HOOK actually calls it.
vi.mock('../../src/lib/airportFlipSync', () => ({
  loadServerFlips: vi.fn(async () => null),
  saveServerFlips: vi.fn(async () => undefined),
}));
import { useAirportFlip, __resetAirportFlipStore } from '../../src/hooks/useAirportFlip';
import { businessDateOf } from '../../src/lib/shiftDay';
import { loadServerFlips, saveServerFlips } from '../../src/lib/airportFlipSync';

const KEY = 'fg_airport_flip';
const today = () => businessDateOf(new Date());

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetAirportFlipStore();
  vi.mocked(loadServerFlips).mockReset().mockResolvedValue(null);
  vi.mocked(saveServerFlips).mockReset().mockResolvedValue(undefined);
});

const ROW = { plate: 'LUR441', unit: null, odo: '5513', fuel: '5/8', isEv: false, damaged: false, rentalClass: '', notes: '' };

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

// ── cross-device reconciliation, at the WIRING level ──────────────────────────────────────
// lib/airportFlip.test.ts proves the merge FUNCTION; these prove the hook actually reaches for
// it — which is where the 2026-07-26 line-check finding lived (the pull adopted or ignored the
// server wholesale, and only ever ran once per shift-day).
const srvRow = (id: string, at: number, over: Record<string, unknown> = {}) => ({
  id, plate: id.toUpperCase(), unit: null, odo: '', fuel: '', isEv: false,
  damaged: false, rentalClass: '', notes: '', checked: true, sent: false, at, deleted: false, ...over,
});

describe('useAirportFlip — cross-device', () => {
  // Seeds storage directly rather than mounting a second hook: the in-flight `hydrating` guard
  // (correctly) short-circuits a second pull while the first is still awaiting, so mounting twice
  // tests the guard, not the merge. This models the real shape — this device has rows on disk, the
  // server has another, first mount reconciles.
  const seedLocal = (rows: Record<string, unknown>[]) => {
    localStorage.setItem(KEY, JSON.stringify({ day: today(), rows, at: Date.now() }));
    __resetAirportFlipStore();
  };
  const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

  it('THE BUG: a flip made on the other device survives instead of being clobbered', async () => {
    seedLocal([srvRow('mine', 100)]);
    vi.mocked(loadServerFlips).mockResolvedValue({
      day: today(), rows: [srvRow('theirs', 200)], at: 200,
    });

    const h = renderHook(() => useAirportFlip());
    await flush();

    const ids = h.result.current.rows.map(r => r.id);
    expect(ids).toContain('mine');    // ours kept — the old whole-list LWW could drop this
    expect(ids).toContain('theirs');  // theirs adopted — and it could drop this too
  });

  it('reconciling pushes the merged list back so both sides converge', async () => {
    seedLocal([srvRow('mine', 100)]);
    vi.mocked(loadServerFlips).mockResolvedValue({
      day: today(), rows: [srvRow('theirs', 200)], at: 200,
    });

    renderHook(() => useAirportFlip());
    await flush();

    expect(vi.mocked(saveServerFlips)).toHaveBeenCalled();
  });

  it('a no-op merge writes NOTHING — two devices cannot ping-pong', async () => {
    const same = srvRow('mine', 100);
    seedLocal([same]);
    vi.mocked(saveServerFlips).mockClear();
    vi.mocked(loadServerFlips).mockResolvedValue({ day: today(), rows: [{ ...same }], at: 100 });

    renderHook(() => useAirportFlip());
    await flush();

    expect(vi.mocked(saveServerFlips)).not.toHaveBeenCalled();
  });

  it('a removed row disappears from view but PERSISTS as a tombstone', () => {
    const h = renderHook(() => useAirportFlip());
    act(() => { h.result.current.add(ROW); });
    const id = h.result.current.rows[0].id;
    act(() => { h.result.current.remove(id); });

    expect(h.result.current.rows).toHaveLength(0);          // gone from the operator's list
    const stored = JSON.parse(localStorage.getItem(KEY)!);  // ...but still on the wire
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]).toMatchObject({ id, deleted: true });
  });

  it('a stale SERVER day is ignored — a yesterday payload never revives', async () => {
    vi.mocked(loadServerFlips).mockResolvedValue({
      day: '1999-01-01', rows: [srvRow('ancient', Date.now())], at: Date.now(),
    });
    const h = renderHook(() => useAirportFlip());
    await flush();
    expect(h.result.current.rows).toHaveLength(0);
  });
});
