import { describe, it, expect } from 'vitest';
import { applyReading, EMPTY_READINGS, enqueueReading, parseQueue, readingsFromRow, settleReading, withQueued, type QueuedReading } from '../../src/lib/lotAirport';

const t = (m: number) => new Date(Date.parse('2026-10-18T17:00:00Z') + m * 60_000).toISOString();

describe('enqueueReading — one waiting tap per reading, the newest', () => {
  it('a second tap on the same reading replaces the first; other readings keep theirs', () => {
    let q: QueuedReading[] = [];
    q = enqueueReading(q, { field: 'cleans', value: 1, at: t(0) });
    q = enqueueReading(q, { field: 'returns', value: 0, at: t(1) });
    q = enqueueReading(q, { field: 'cleans', value: 3, at: t(2) });
    expect(q).toEqual([{ field: 'returns', value: 0, at: t(1) }, { field: 'cleans', value: 3, at: t(2) }]);
  });
  it('⚠️ two taps in the same millisecond: the later call wins', () => {
    const q = enqueueReading([{ field: 'cleans', value: 1, at: t(0) }], { field: 'cleans', value: 3, at: t(0) });
    expect(q).toEqual([{ field: 'cleans', value: 3, at: t(0) }]);
  });
  it('⚠️ an OLDER tap never replaces a newer one already waiting', () => {
    const q = enqueueReading([{ field: 'aisle', value: 1, at: t(5) }], { field: 'aisle', value: 0, at: t(4) });
    expect(q).toEqual([{ field: 'aisle', value: 1, at: t(5) }]);
  });
});

describe('settleReading', () => {
  it('drops the tap the server answered', () => {
    expect(settleReading([{ field: 'cleans', value: 1, at: t(0) }], { field: 'cleans', value: 1, at: t(0) })).toEqual([]);
  });
  it('⚠️ keeps a NEWER tap made while the old one was in flight', () => {
    const newer = { field: 'cleans' as const, value: 4, at: t(1) };
    expect(settleReading([newer], { field: 'cleans', value: 1, at: t(0) })).toEqual([newer]);
  });
});

describe('applyReading — the tapper sees it at once', () => {
  it('sets the notch, who and when; the aisle as a flag', () => {
    expect(applyReading(EMPTY_READINGS, { field: 'cleans', value: 0, at: t(0) }, 'AS')).toMatchObject({ cleans: 0, cleansBy: 'AS', cleansAt: t(0) });
    expect(applyReading(EMPTY_READINGS, { field: 'aisle', value: 1, at: t(0) }, 'AS')).toMatchObject({ aisle: true, aisleBy: 'AS' });
  });
});

describe('readingsFromRow / parseQueue — nothing malformed gets through', () => {
  it('a notch off the scale reads as never read', () => {
    expect(readingsFromRow({ cleans: 9, cleans_by: null, cleans_at: null, returns: 2, returns_by: 'AS', returns_at: t(0), aisle: false, aisle_by: null, aisle_at: null }))
      .toMatchObject({ cleans: null, returns: 2 });
  });
  it('a stored queue that is junk, or has junk entries, is cleaned rather than sent', () => {
    expect(parseQueue('not json')).toEqual([]);
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue(JSON.stringify([{ field: 'cleans', value: 2, at: t(0) }, { field: 'stalls', value: 1, at: t(0) }, { field: 'returns', value: 1, at: 'soon' }])))
      .toEqual([{ field: 'cleans', value: 2, at: t(0) }]);
  });
});

describe('withQueued — what the tapping phone shows', () => {
  it('a waiting tap shows over an older reading', () => {
    const live = { ...EMPTY_READINGS, cleans: 4 as const, cleansAt: t(0) };
    expect(withQueued(live, [{ field: 'cleans', value: 0, at: t(3) }], 'AS')).toMatchObject({ cleans: 0, cleansBy: 'AS' });
  });
  it('⚠️ a fresher reading from another phone is never hidden by an older waiting tap', () => {
    const live = { ...EMPTY_READINGS, returns: 4 as const, returnsAt: t(10), returnsBy: 'JD' };
    expect(withQueued(live, [{ field: 'returns', value: 0, at: t(3) }], 'AS')).toMatchObject({ returns: 4, returnsBy: 'JD' });
  });
});
