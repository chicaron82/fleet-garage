import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFuelPumpReadings } from '../../src/hooks/useFuelPumpReadings';
import type { User } from '../../src/types';

const TEST_USER: User = {
  id: 'u1', employeeId: 'EMP1', name: 'Test VSA', role: 'VSA', branchId: 'YWG',
};

const maybySingleSpy = vi.fn();

const ltSpy = vi.fn(() => queryBuilder);

const queryBuilder: Record<string, unknown> = {
  select:      vi.fn(() => queryBuilder),
  eq:          vi.fn(() => queryBuilder),
  lt:          ltSpy,
  order:       vi.fn(() => queryBuilder),
  limit:       vi.fn(() => queryBuilder),
  insert:      vi.fn(() => queryBuilder),
  maybeSingle: maybySingleSpy,
  then:        vi.fn((resolve) => resolve?.({ data: null, error: null })),
};

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: vi.fn(() => queryBuilder) },
  writeWithRefresh: vi.fn(async (cb: () => Promise<unknown>) => {
    await cb();
    return { error: null };
  }),
}));

vi.mock('../../src/hooks/useFleetBalance', () => ({
  localDateStr: vi.fn(() => '2026-06-20'),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFuelPumpReadings — opening prefill', () => {
  it('pre-fills pump1Open and digitalOpen from the most recent closing row', async () => {
    maybySingleSpy.mockResolvedValue({
      data: { pump1_close: 4200, digital_close: 95.5 },
      error: null,
    });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => {
      expect(result.current.pump1Open).toBe('4200');
    });
    expect(result.current.digitalOpen).toBe('95.5');
  });

  it('leaves fields empty when no prior row exists', async () => {
    maybySingleSpy.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(maybySingleSpy).toHaveBeenCalledTimes(1));
    expect(result.current.pump1Open).toBe('');
    expect(result.current.digitalOpen).toBe('');
  });

  it('never pre-fills pump2Reading regardless of what the prior row has', async () => {
    maybySingleSpy.mockResolvedValue({
      data: { pump1_close: 4200, digital_close: 95.5 },
      error: null,
    });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(result.current.pump1Open).toBe('4200'));
    expect(result.current.pump2Reading).toBe('');
  });

  it('handles a prior row where pump1_close is null (partial entry)', async () => {
    maybySingleSpy.mockResolvedValue({
      data: { pump1_close: null, digital_close: 88.0 },
      error: null,
    });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(result.current.digitalOpen).toBe('88'));
    expect(result.current.pump1Open).toBe('');
  });

  it('excludes today\'s row so a re-opened form does not seed closing as opening', async () => {
    maybySingleSpy.mockResolvedValue({ data: null, error: null });
    renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(ltSpy).toHaveBeenCalledTimes(1));
    // The lt filter must be on the date column, excluding today.
    expect(ltSpy).toHaveBeenCalledWith('date', '2026-06-20');
  });
});
