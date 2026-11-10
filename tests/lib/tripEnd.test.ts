// What a finished airport run does besides its own row (src/lib/tripEnd.ts), shared by the trip card's End and the header
// pill's end (docs/ticket-pill-tap-ends-session.md): the run's off-standard entry, and the long-run alert.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insert, push } = vi.hoisted(() => ({
  insert: vi.fn((_r: Record<string, unknown>) => Promise.resolve({ data: null, error: null })),
  push: vi.fn(async (..._a: unknown[]) => {}),
}));
vi.mock('../../src/lib/garage-uploads', () => ({ pushNotification: (...a: unknown[]) => push(...a) }));
vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: () => ({ insert: (r: Record<string, unknown>) => insert(r) }) },
  writeWithRefresh: (op: () => PromiseLike<unknown>) => op(),
}));

import { insertAutoTripEntry, notifyLongRun, tripMinutes } from '../../src/lib/tripEnd';
import { TRIP_DURATION_THRESHOLDS } from '../../src/lib/vsa-trip';
import type { User } from '../../src/types';

const USER = { id: 'u1', name: 'Aaron Sauddin', branchId: 'YWG' } as Pick<User, 'id' | 'name' | 'branchId'>;
const D = '2026-11-10T02:00:00.000Z';
const at = (m: number) => new Date(Date.parse(D) + m * 60_000).toISOString();

beforeEach(() => { insert.mockClear(); push.mockClear(); });

describe('tripEnd', () => {
  it('tripMinutes rounds as the card always has', () => {
    expect(tripMinutes(D, at(12.4))).toBe(12);
    expect(tripMinutes(D, at(4.5))).toBe(5);
  });
  it('⭐ the run\'s off-standard entry: 5 minutes and up only', async () => {
    expect(await insertAutoTripEntry(USER, D, at(4.4), '2026-11-09')).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    expect(await insertAutoTripEntry(USER, D, at(12), '2026-11-09')).toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ minutes: 12, reason: 'OTH', explanation: 'VSA Airport Run', auto_from_trip: true, date: '2026-11-09' }));
  });
  it('⭐ the alert goes past the threshold, never at it', async () => {
    await notifyLongRun(USER, D, at(TRIP_DURATION_THRESHOLDS.alert));
    expect(push).not.toHaveBeenCalled();
    await notifyLongRun(USER, D, at(TRIP_DURATION_THRESHOLDS.alert + 1));
    expect(push).toHaveBeenCalledWith('YWG', expect.any(Array), '🐢', `Long airport run — Aaron Sauddin · Airport Run · ${TRIP_DURATION_THRESHOLDS.alert + 1} minutes`, 'warning', expect.anything());
  });
});
