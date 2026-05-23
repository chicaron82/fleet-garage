import { supabase } from './supabase';

export interface OfflineAction {
  id: string; // Unique action ID (e.g., UUID)
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  eqField?: string;
  eqValue?: string | number | boolean | null;
}

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

export function enqueueOfflineAction(action: Omit<OfflineAction, 'id'>): string {
  const id = crypto.randomUUID();
  const fullAction: OfflineAction = { ...action, id };
  const queue = getOfflineQueue();
  queue.push(fullAction);
  saveOfflineQueue(queue);
  return id;
}

export async function executeOfflineAction(action: OfflineAction): Promise<boolean> {
  try {
    const query = supabase.from(action.table);
    if (action.action === 'insert') {
      const { error } = await query.insert(action.payload);
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
      console.log(`Failed to sync offline action ${action.id}, postponing rest of queue`);
      remaining.push(action);
      stopFlushing = true;
    }
  }

  saveOfflineQueue(remaining);
  isFlushing = false;
}

// Auto-sync when going online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOfflineQueue();
  });
}
