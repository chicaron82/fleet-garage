import { useCallback, useState } from 'react';

/**
 * A write that didn't land, SAID — the write-side twin of `usePhotoIntake`'s error channel.
 *
 * ⭐⭐ WHY THIS EXISTS (2026-09-19, docs/September/ticket-writes-that-vanish-into-void.md).
 * FG's writers report failure two different ways — `recordKeyCount` THROWS, `recordOnLot` returns
 * `false` — and the tap sites discarded both. `void recordKeyCount(...)` turns a throw into an
 * unhandled rejection, which ⚠️ `AppErrorBoundary` cannot catch (React error boundaries catch
 * render errors, not promise rejections), so a failed key count produced nothing whatsoever: no
 * message, no retry, no log. A tap that does nothing reads as a missed tap, and he taps again — on
 * a car he has already walked away from.
 *
 * This is the THIRD and FOURTH instance of one defect. Reflection 61 and 62 (2026-08-24) both found
 * the same thing — *a success message claiming a write that never happened* — and the fix each time
 * was local. A shared channel is the thing that stops the fifth.
 *
 * ⚠️ BOTH failure shapes, deliberately: `guard` catches a throw AND treats an explicit `false` as
 * a failure. A caller should not have to know which kind of writer it is holding.
 *
 * ⚠️ It never invents a success. A writer that resolves `undefined` (most of FG's `Promise<void>`
 * writers) counts as landed, because that is what those writers mean by finishing — the ones that
 * can fail silently return `false` or throw.
 */
export function useWriteGuard() {
  const [writeError, setWriteError] = useState('');

  const clearWriteError = useCallback(() => setWriteError(''), []);

  /** Run a write; on failure set `message` and answer false. Never throws at the caller. */
  const guard = useCallback(async (fn: () => Promise<unknown>, message: string): Promise<boolean> => {
    setWriteError('');
    try {
      const result = await fn();
      if (result === false) { setWriteError(message); return false; }
      return true;
    } catch {
      setWriteError(message);
      return false;
    }
  }, []);

  return { writeError, clearWriteError, guard };
}
