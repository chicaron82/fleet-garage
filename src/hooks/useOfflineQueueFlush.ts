import { useEffect } from 'react';
import { flushOfflineQueue } from '../lib/offlineQueue';

/**
 * Drains the offline write queue on the triggers that actually recur in a PWA —
 * which the lone module-level `online` listener missed:
 *   - **mount**: the app reopened while already online (or an action enqueued
 *     during an online server hiccup) — the browser never fires `online`, so the
 *     queue would otherwise sit in localStorage forever.
 *   - **visibilitychange → visible**: mobile background→foreground, the common
 *     "come back to the app" path.
 *   - **online**: the offline→online transition (was the only previous trigger).
 *
 * `flushOfflineQueue` is idempotent (an `isFlushing` guard + an `onLine` check),
 * so overlapping triggers are safe no-ops. Mounted once at the app root.
 */
export function useOfflineQueueFlush(): void {
  useEffect(() => {
    void flushOfflineQueue(); // mount

    const onVisible = () => {
      if (document.visibilityState === 'visible') void flushOfflineQueue();
    };
    const onOnline = () => void flushOfflineQueue();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);
}
