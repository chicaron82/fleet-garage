// Erin St's count, server side: what one tap does to the lot_bay row (migration 153). His rulings, 2026-10-15:
// −1 is a clean USED (*"Erin St and the Regent location can poach cleans"*), counted for the shift-day; a −1 that
// fixes this phone's own +1 within 5 s is not.
import { describe, it, expect } from 'vitest';
import { bayChange, type BayRow } from '../../api/_lib/lotBay';

const NOW = '2026-10-15T16:30:00.000Z';
const TODAY = '2026-10-15';
const row = (over: Partial<BayRow> = {}): BayRow => ({ cleans: 6, dirties: 23, used: 4, used_on: TODAY, ...over });

describe('bayChange', () => {
  it('+1 is a clean parked ready: the count and its time move, used does not', () => {
    expect(bayChange(row(), { action: 'cleans', delta: 1, fix: false, by: 'AS' }, NOW, TODAY)).toEqual({
      patch: { cleans: 7, cleans_by: 'AS', cleans_at: NOW },
      tap: { kind: 'ready', value: 7, prev: 6, tapped_by: 'AS' },
    });
  });

  it('−1 is a clean used: it adds to today\'s used', () => {
    expect(bayChange(row(), { action: 'cleans', delta: -1, fix: false, by: 'AS' }, NOW, TODAY)).toEqual({
      patch: { cleans: 5, cleans_by: 'AS', cleans_at: NOW, used: 5, used_on: TODAY },
      tap: { kind: 'used', value: 5, prev: 6, tapped_by: 'AS' },
    });
  });

  it('⚠️ the first −1 of a new shift-day starts used at 1, not on top of yesterday', () => {
    const c = bayChange(row({ used: 31, used_on: '2026-10-14' }), { action: 'cleans', delta: -1, fix: false, by: 'AS' }, NOW, TODAY);
    expect(c).toMatchObject({ patch: { used: 1, used_on: TODAY } });
  });

  it('a −1 that fixes a slip lowers the count but is not a clean used', () => {
    const c = bayChange(row(), { action: 'cleans', delta: -1, fix: true, by: 'AS' }, NOW, TODAY);
    expect(c).toEqual({
      patch: { cleans: 5, cleans_by: 'AS', cleans_at: NOW },
      tap: { kind: 'fix', value: 5, prev: 6, tapped_by: 'AS' },
    });
  });

  it('refuses a −1 at 0: the count never goes negative', () => {
    expect(bayChange(row({ cleans: 0 }), { action: 'cleans', delta: -1, fix: false, by: 'AS' }, NOW, TODAY)).toHaveProperty('error');
  });

  it('a typed dirty count replaces the old one and keeps its own time', () => {
    expect(bayChange(row(), { action: 'dirties', count: 18, by: 'AS' }, NOW, TODAY)).toEqual({
      patch: { dirties: 18, dirties_by: 'AS', dirties_at: NOW },
      tap: { kind: 'dirties', value: 18, prev: 23, tapped_by: 'AS' },
    });
  });

  it('the first dirty count ever has nothing before it', () => {
    expect(bayChange(row({ dirties: null }), { action: 'dirties', count: 12, by: 'AS' }, NOW, TODAY))
      .toMatchObject({ tap: { prev: null, value: 12 } });
  });
});
