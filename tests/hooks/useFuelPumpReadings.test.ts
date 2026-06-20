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

// Helper: return null for today's row (call 1), then a prev-day row (call 2).
function mockNoPriorThenPrev(prevData: Record<string, unknown> | null) {
  maybySingleSpy
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: prevData, error: null });
}

describe('useFuelPumpReadings — opening prefill', () => {
  it('pre-fills pump1Open and digitalOpen from the most recent closing row', async () => {
    mockNoPriorThenPrev({ pump1_close: 4200, digital_close: 95.5 });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => {
      expect(result.current.pump1Open).toBe('4200');
    });
    expect(result.current.digitalOpen).toBe('95.5');
  });

  it('leaves fields empty when no prior row exists', async () => {
    maybySingleSpy.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    // Two maybeSingle calls: today (null) then prev-day (null).
    await waitFor(() => expect(maybySingleSpy).toHaveBeenCalledTimes(2));
    expect(result.current.pump1Open).toBe('');
    expect(result.current.digitalOpen).toBe('');
  });

  it('never pre-fills pump2Reading regardless of what the prior row has', async () => {
    mockNoPriorThenPrev({ pump1_close: 4200, digital_close: 95.5 });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(result.current.pump1Open).toBe('4200'));
    expect(result.current.pump2Reading).toBe('');
  });

  it('handles a prior row where pump1_close is null (partial entry)', async () => {
    mockNoPriorThenPrev({ pump1_close: null, digital_close: 88.0 });

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

describe('useFuelPumpReadings — today-row restore', () => {
  it('restores all fields from today\'s saved row including pump2Reading', async () => {
    maybySingleSpy.mockResolvedValueOnce({
      data: {
        id: 'row-abc',
        pump1_open: 4100, pump1_close: 4200,
        pump2_reading: 1439,
        digital_open: 90.0, digital_close: 95.5,
        topup_note: 'Added 50L',
      },
      error: null,
    });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(result.current.pump1Open).toBe('4100'));
    expect(result.current.pump1Close).toBe('4200');
    expect(result.current.pump2Reading).toBe('1439');
    expect(result.current.digitalOpen).toBe('90');
    expect(result.current.digitalClose).toBe('95.5');
    // saved flag is set so the form shows "already saved"
    expect(result.current.saved).toBe(true);
    // no second query — early return after restoring today's row
    expect(maybySingleSpy).toHaveBeenCalledTimes(1);
  });

  it('does not pre-fill pump2Reading from prior-day data (requires fresh entry)', async () => {
    mockNoPriorThenPrev({ pump1_close: 4200, digital_close: 95.5, pump2_reading: 1440 });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(result.current.pump1Open).toBe('4200'));
    // pump2 must still be blank — pre-fill from prev day is intentionally excluded
    expect(result.current.pump2Reading).toBe('');
  });
});
