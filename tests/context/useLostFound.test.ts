// The lost-found add path mints crypto.randomUUID() per call, so a double-tapped
// "log found item" would insert two rows (and duplicate the photo uploads). The
// submit lock (src/lib/submitLock.ts) collapses same-frame identical taps to one
// insert, while distinct items — the check-in intake batch, which reuses this
// same fn with one shared plate — still each insert. This guards both.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { User } from '../../src/types';

const { writeWithRefreshMock, uploadMock, resolveMock, rememberMock } = vi.hoisted(() => ({
  writeWithRefreshMock: vi.fn(),
  uploadMock: vi.fn(),
  resolveMock: vi.fn(),
  rememberMock: vi.fn(),
}));

const fromCalls: string[] = [];
const chain = {
  insert: vi.fn(() => chain),
  update: vi.fn(() => chain),
  eq:     vi.fn(() => chain),
};

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: (table: string) => { fromCalls.push(table); return chain; } },
  writeWithRefresh: (...args: unknown[]) => writeWithRefreshMock(...args),
}));

vi.mock('../../src/lib/garage-uploads', () => ({
  uploadLostFoundPhoto: (...args: unknown[]) => uploadMock(...args),
}));

vi.mock('../../src/hooks/useVehicleByPlate', () => ({
  useVehicleByPlate: () => ({
    resolve:  (...a: unknown[]) => resolveMock(...a),
    remember: (...a: unknown[]) => rememberMock(...a),
  }),
}));

import { useLostFound } from '../../src/context/useLostFound';

const USER = { id: 'u-1', name: 'Test VSA', branchId: 'YWG' } as unknown as User;

function makeSlice() {
  const { result } = renderHook(() => useLostFound(USER, 'YWG'));
  return result.current;
}

beforeEach(() => {
  vi.clearAllMocks();
  fromCalls.length = 0;
  writeWithRefreshMock.mockImplementation(async (fn: () => unknown) => { fn(); return { error: null }; });
  uploadMock.mockResolvedValue(null);
  resolveMock.mockResolvedValue(null);
});

describe('addLostFoundItem', () => {
  it('inserts one lost_found row for a single submit', async () => {
    const slice = makeSlice();
    const ok = await slice.addLostFoundItem({ description: 'Blue umbrella' });
    expect(ok).toBe(true);
    expect(fromCalls.filter(t => t === 'lost_found')).toHaveLength(1);
  });

  it('double-submit in the same frame logs exactly one item (shared lock)', async () => {
    // Keyed per reporter + content, so the second identical tap is dropped before
    // any insert — one row, one photo batch, one success.
    const slice = makeSlice();

    const p1 = slice.addLostFoundItem({ description: 'Black wallet' });
    const p2 = slice.addLostFoundItem({ description: 'Black wallet' }); // lock held → dropped
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(fromCalls.filter(t => t === 'lost_found')).toHaveLength(1);
    expect([r1, r2].filter(Boolean)).toHaveLength(1); // exactly one reports success
  });

  it('distinct items in one batch each insert (key is content, not just reporter)', async () => {
    // Mirrors the check-in intake batch: one shared plate, different descriptions.
    // The content key must let both through — a reporter-only key would collapse
    // the whole batch to one row.
    const slice = makeSlice();

    const [a, b] = await Promise.all([
      slice.addLostFoundItem({ description: 'Phone charger', licensePlate: 'ABC123' }),
      slice.addLostFoundItem({ description: 'Sunglasses',    licensePlate: 'ABC123' }),
    ]);

    expect(fromCalls.filter(t => t === 'lost_found')).toHaveLength(2);
    expect(a).toBe(true);
    expect(b).toBe(true);
  });
});
