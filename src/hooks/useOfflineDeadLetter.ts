import { useState, useEffect } from 'react';
import {
  getDeadLetterQueue,
  subscribeOfflineQueue,
  retryDeadLetter,
  clearDeadLetter,
} from '../lib/offlineQueue';

/**
 * Live count of writes that exhausted their offline retries, plus retry/dismiss.
 * Subscribes to the dead-letter store so a banner can surface failed syncs instead
 * of letting them vanish with a console.error.
 */
export function useOfflineDeadLetter(): {
  count: number;
  retry: () => Promise<void>;
  dismiss: () => void;
} {
  const [count, setCount] = useState(() => getDeadLetterQueue().length);
  useEffect(() => {
    const update = () => setCount(getDeadLetterQueue().length);
    update();
    return subscribeOfflineQueue(update);
  }, []);
  return { count, retry: retryDeadLetter, dismiss: clearDeadLetter };
}
