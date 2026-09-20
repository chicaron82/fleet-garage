import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWriteGuard } from '../../src/hooks/useWriteGuard';

// ⭐⭐ THE WRITE-SIDE TWIN OF `usePhotoIntake`'s error channel (2026-09-19,
// docs/September/ticket-writes-that-vanish-into-void.md). FG's writers report failure two ways —
// `recordKeyCount` THROWS, `recordOnLot` returns `false` — and the tap sites discarded both. A
// `void`-ed throw is an unhandled rejection, which ⚠️ `AppErrorBoundary` cannot catch (React error
// boundaries catch RENDER errors, not promise rejections), so a failed key count produced nothing
// at all. This hook exists so no caller has to know which kind of writer it is holding.

const MSG = "That didn't save — tap it again.";

describe('useWriteGuard', () => {
  it('a write that lands reports true and says nothing', async () => {
    const { result } = renderHook(() => useWriteGuard());
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.guard(async () => undefined, MSG); });
    expect(ok).toBe(true);
    expect(result.current.writeError).toBe('');
  });

  // ⚠️ FAILURE SHAPE ONE: a writer that throws. This is `recordKeyCount`, and the reason this hook
  // exists — three tap sites called it into a `void`.
  it('⚠️ catches a THROW, says so, and never rethrows at the caller', async () => {
    const { result } = renderHook(() => useWriteGuard());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.guard(async () => { throw new Error('Failed to record key count'); }, MSG);
    });
    expect(ok).toBe(false);
    expect(result.current.writeError).toBe(MSG);
  });

  // ⚠️ FAILURE SHAPE TWO: a writer that returns false. This is `recordOnLot` / `recordWinterTires`,
  // where the tap simply did nothing and read as a missed tap.
  it('⚠️ treats an explicit FALSE as a failure too', async () => {
    const { result } = renderHook(() => useWriteGuard());
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.guard(async () => false, MSG); });
    expect(ok).toBe(false);
    expect(result.current.writeError).toBe(MSG);
  });

  // ⚠️ AND NOT A FALSE ALARM. Most of FG's writers are `Promise<void>`; finishing IS their success.
  // A hook that called `undefined` a failure would cry wolf on every successful tap.
  it('⚠️ a void writer resolving undefined is a SUCCESS, not a failure', async () => {
    const { result } = renderHook(() => useWriteGuard());
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.guard(async () => { /* void writer */ }, MSG); });
    expect(ok).toBe(true);
    expect(result.current.writeError).toBe('');
  });

  it('a later success clears the note — the screen must not keep an answered complaint', async () => {
    const { result } = renderHook(() => useWriteGuard());
    await act(async () => { await result.current.guard(async () => false, MSG); });
    expect(result.current.writeError).toBe(MSG);
    await act(async () => { await result.current.guard(async () => undefined, MSG); });
    expect(result.current.writeError).toBe('');
  });

  it('clearWriteError drops it without running anything', async () => {
    const { result } = renderHook(() => useWriteGuard());
    await act(async () => { await result.current.guard(async () => false, MSG); });
    act(() => result.current.clearWriteError());
    expect(result.current.writeError).toBe('');
  });

  it('runs the write exactly once', async () => {
    const write = vi.fn(async () => undefined);
    const { result } = renderHook(() => useWriteGuard());
    await act(async () => { await result.current.guard(write, MSG); });
    expect(write).toHaveBeenCalledTimes(1);
  });
});
