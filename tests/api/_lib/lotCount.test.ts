import { describe, it, expect } from 'vitest';
import { fakeDb, type Row } from '../_fakeLotDb';
import { bayChange, type BayRequest, type BayRow } from '../../../api/_lib/lotBay';
import { COUNT_BUSY, COUNT_TRIES, moveCountSafely } from '../../../api/_lib/lotCount';

// ⚠️ Two taps in flight together used to save ONE: both read the same count, both wrote the same answer. His tap log
// has it at least ten times (Oct 15, three +1s from 0 saved 1). docs/ticket-erin-count-drops-a-tap.md

const NOW = '2026-11-08T18:00:00.000Z';
const TODAY = '2026-11-08';
const plusOne: BayRequest = { action: 'cleans', delta: 1, fix: false, by: 'AS' };
const minusOne: BayRequest = { action: 'cleans', delta: -1, fix: false, by: 'AS' };

const lot = (row: Partial<BayRow> = {}) => {
  const tables: Record<string, Row[]> = {
    lot_bay: [{ id: 1, cleans: 0, dirties: null, used: 0, used_on: null, ...row }],
    lot_bay_taps: [],
  };
  return { tables, db: fakeDb(tables), bay: () => tables.lot_bay[0] as unknown as BayRow };
};

/** A compute that lets ANOTHER phone's tap land after this one has read the row, `times` times. */
const racedBy = (tables: Record<string, Row[]>, other: BayRequest, req: BayRequest, times = 1) => {
  let left = times;
  return (row: BayRow) => {
    if (left-- > 0) {
      const theirs = bayChange(tables.lot_bay[0] as unknown as BayRow, other, NOW, TODAY);
      if (!('error' in theirs)) Object.assign(tables.lot_bay[0], theirs.patch);
    }
    return bayChange(row, req, NOW, TODAY);
  };
};

describe('moveCountSafely — a tap is never lost to another landing at the same moment', () => {
  it('⭐ two +1s from 0 that overlap save 2, not 1', async () => {
    const { tables, db, bay } = lot();
    const r = await moveCountSafely(db, racedBy(tables, plusOne, plusOne));
    expect(r.kind).toBe('saved');
    expect(bay().cleans).toBe(2);
  });

  it('⭐ two −1s from 20 that overlap save 18, and BOTH count as used', async () => {
    const { tables, db, bay } = lot({ cleans: 20, used: 3, used_on: TODAY });
    await moveCountSafely(db, racedBy(tables, minusOne, minusOne));
    expect(bay().cleans).toBe(18);
    expect(bay().used).toBe(5);
  });

  it('a race on the DIRTIES is caught too (a clean +1 takes a dirty)', async () => {
    const { tables, db, bay } = lot({ cleans: 4, dirties: 6 });
    const dirtiesOff: BayRequest = { action: 'dirtiesStep', delta: -1, by: 'AS' };
    await moveCountSafely(db, racedBy(tables, dirtiesOff, plusOne));
    expect(bay()).toMatchObject({ cleans: 5, dirties: 4 });
  });

  it('a clean read saves at once and leaves its tap row', async () => {
    const { tables, db, bay } = lot({ cleans: 3 });
    const r = await moveCountSafely(db, row => bayChange(row, plusOne, NOW, TODAY));
    expect(r.kind).toBe('saved');
    expect(bay().cleans).toBe(4);
    expect(tables.lot_bay_taps).toHaveLength(1);
  });

  it('a refusal from the rule is passed on, and nothing is written', async () => {
    const { tables, db, bay } = lot({ cleans: 0 });
    const r = await moveCountSafely(db, row => bayChange(row, minusOne, NOW, TODAY));
    expect(r).toEqual({ kind: 'refused', error: 'Already at 0 cleans.' });
    expect(bay().cleans).toBe(0);
    expect(tables.lot_bay_taps).toHaveLength(0);
  });

  it('losing every race refuses with a sentence — never a stale write', async () => {
    const { tables, db, bay } = lot({ cleans: 10 });
    const r = await moveCountSafely(db, racedBy(tables, plusOne, plusOne, COUNT_TRIES));
    expect(r).toEqual({ kind: 'refused', error: COUNT_BUSY });
    expect(bay().cleans).toBe(10 + COUNT_TRIES);   // only the other phone's taps landed
  });
});
