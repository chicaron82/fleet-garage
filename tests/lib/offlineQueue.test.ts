import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getOfflineQueue,
  saveOfflineQueue,
  enqueueOfflineAction,
  executeOfflineAction,
  flushOfflineQueue,
  getDeadLetterQueue,
  retryDeadLetter,
  clearDeadLetter,
  subscribeOfflineQueue,
  type OfflineAction
} from '../../src/lib/offlineQueue';

// Mock Supabase
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: mockUpsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}));

describe('offlineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    
    // Default navigator.onLine to true
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOfflineQueue & saveOfflineQueue', () => {
    it('returns empty array if nothing in localStorage', () => {
      expect(getOfflineQueue()).toEqual([]);
    });

    it('saves and reads queue correctly', () => {
      const actions: OfflineAction[] = [
        { id: '1', table: 'table1', action: 'insert', payload: { x: 1 } }
      ];
      saveOfflineQueue(actions);
      expect(getOfflineQueue()).toEqual(actions);
    });

    it('returns empty array if JSON parse fails', () => {
      localStorage.setItem('fg_offline_actions', 'invalid-json');
      expect(getOfflineQueue()).toEqual([]);
    });
  });

  describe('enqueueOfflineAction', () => {
    it('generates UUID, saves action to queue, and returns ID', () => {
      const action = { table: 'table1', action: 'insert' as const, payload: { id: 'row-1', x: 1 } };
      const id = enqueueOfflineAction(action);
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');

      const queue = getOfflineQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]).toEqual({
        ...action,
        id,
      });
    });

    it('refuses a PK-less insert (would duplicate on a lost-ack retry)', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const id = enqueueOfflineAction({ table: 'table1', action: 'insert', payload: { x: 1 } });
      spy.mockRestore();
      expect(id).toBeNull();
      expect(getOfflineQueue()).toHaveLength(0);
    });

    it('allows a PK-less update/delete — only inserts need a client id', () => {
      const id = enqueueOfflineAction({ table: 'table1', action: 'update', payload: { x: 1 }, eqField: 'id', eqValue: 'a' });
      expect(typeof id).toBe('string');
      expect(getOfflineQueue()).toHaveLength(1);
    });
  });

  describe('executeOfflineAction', () => {
    it('performs insert via upsert with ignoreDuplicates — lost-ack retry is a no-op', async () => {
      mockUpsert.mockResolvedValue({ error: null });
      const action: OfflineAction = { id: '1', table: 'test_table', action: 'insert', payload: { name: 'foo' } };

      const success = await executeOfflineAction(action);
      expect(success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith({ name: 'foo' }, { onConflict: 'id', ignoreDuplicates: true });
    });

    it('performs update with filters correctly', async () => {
      const updateQuery = { eq: mockEq };
      mockUpdate.mockReturnValue(updateQuery);
      mockEq.mockResolvedValue({ error: null });

      const action: OfflineAction = {
        id: '2',
        table: 'test_table',
        action: 'update',
        payload: { name: 'bar' },
        eqField: 'id',
        eqValue: 'val-1'
      };

      const success = await executeOfflineAction(action);
      expect(success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ name: 'bar' });
      expect(mockEq).toHaveBeenCalledWith('id', 'val-1');
    });

    it('performs delete with filters correctly', async () => {
      const deleteQuery = { eq: mockEq };
      mockDelete.mockReturnValue(deleteQuery);
      mockEq.mockResolvedValue({ error: null });

      const action: OfflineAction = {
        id: '3',
        table: 'test_table',
        action: 'delete',
        payload: {},   // payload is required even for delete (unused by that branch, but non-null)
        eqField: 'id',
        eqValue: 'val-2'
      };

      const success = await executeOfflineAction(action);
      expect(success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'val-2');
    });

    it('returns false when database operation returns an error', async () => {
      mockUpsert.mockResolvedValue({ error: new Error('DB Error') });
      const action: OfflineAction = { id: '4', table: 'test_table', action: 'insert', payload: {} };

      const success = await executeOfflineAction(action);
      expect(success).toBe(false);
    });
  });

  describe('flushOfflineQueue', () => {
    it('does not flush if navigator.onLine is false', async () => {
      Object.defineProperty(navigator, 'onLine', { writable: true, value: false });
      const actions: OfflineAction[] = [
        { id: '1', table: 'table1', action: 'insert', payload: {} }
      ];
      saveOfflineQueue(actions);

      await flushOfflineQueue();
      expect(getOfflineQueue()).toHaveLength(1);
    });

    it('flushes all items chronologically on success', async () => {
      const actions: OfflineAction[] = [
        { id: '1', table: 'table1', action: 'insert', payload: { val: 1 } },
        { id: '2', table: 'table2', action: 'insert', payload: { val: 2 } },
      ];
      saveOfflineQueue(actions);

      mockUpsert.mockResolvedValue({ error: null });

      await flushOfflineQueue();
      expect(getOfflineQueue()).toHaveLength(0);
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });

    it('stops flushing and retains remaining actions on first failure', async () => {
      const actions: OfflineAction[] = [
        { id: '1', table: 'table1', action: 'insert', payload: { val: 1 } },
        { id: '2', table: 'table2', action: 'insert', payload: { val: 2 } },
        { id: '3', table: 'table3', action: 'insert', payload: { val: 3 } },
      ];
      saveOfflineQueue(actions);

      // First succeeds, second fails (below MAX_ATTEMPTS — stops queue)
      mockUpsert.mockResolvedValueOnce({ error: null });
      mockUpsert.mockResolvedValueOnce({ error: new Error('DB Error') });

      await flushOfflineQueue();

      const queue = getOfflineQueue();
      expect(queue).toHaveLength(2); // Second (attempts: 1) and third remain
      expect(queue[0].id).toBe('2');
      expect(queue[0].attempts).toBe(1);
      expect(queue[1].id).toBe('3');
      expect(mockUpsert).toHaveBeenCalledTimes(2); // First, second. Third never run.
    });

    it('dead-letters a poison action at MAX_ATTEMPTS (preserved, not lost) and keeps draining', async () => {
      const actions: OfflineAction[] = [
        { id: '1', table: 'table1', action: 'insert', payload: { id: 'r1', val: 1 }, attempts: 2 }, // one more fail = dead-letter
        { id: '2', table: 'table2', action: 'insert', payload: { id: 'r2', val: 2 } },
      ];
      saveOfflineQueue(actions);

      mockUpsert.mockResolvedValueOnce({ error: new Error('DB Error') });
      mockUpsert.mockResolvedValueOnce({ error: null });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await flushOfflineQueue();
      consoleSpy.mockRestore();

      // Main queue drained; the poison action is preserved in the dead-letter, not lost.
      expect(getOfflineQueue()).toHaveLength(0);
      expect(getDeadLetterQueue().map(a => a.id)).toEqual(['1']);
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('dead-letter retry & clear', () => {
    const dead: OfflineAction = { id: 'd1', table: 'table1', action: 'insert', payload: { id: 'r1' }, attempts: 3 };

    it('retryDeadLetter re-queues with attempts reset and flushes it through', async () => {
      localStorage.setItem('fg_offline_deadletter', JSON.stringify([dead]));
      mockUpsert.mockResolvedValue({ error: null });

      await retryDeadLetter();

      expect(getDeadLetterQueue()).toHaveLength(0); // moved out of the dead-letter
      expect(getOfflineQueue()).toHaveLength(0);    // and synced through
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    it('retryDeadLetter sends a freshly-retried failure back through the normal cycle, not straight to dead-letter', async () => {
      localStorage.setItem('fg_offline_deadletter', JSON.stringify([dead]));
      mockUpsert.mockResolvedValue({ error: new Error('still down') });
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await retryDeadLetter();
      errSpy.mockRestore();
      logSpy.mockRestore();

      // attempts reset to 0 → a single fail lands it back in the main queue (attempts 1), not re-dead-lettered
      expect(getDeadLetterQueue()).toHaveLength(0);
      expect(getOfflineQueue()).toHaveLength(1);
      expect(getOfflineQueue()[0].attempts).toBe(1);
    });

    it('clearDeadLetter discards the dead-lettered actions', () => {
      localStorage.setItem('fg_offline_deadletter', JSON.stringify([dead]));
      clearDeadLetter();
      expect(getDeadLetterQueue()).toHaveLength(0);
    });

    it('subscribeOfflineQueue notifies on dead-letter change and stops after unsubscribe', () => {
      const cb = vi.fn();
      const unsub = subscribeOfflineQueue(cb);
      clearDeadLetter();                       // → saveDeadLetterQueue → notify
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
      clearDeadLetter();
      expect(cb).toHaveBeenCalledTimes(1);      // no further calls after unsubscribe
    });
  });
});
