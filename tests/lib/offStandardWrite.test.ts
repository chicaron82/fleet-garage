// Guards on the off-standard offline-write helper. The two refusals here are the
// "safe by helper, not by caller discipline" guarantees: an unscoped delete (would
// wipe the table) and an insert missing its primary key (couldn't be de-duplicated
// on an offline retry → dupe row). Both must short-circuit before any write/enqueue.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { enqueueSpy, writeWithRefreshSpy, fromSpy } = vi.hoisted(() => ({
  enqueueSpy:          vi.fn(),
  writeWithRefreshSpy: vi.fn(),
  fromSpy:             vi.fn(),
}));

vi.mock('../../src/lib/offlineQueue', () => ({
  enqueueOfflineAction: (...args: unknown[]) => enqueueSpy(...args),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase:         { from: (...args: unknown[]) => fromSpy(...args) },
  writeWithRefresh: (...args: unknown[]) => writeWithRefreshSpy(...args),
}));

import { writeOrEnqueue } from '../../src/lib/offStandardWrite';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('offStandardWrite.writeOrEnqueue guards', () => {
  it('refuses an insert missing its primary key without writing or enqueueing', async () => {
    const res = await writeOrEnqueue('insert', 'off_standard_entries', { user_id: 'u1' });

    expect(res).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('insert missing its primary key'),
    );
    expect(writeWithRefreshSpy).not.toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('treats an explicit null id the same as a missing one', async () => {
    const res = await writeOrEnqueue('insert', 'holds', { id: null, foo: 1 });

    expect(res).toEqual({ ok: false });
    expect(writeWithRefreshSpy).not.toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('refuses an unscoped delete without writing or enqueueing', async () => {
    const res = await writeOrEnqueue('delete', 'off_standard_entries', {});

    expect(res).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('unscoped delete'),
    );
    expect(writeWithRefreshSpy).not.toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('lets an insert carrying a primary key through to the write', async () => {
    writeWithRefreshSpy.mockResolvedValue({ error: null });

    const res = await writeOrEnqueue('insert', 'off_standard_entries', { id: 'abc-123', user_id: 'u1' });

    expect(res).toEqual({ ok: true });
    expect(writeWithRefreshSpy).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('lets a scoped delete through to the write', async () => {
    writeWithRefreshSpy.mockResolvedValue({ error: null });

    const res = await writeOrEnqueue('delete', 'off_standard_entries', {}, 'id', 'abc-123');

    expect(res).toEqual({ ok: true });
    expect(writeWithRefreshSpy).toHaveBeenCalledTimes(1);
  });
});
