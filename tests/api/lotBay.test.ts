// Erin St's count, server side: what one tap does to the lot_bay row (migration 153). His rulings, 2026-10-15:
// −1 is a clean USED (*"Erin St and the Regent location can poach cleans"*), counted for the shift-day; a −1 that
// fixes this phone's own +1 within 5 s is not.
import { describe, it, expect } from 'vitest';
import { bayChange, heldExitChange, type BayRow } from '../../api/_lib/lotBay';

const NOW = '2026-10-15T16:30:00.000Z';
const TODAY = '2026-10-15';
const row = (over: Partial<BayRow> = {}): BayRow => ({ cleans: 6, dirties: 23, used: 4, used_on: TODAY, ...over });

describe('bayChange', () => {
  it('+1 is a clean parked ready: the count and its time move, used does not', () => {
    expect(bayChange(row({ dirties: 0 }), { action: 'cleans', delta: 1, fix: false, by: 'AS' }, NOW, TODAY)).toEqual({
      patch: { cleans: 7, cleans_by: 'AS', cleans_at: NOW },
      tap: { kind: 'ready', value: 7, prev: 6, tapped_by: 'AS' },
    });
  });

  // 2026-10-21: *"I finish cleaning 1 so that means 1 less dirty on the board"* (ticket-erin-clean-plus-takes-a-dirty).
  describe('⭐ a clean +1 takes a dirty', () => {
    it('one save moves both pools, both stamped', () => {
      expect(bayChange(row(), { action: 'cleans', delta: 1, fix: false, by: 'AS' }, NOW, TODAY)).toEqual({
        patch: { cleans: 7, cleans_by: 'AS', cleans_at: NOW, dirties: 22, dirties_by: 'AS', dirties_at: NOW },
        tap: { kind: 'ready', value: 7, prev: 6, tapped_by: 'AS' },
      });
    });
    it('dirties at 0 (or never counted) stay put: the clean still counts', () => {
      expect(bayChange(row({ dirties: 0 }), { action: 'cleans', delta: 1, fix: false, by: 'AS' }, NOW, TODAY)).not.toHaveProperty('patch.dirties');
      expect(bayChange(row({ dirties: null }), { action: 'cleans', delta: 1, fix: false, by: 'AS' }, NOW, TODAY)).not.toHaveProperty('patch.dirties');
    });
    it('a slip fix gives the dirty back only when told its +1 took one', () => {
      const back = bayChange(row({ cleans: 7, dirties: 22 }), { action: 'cleans', delta: -1, fix: true, giveDirty: true, by: 'AS' }, NOW, TODAY);
      expect(back).toMatchObject({ patch: { cleans: 6, dirties: 23, dirties_at: NOW } });
      const none = bayChange(row({ cleans: 7, dirties: 0 }), { action: 'cleans', delta: -1, fix: true, by: 'AS' }, NOW, TODAY);
      expect(none).not.toHaveProperty('patch.dirties');
    });
    it('a real −1 (a clean used) never touches dirties, even if the phone says giveDirty', () => {
      const used = bayChange(row(), { action: 'cleans', delta: -1, fix: false, giveDirty: true, by: 'AS' }, NOW, TODAY);
      expect(used).not.toHaveProperty('patch.dirties');
      expect(used).toMatchObject({ patch: { used: 5 } });
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

// 2026-10-29: a bay car out on M hold or B hold is off the dirties, never onto the cleans
// (docs/ticket-bay-hold-exit-takes-a-dirty.md).
describe('heldExitChange', () => {
  it('take: one off the dirties, stamped, the cleans untouched', () => {
    expect(heldExitChange(row(), 'take', 'AS', NOW)).toEqual({
      patch: { dirties: 22, dirties_by: 'AS', dirties_at: NOW },
      tap: { kind: 'held', value: 22, prev: 23, tapped_by: 'AS' },
    });
  });
  it('take at 0, or never counted: nothing to write', () => {
    expect(heldExitChange(row({ dirties: 0 }), 'take', 'AS', NOW)).toBeNull();
    expect(heldExitChange(row({ dirties: null }), 'take', 'AS', NOW)).toBeNull();
  });
  it('give: the Undo puts it back, logged as an undo', () => {
    expect(heldExitChange(row({ dirties: 22 }), 'give', 'AS', NOW)).toEqual({
      patch: { dirties: 23, dirties_by: 'AS', dirties_at: NOW },
      tap: { kind: 'undo', value: 23, prev: 22, tapped_by: 'AS' },
    });
  });
});
