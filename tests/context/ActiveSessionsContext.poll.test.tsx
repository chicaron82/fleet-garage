// The active-sessions poll sleeps while FG is hidden (docs/ticket-battery-poll-sleeps-when-hidden.md). Aaron, 2026-11-17:
// *"using FG more to keep the bay log updated is draining my batter"*. The provider is mounted app-wide and asked the DB
// every 15 s on every screen, hidden or not. Now: no poll while hidden, one fresh read the moment FG is visible again.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';

const from = vi.fn();
vi.mock('../../src/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => from(...a) } }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
const { ActiveSessionsProvider, useActiveSessions } = await import('../../src/context/ActiveSessionsContext');

function Clock() { return <p data-testid="clock">{useActiveSessions().nowMs}</p>; }

function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'is', 'eq', 'order']) b[m] = () => b;
  b.limit = () => Promise.resolve({ data: [] });
  return b;
}

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (v: DocumentVisibilityState) => {
  visibility = v;
  document.dispatchEvent(new Event('visibilitychange'));
};
const reads = () => from.mock.calls.length / 2;   // one refresh = two queries (trip + off-standard)

describe('ActiveSessionsProvider: the poll sleeps while FG is hidden', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    from.mockReset();
    from.mockImplementation(builder);
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('reads once on mount, then every 15 s while visible', async () => {
    render(<ActiveSessionsProvider><p>app</p></ActiveSessionsProvider>);
    await act(async () => {});
    expect(reads()).toBe(1);
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(reads()).toBe(3);
  });

  it('⭐ hidden: a whole minute passes with no reads at all', async () => {
    render(<ActiveSessionsProvider><p>app</p></ActiveSessionsProvider>);
    await act(async () => {});
    await act(async () => { setVisibility('hidden'); });
    const before = reads();
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(reads()).toBe(before);
  });

  it('⭐ visible again: one fresh read right away, then the 15 s poll resumes', async () => {
    render(<ActiveSessionsProvider><p>app</p></ActiveSessionsProvider>);
    await act(async () => {});
    await act(async () => { setVisibility('hidden'); vi.advanceTimersByTime(60_000); });
    const before = reads();
    await act(async () => { setVisibility('visible'); });
    expect(reads()).toBe(before + 1);
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(reads()).toBe(before + 2);
  });

  it('⭐ with a trip running, the 1 s clock freezes while hidden and catches up when visible', async () => {
    from.mockImplementation((table: string) => {
      const b = builder();
      if (table === 'vsa_trips') b.limit = () => Promise.resolve({ data: [{ id: 't1', depart_time: new Date().toISOString() }] });
      return b;
    });
    const { getByTestId } = render(<ActiveSessionsProvider><Clock /></ActiveSessionsProvider>);
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1_000); });
    await act(async () => { setVisibility('hidden'); });
    const frozen = getByTestId('clock').textContent;
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(getByTestId('clock').textContent).toBe(frozen);
    await act(async () => { setVisibility('visible'); vi.advanceTimersByTime(1_000); });
    expect(Number(getByTestId('clock').textContent)).toBeGreaterThan(Number(frozen));
  });
});
