import { useEffect, useState } from 'react';
import { currentGaveUp, dismissGaveUp, subscribeGaveUp } from '../../lib/gaveUpNotice';

/**
 * Shown when FG stopped waiting on a save that creates something new.
 *
 * ⚠️ Fixed above everything, not in the page flow like `OfflineSyncBanner`: the saves this speaks
 * for are sent from sheets and full-screen forms, which would cover a banner in the shell.
 * ⚠️ It stays until he dismisses it. The screen underneath is telling him to tap again, and this is
 * the line that says look first, so it must not time itself out while he is reading the other one.
 */
export function GaveUpNotice() {
  const [at, setAt] = useState<number | null>(() => currentGaveUp());
  useEffect(() => subscribeGaveUp(setAt), []);

  if (at === null) return null;

  return (
    <div
      role="alert"
      className="fixed top-2 inset-x-2 z-[200] mx-auto max-w-md flex items-start justify-between gap-3 px-4 py-3 rounded-xl shadow-lg bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700"
    >
      <p className="text-sm text-amber-900 dark:text-amber-200">
        <span className="font-semibold">FG stopped waiting on that save.</span>{' '}
        It may have gone through anyway. Check before you tap again.
      </p>
      <button
        type="button"
        onClick={dismissGaveUp}
        className="shrink-0 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
      >
        OK
      </button>
    </div>
  );
}
