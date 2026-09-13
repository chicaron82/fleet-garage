import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFleetSync } from '../../src/hooks/useFleetSync';
import type { Vehicle } from '../../src/types';

// Each call to supabase.from('vehicles').select(...) resolves with the next queued response.
// The seed query ends in .limit(1); the delta query ends in .order(...). Both are awaited
// directly, so the builder is thenable.
let responses: { data: Record<string, unknown>[] | null; error: unknown }[] = [];
const gteSpy = vi.fn(() => queryBuilder);

const queryBuilder: Record<string, unknown> = {
  select: vi.fn(() => queryBuilder),
  order:  vi.fn(() => queryBuilder),
  limit:  vi.fn(() => queryBuilder),
  gte:    gteSpy,
  then:   vi.fn((resolve) => resolve?.(responses.shift() ?? { data: [], error: null })),
};

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: vi.fn(() => queryBuilder) },
}));

const row = (id: string, updatedAt: string, plate: string) => ({
  id, updated_at: updatedAt, created_at: updatedAt, license_plate: plate,
  unit_number: null, make: 'Ford', model: 'F-150', year: 2024, color: 'Gray',
  status: 'CLEAR', branch_id: 'YWG',
});

const existing = (id: string, plate: string) => ({ id, licensePlate: plate } as Vehicle);

function foreground() {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

beforeEach(() => {
  vi.clearAllMocks();
  responses = [];
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('useFleetSync', () => {
  it('seeds a watermark on mount without pulling the fleet', async () => {
    responses = [{ data: [{ updated_at: '2026-09-12T10:00:00Z' }], error: null }];
    const setAll = vi.fn();
    renderHook(() => useFleetSync(setAll));
    await waitFor(() => expect(queryBuilder.limit).toHaveBeenCalledWith(1));
    // The seed reads one column of one row — never `select('*')`, which is the 1.2 MB mistake.
    expect(queryBuilder.select).toHaveBeenCalledWith('updated_at');
    expect(setAll).not.toHaveBeenCalled();
  });

  it('⭐ pulls only rows newer than the watermark when the app comes back', async () => {
    responses = [
      { data: [{ updated_at: '2026-09-12T10:00:00Z' }], error: null },          // seed
      { data: [row('v2', '2026-09-12T18:00:00Z', 'LZM527')], error: null },     // delta
    ];
    const setAll = vi.fn();
    renderHook(() => useFleetSync(setAll));
    await waitFor(() => expect(queryBuilder.limit).toHaveBeenCalledWith(1));

    foreground();
    await waitFor(() => expect(setAll).toHaveBeenCalled());
    expect(gteSpy).toHaveBeenCalledWith('updated_at', '2026-09-12T10:00:00Z');
  });

  it('⭐ replaces a row he changed on another device — the reported bug', async () => {
    responses = [
      { data: [{ updated_at: '2026-09-12T10:00:00Z' }], error: null },
      { data: [row('v1', '2026-09-12T18:00:00Z', 'LFJ213')], error: null },
    ];
    const setAll = vi.fn();
    renderHook(() => useFleetSync(setAll));
    await waitFor(() => expect(queryBuilder.limit).toHaveBeenCalledWith(1));

    foreground();
    await waitFor(() => expect(setAll).toHaveBeenCalled());

    const merge = setAll.mock.calls[0][0] as (prev: Vehicle[]) => Vehicle[];
    const next = merge([existing('v1', 'STALE99'), existing('v9', 'LUR100')]);
    expect(next).toHaveLength(2);                              // updated in place, not duplicated
    expect(next.find(v => v.id === 'v1')?.licensePlate).toBe('LFJ213');
    expect(next.map(v => v.id)).toEqual(['v1', 'v9']);          // order preserved
  });

  it('puts a car registered elsewhere at the FRONT, not the bottom of his list', async () => {
    responses = [
      { data: [{ updated_at: '2026-09-12T10:00:00Z' }], error: null },
      { data: [row('new1', '2026-09-12T18:00:00Z', 'MCM564')], error: null },
    ];
    const setAll = vi.fn();
    renderHook(() => useFleetSync(setAll));
    await waitFor(() => expect(queryBuilder.limit).toHaveBeenCalledWith(1));

    foreground();
    await waitFor(() => expect(setAll).toHaveBeenCalled());
    const merge = setAll.mock.calls[0][0] as (prev: Vehicle[]) => Vehicle[];
    expect(merge([existing('v9', 'LUR100')]).map(v => v.id)).toEqual(['new1', 'v9']);
  });

  it('does not touch state when nothing changed', async () => {
    responses = [
      { data: [{ updated_at: '2026-09-12T10:00:00Z' }], error: null },
      { data: [], error: null },
    ];
    const setAll = vi.fn();
    renderHook(() => useFleetSync(setAll));
    await waitFor(() => expect(queryBuilder.limit).toHaveBeenCalledWith(1));

    foreground();
    await waitFor(() => expect(gteSpy).toHaveBeenCalled());
    expect(setAll).not.toHaveBeenCalled();
  });

  it('⚠️ throttles, so app-switching cannot hammer the roster', async () => {
    responses = [
      { data: [{ updated_at: '2026-09-12T10:00:00Z' }], error: null },
      { data: [], error: null },
    ];
    renderHook(() => useFleetSync(vi.fn()));
    await waitFor(() => expect(queryBuilder.limit).toHaveBeenCalledWith(1));

    foreground();
    await waitFor(() => expect(gteSpy).toHaveBeenCalledTimes(1));
    foreground();
    foreground();
    await waitFor(() => expect(gteSpy).toHaveBeenCalledTimes(1));
  });

  it('stays put while the tab is hidden — a background sync helps nobody', async () => {
    responses = [{ data: [{ updated_at: '2026-09-12T10:00:00Z' }], error: null }];
    renderHook(() => useFleetSync(vi.fn()));
    await waitFor(() => expect(queryBuilder.limit).toHaveBeenCalledWith(1));

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(gteSpy).not.toHaveBeenCalled();
  });

  it('⚠️ a failed seed defers rather than going permanently inert', async () => {
    responses = [
      { data: null, error: { message: 'offline' } },                        // seed fails at startup
      { data: [{ updated_at: '2026-09-12T10:00:00Z' }], error: null },      // re-seed on foreground
      { data: [], error: null },
    ];
    renderHook(() => useFleetSync(vi.fn()));
    await waitFor(() => expect(queryBuilder.limit).toHaveBeenCalledWith(1));

    foreground();
    await waitFor(() => expect(gteSpy).toHaveBeenCalledWith('updated_at', '2026-09-12T10:00:00Z'));
  });

  it('also syncs when the network comes back', async () => {
    responses = [
      { data: [{ updated_at: '2026-09-12T10:00:00Z' }], error: null },
      { data: [], error: null },
    ];
    renderHook(() => useFleetSync(vi.fn()));
    await waitFor(() => expect(queryBuilder.limit).toHaveBeenCalledWith(1));

    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(gteSpy).toHaveBeenCalled());
  });
});
