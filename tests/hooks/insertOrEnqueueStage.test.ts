import { describe, it, expect, vi, beforeEach } from 'vitest';

// The offline-fallback logic behind staging an Effie write (docs/ticket-misc-effie-offline-queue.md):
// a stage captured on a dead-signal corner must NOT be lost — it queues locally and syncs on
// reconnect. These lock the four branches: offline / online-ok / online-network-error / online-real-error.

const writeWithRefresh = vi.fn();
const enqueueOfflineAction = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: () => ({ insert: () => ({}) }) },
  writeWithRefresh: (...a: unknown[]) => writeWithRefresh(...a),
}));
vi.mock('../../src/lib/offlineQueue', () => ({
  enqueueOfflineAction: (...a: unknown[]) => enqueueOfflineAction(...a),
}));

import { insertOrEnqueueStage } from '../../src/hooks/usePendingWrites';

function setOnline(v: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });
}

const PAYLOAD = { id: 'abc', proposed_by: 'u1', kind: 'hold', proposal: {}, source: 'effie-chat', photos: null };

beforeEach(() => {
  writeWithRefresh.mockReset();
  enqueueOfflineAction.mockReset().mockReturnValue('queued-id');
  setOnline(true);
});

describe('insertOrEnqueueStage', () => {
  it('offline → enqueues, never touches the network', async () => {
    setOnline(false);
    const r = await insertOrEnqueueStage(PAYLOAD);
    expect(r).toEqual({ ok: true, queued: true });
    expect(enqueueOfflineAction).toHaveBeenCalledWith({ table: 'effie_pending_writes', action: 'insert', payload: PAYLOAD });
    expect(writeWithRefresh).not.toHaveBeenCalled();
  });

  it('online + success → inserts, does not enqueue', async () => {
    writeWithRefresh.mockResolvedValue({ error: null });
    const r = await insertOrEnqueueStage(PAYLOAD);
    expect(r).toEqual({ ok: true, queued: false });
    expect(enqueueOfflineAction).not.toHaveBeenCalled();
  });

  it('online but a network error (no error code) → falls back to the queue', async () => {
    writeWithRefresh.mockResolvedValue({ error: { message: 'Failed to Fetch' } }); // no .code = network
    const r = await insertOrEnqueueStage(PAYLOAD);
    expect(r).toEqual({ ok: true, queued: true });
    expect(enqueueOfflineAction).toHaveBeenCalledOnce();
  });

  it('online + a real DB error (has a code) → fails, does NOT queue', async () => {
    writeWithRefresh.mockResolvedValue({ error: { message: 'violates constraint', code: '23505' } });
    const r = await insertOrEnqueueStage(PAYLOAD);
    expect(r).toEqual({ ok: false, queued: false });
    expect(enqueueOfflineAction).not.toHaveBeenCalled();
  });

  it('a refused enqueue (PK-less, returns null) reports not-ok', async () => {
    setOnline(false);
    enqueueOfflineAction.mockReturnValue(null);
    const r = await insertOrEnqueueStage(PAYLOAD);
    expect(r).toEqual({ ok: false, queued: true });
  });
});
