import { useState } from 'react';
import { useOfflineDeadLetter } from '../../hooks/useOfflineDeadLetter';

/**
 * Persistent banner shown when field writes have exhausted their offline retries.
 * Without it, a failed trip/OTH write died with a console.error nobody sees. Lets
 * the crew retry (re-queue + flush) or dismiss (acknowledge the loss).
 */
export function OfflineSyncBanner() {
  const { count, retry, dismiss } = useOfflineDeadLetter();
  const [retrying, setRetrying] = useState(false);

  if (count === 0) return null;

  const handleRetry = async () => {
    setRetrying(true);
    await retry();
    setRetrying(false);
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 transition-colors">
      <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
        ⚠ {count} write{count !== 1 ? 's' : ''} couldn’t sync
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs font-medium text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
