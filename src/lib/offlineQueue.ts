import { supabase } from './supabase';

export interface OfflineAction {
  id: string; // Unique action ID (e.g., UUID)
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  eqField?: string;
  eqValue?: string | number | boolean | null;
  attempts?: number;
}

const MAX_ATTEMPTS = 3;

const STORAGE_KEY = 'fg_offline_actions';

export function getOfflineQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineAction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to save offline queue to localStorage:', err);
  }
}

export function enqueueOfflineAction(action: Omit<OfflineAction, 'id'>): string | null {
  // An insert without a client-generated primary key can't be safely de-duplicated
  // on a lost-ack retry: the flush upserts on `id` (executeOfflineAction), so a
  // PK-less insert replays as a duplicate row. Refuse it loudly. The write helpers
  // (offStandardWrite/vsaTripWrite) already supply `id`; this guards the assumption
  // at the queue level for *all* callers — the same assumption that bit in 0ffbe8e.
  if (action.action === 'insert' && action.payload.id == null) {
    console.error('[offlineQueue] refusing to enqueue a PK-less insert (would duplicate on retry):', action.table);
    return null;
  }
  const id = crypto.randomUUID();
  const fullAction: OfflineAction = { ...action, id };
  const queue = getOfflineQueue();
  queue.push(fullAction);
  saveOfflineQueue(queue);
  return id;
}

export async function executeOfflineAction(action: OfflineAction): Promise<boolean> {
  try {
    // The offline queue dispatches to arbitrary tables at runtime — bypass typed client here
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = (supabase as any).from(action.table);
    if (action.action === 'insert') {
      // Upsert with ignoreDuplicates: a lost-ack retry (row already committed)
      // resolves as a no-op instead of a PK conflict that wedges the queue.
      const { error } = await query.upsert(action.payload, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    } else if (action.action === 'update') {
      let q = query.update(action.payload);
      if (action.eqField && action.eqValue !== undefined) {
        q = q.eq(action.eqField, action.eqValue);
      }
      const { error } = await q;
      if (error) throw error;
    } else if (action.action === 'delete') {
      let q = query.delete();
      if (action.eqField && action.eqValue !== undefined) {
        q = q.eq(action.eqField, action.eqValue);
      }
      const { error } = await q;
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error(`Offline action sync failed for table ${action.table}:`, err);
    return false;
  }
}

let isFlushing = false;

export async function flushOfflineQueue(): Promise<void> {
  if (isFlushing || !navigator.onLine) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  isFlushing = true;
  console.log(`Starting to flush ${queue.length} offline actions...`);

  const remaining: OfflineAction[] = [];
  const deadLettered: OfflineAction[] = [];
  let stopFlushing = false;

  for (const action of queue) {
    if (stopFlushing) {
      remaining.push(action);
      continue;
    }

    const success = await executeOfflineAction(action);
    if (success) {
      console.log(`Successfully synced offline action ${action.id} on table ${action.table}`);
    } else {
      const attempts = (action.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        // Preserve, don't discard: move to the dead-letter queue so the write isn't
        // silently lost and the UI can surface it for retry. Continue past it so it
        // doesn't block the rest of the queue.
        console.error(`Offline action ${action.id} on table ${action.table} failed ${attempts} times — moving to dead-letter`);
        deadLettered.push({ ...action, attempts });
      } else {
        console.log(`Failed to sync offline action ${action.id}, postponing rest of queue`);
        remaining.push({ ...action, attempts });
        stopFlushing = true;
      }
    }
  }

  saveOfflineQueue(remaining);
  if (deadLettered.length > 0) {
    saveDeadLetterQueue([...getDeadLetterQueue(), ...deadLettered]);
  }
  isFlushing = false;
}

// ── Dead-letter queue ────────────────────────────────────────────────────────
// Actions that exhausted MAX_ATTEMPTS land here instead of vanishing, so a failed
// field write is recoverable and the UI can surface it (see useOfflineDeadLetter).

const DEAD_LETTER_KEY = 'fg_offline_deadletter';

export function getDeadLetterQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(DEAD_LETTER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDeadLetterQueue(queue: OfflineAction[]): void {
  try {
    localStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to save dead-letter queue to localStorage:', err);
  }
  notifyListeners();
}

/** Move every dead-lettered action back into the live queue (attempts reset) and flush. */
export async function retryDeadLetter(): Promise<void> {
  const dead = getDeadLetterQueue();
  if (dead.length === 0) return;
  saveOfflineQueue([...getOfflineQueue(), ...dead.map(a => ({ ...a, attempts: 0 }))]);
  saveDeadLetterQueue([]);
  await flushOfflineQueue();
}

/** Discard the dead-lettered actions — acknowledge the loss. */
export function clearDeadLetter(): void {
  saveDeadLetterQueue([]);
}

// Lets the UI react to dead-letter changes without polling.
type QueueListener = () => void;
const listeners = new Set<QueueListener>();

export function subscribeOfflineQueue(cb: QueueListener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function notifyListeners(): void {
  for (const cb of listeners) cb();
}
