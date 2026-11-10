// A mounted card offers its End to the header pill while its session runs (src/hooks/useSessionEnder.ts,
// docs/ticket-pill-tap-ends-session.md): registered only while running, gone when it stops, and always the LATEST End.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SessionEnder } from '../../src/context/ActiveSessionsContext';

const slots: Record<string, SessionEnder | null> = {};
vi.mock('../../src/context/ActiveSessionsContext', () => ({
  useActiveSessions: () => ({ registerEnder: (k: string, fn: SessionEnder | null) => { slots[k] = fn; } }),
}));
import { useSessionEnder } from '../../src/hooks/useSessionEnder';

describe('useSessionEnder', () => {
  it('⭐ registers while running, calls the latest End with the tap\'s time, and unregisters when it stops', async () => {
    const first = vi.fn(async () => true);
    const second = vi.fn(async () => true);
    const { rerender } = renderHook(({ running, end }) => useSessionEnder('trip', running, end), { initialProps: { running: false, end: first } });
    expect(slots.trip ?? null).toBeNull();
    rerender({ running: true, end: first });
    rerender({ running: true, end: second });
    await slots.trip!('2026-11-10T02:12:00.000Z');
    expect(second).toHaveBeenCalledWith('2026-11-10T02:12:00.000Z');
    expect(first).not.toHaveBeenCalled();
    rerender({ running: false, end: second });
    expect(slots.trip).toBeNull();
  });
});
