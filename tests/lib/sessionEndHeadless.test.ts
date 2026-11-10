// The header pill's end when the card is not mounted (src/lib/sessionEndHeadless.ts): the same writes the card's End
// makes, from the row. docs/ticket-pill-tap-ends-session.md.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { tripWrite, othWrite, insert, push } = vi.hoisted(() => ({
  tripWrite: vi.fn(async (..._a: unknown[]) => ({ ok: true })),
  othWrite: vi.fn(async (..._a: unknown[]) => ({ ok: true })),
  insert: vi.fn((_r: Record<string, unknown>) => Promise.resolve({ data: null, error: null })),
  push: vi.fn(async (..._a: unknown[]) => {}),
}));
vi.mock('../../src/lib/vsaTripWrite', () => ({ writeOrEnqueue: (...a: unknown[]) => tripWrite(...a) }));
vi.mock('../../src/lib/offStandardWrite', () => ({ writeOrEnqueue: (...a: unknown[]) => othWrite(...a) }));
vi.mock('../../src/lib/garage-uploads', () => ({ pushNotification: (...a: unknown[]) => push(...a) }));
vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: () => ({ insert: (r: Record<string, unknown>) => insert(r) }) },
  writeWithRefresh: (op: () => PromiseLike<unknown>) => op(),
}));

import { endOthHeadless, endTripHeadless, type PillTripRow } from '../../src/lib/sessionEndHeadless';
import type { User } from '../../src/types';

const USER = { id: 'u1', name: 'Aaron Sauddin', branchId: 'YWG' } as Pick<User, 'id' | 'name' | 'branchId'>;
const DEPART = '2026-11-10T02:00:00.000Z';
const at = (m: number) => new Date(Date.parse(DEPART) + m * 60_000).toISOString();
const row = (over: Partial<PillTripRow> = {}): PillTripRow => ({
  id: 'trip-1', depart_time: DEPART, auth_type: 'PERSONAL', queue_at_departure: '~5', notes: 'LUR437 up', ev_cable_status: null,
  ev_adapter_status: null, status: 'in_progress', ...over,
});

beforeEach(() => { tripWrite.mockClear(); othWrite.mockClear(); insert.mockClear(); push.mockClear(); });

describe('⭐ endTripHeadless: Back at Washbay, as the card ends it', () => {
  it('writes the arrival at the tap\'s time from the row, then the run\'s off-standard entry', async () => {
    expect(await endTripHeadless(row(), at(12), USER, '2026-11-09')).toBe(true);
    expect(tripWrite).toHaveBeenCalledWith('update', expect.objectContaining({
      arrive_time: at(12), one_way: false, status: 'complete', auth_type: 'PERSONAL', queue_at_departure: '~5',
      queue_at_arrival: null, notes: 'LUR437 up', ev_cable_status: null, ev_adapter_status: null,
    }), 'id', 'trip-1');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', date: '2026-11-09', start_time: DEPART, stop_time: at(12), minutes: 12, reason: 'OTH',
      explanation: 'VSA Airport Run', auto_from_trip: true, status: 'complete',
    }));
    expect(push).not.toHaveBeenCalled();
  });
  it('a Tesla run keeps the EV kit statuses its start wrote', async () => {
    await endTripHeadless(row({ ev_cable_status: 'present', ev_adapter_status: 'missing' }), at(12), USER, '2026-11-09');
    expect(tripWrite).toHaveBeenCalledWith('update', expect.objectContaining({ ev_cable_status: 'present', ev_adapter_status: 'missing' }), 'id', 'trip-1');
  });
  it('⭐ a long run tells the managers, as the card does', async () => {
    await endTripHeadless(row(), at(90), USER, '2026-11-09');
    expect(push).toHaveBeenCalledWith('YWG', expect.any(Array), '🐢', expect.stringContaining('90 minutes'), 'warning', expect.anything());
  });
  it('a failed arrival writes nothing else and says so', async () => {
    tripWrite.mockResolvedValueOnce({ ok: false });
    expect(await endTripHeadless(row(), at(12), USER, '2026-11-09')).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('⭐ endOthHeadless: the timer\'s End', () => {
  const o = { id: 'oth-1', start_time: DEPART, preset_reason: null, status: 'in_progress' };
  it('5 minutes and up: complete, at the tap\'s time, notes untouched (they saved as he typed)', async () => {
    expect(await endOthHeadless(o, at(14))).toBe(true);
    expect(othWrite).toHaveBeenCalledWith('update', 'off_standard_entries', { stop_time: at(14), minutes: 14, status: 'complete' }, 'id', 'oth-1');
  });
  it('under 5: thrown away, as End does', async () => {
    await endOthHeadless(o, at(3));
    expect(othWrite).toHaveBeenCalledWith('delete', 'off_standard_entries', {}, 'id', 'oth-1');
  });
});
