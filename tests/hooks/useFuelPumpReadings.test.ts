import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFuelPumpReadings } from '../../src/hooks/useFuelPumpReadings';
import type { User } from '../../src/types';

const TEST_USER: User = {
  id: 'u1', employeeId: 'EMP1', name: 'Test VSA', role: 'VSA', branchId: 'YWG',
};

const maybySingleSpy = vi.fn();

const ltSpy = vi.fn(() => queryBuilder);

// The prev-day lookup now fetches a WINDOW of rows (awaited directly) rather than one
// .maybeSingle() — so the builder resolves through `then`, and this holds what it yields.
let prevRows: Record<string, unknown>[] = [];

const queryBuilder: Record<string, unknown> = {
  select:      vi.fn(() => queryBuilder),
  eq:          vi.fn(() => queryBuilder),
  lt:          ltSpy,
  order:       vi.fn(() => queryBuilder),
  limit:       vi.fn(() => queryBuilder),
  insert:      vi.fn(() => queryBuilder),
  maybeSingle: maybySingleSpy,
  then:        vi.fn((resolve) => resolve?.({ data: prevRows, error: null })),
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
  prevRows = [];
});

// Helper: no row for today (via maybeSingle), then a history window (via the awaited builder).
function mockNoPriorThenPrev(...rows: (Record<string, unknown> | null)[]) {
  maybySingleSpy.mockResolvedValue({ data: null, error: null });
  prevRows = rows.filter(Boolean) as Record<string, unknown>[];
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

  it('leaves fields empty when no history exists at all', async () => {
    mockNoPriorThenPrev();

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(ltSpy).toHaveBeenCalledTimes(1));
    expect(result.current.pump1Open).toBe('');
    expect(result.current.digitalOpen).toBe('');
  });

  it("pre-fills pump2Open from the prior shift's pump2_close (Pump 2 back in service)", async () => {
    mockNoPriorThenPrev({ pump1_close: 4200, pump2_close: 1520, digital_close: 95.5 });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(result.current.pump1Open).toBe('4200'));
    expect(result.current.pump2Open).toBe('1520');
  });

  // ⭐ THIS TEST USED TO ASSERT THE BUG. It called a missing closing a "partial entry" and
  // pinned pump1Open to '' — which is exactly why the dead prefill survived review: someone
  // hit the case, named it, and wrote down the wrong answer. In a ONE-USER tool a shift Aaron
  // opens has nobody to log its close, so "closing is null" is the NORMAL row, not a partial
  // one, and blanking the field throws away the last real number the pump gave him.
  it('falls back to the row\'s OPENING when its closing is null (the one-user shape)', async () => {
    mockNoPriorThenPrev({ pump1_open: 437186, pump1_close: null, digital_close: 88.0 });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(result.current.pump1Open).toBe('437186'));
    expect(result.current.digitalOpen).toBe('88');
  });

  it('reproduces the live failure: two open-only rows in front of the last real closing', async () => {
    mockNoPriorThenPrev(
      { pump1_open: 437186 },                       // Aug 14 — his Friday open, no close
      { pump1_open: 436879 },                       // Aug 13 — open only
      { pump1_open: 436432, pump1_close: 436879 },  // Aug 12 — the last recorded closing
    );

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    // Old behaviour read row[0].pump1_close → null → blank. Now it carries the newest real reading.
    await waitFor(() => expect(result.current.pump1Open).toBe('437186'));
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
  it("restores all fields from today's saved row including both Pump 2 readings", async () => {
    maybySingleSpy.mockResolvedValueOnce({
      data: {
        id: 'row-abc',
        pump1_open: 4100, pump1_close: 4200,
        pump2_open: 1439, pump2_close: 1520,
        digital_open: 90.0, digital_close: 95.5,
        topup_note: 'Added 50L',
      },
      error: null,
    });

    const { result } = renderHook(() => useFuelPumpReadings(TEST_USER));

    await waitFor(() => expect(result.current.pump1Open).toBe('4100'));
    expect(result.current.pump1Close).toBe('4200');
    expect(result.current.pump2Open).toBe('1439');
    expect(result.current.pump2Close).toBe('1520');
    expect(result.current.digitalOpen).toBe('90');
    expect(result.current.digitalClose).toBe('95.5');
    // saved flag is set so the form shows "already saved"
    expect(result.current.saved).toBe(true);
    // no second query — early return after restoring today's row
    expect(maybySingleSpy).toHaveBeenCalledTimes(1);
  });
});
