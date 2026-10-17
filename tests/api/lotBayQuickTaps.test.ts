// The Erin pill's quick taps, server side (migration 156; docs/ticket-lot-lookout-too-slow-on-the-fly.md). Aaron,
// 2026-10-16: *"tap the drain and removes 3 cleans off the count"* · *"the same 3 drivers arrive back at the bay with
// dirties. tap the fill and the dirty count bumps up 3"* · and catching up to what's on the lot is a correction.
import { describe, it, expect } from 'vitest';
import { bayChange, type BayRow } from '../../api/_lib/lotBay';
import { parseLotRequest } from '../../api/_lib/lotRequest';

const NOW = '2026-10-16T21:40:00.000Z';
const TODAY = '2026-10-16';
const row = (over: Partial<BayRow> = {}): BayRow => ({ cleans: 6, dirties: 3, used: 4, used_on: TODAY, ...over });

describe('bayChange — the quick taps', () => {
  it('⭐ SET cleans is a correction: the count moves, used does not', () => {
    expect(bayChange(row({ cleans: 3 }), { action: 'cleansSet', count: 6, by: 'AS' }, NOW, TODAY)).toEqual({
      patch: { cleans: 6, cleans_by: 'AS', cleans_at: NOW },
      tap: { kind: 'set', value: 6, prev: 3, tapped_by: 'AS' },
    });
  });

  it('⭐ DRAIN takes one per driver and counts them as used', () => {
    expect(bayChange(row({ cleans: 9 }), { action: 'drain', n: 3, by: 'AS' }, NOW, TODAY)).toEqual({
      patch: { cleans: 6, cleans_by: 'AS', cleans_at: NOW, used: 7, used_on: TODAY },
      tap: { kind: 'drain', value: 6, prev: 9, tapped_by: 'AS' },
    });
  });

  it('a drain bigger than the pile stops at 0 and counts only what it took', () => {
    expect(bayChange(row({ cleans: 2 }), { action: 'drain', n: 3, by: 'AS' }, NOW, TODAY))
      .toMatchObject({ patch: { cleans: 0, used: 6 }, tap: { kind: 'drain', value: 0, prev: 2 } });
  });

  it('a drain on a new shift-day starts used fresh, not on top of yesterday', () => {
    expect(bayChange(row({ cleans: 9, used: 31, used_on: '2026-10-15' }), { action: 'drain', n: 3, by: 'AS' }, NOW, TODAY))
      .toMatchObject({ patch: { used: 3, used_on: TODAY } });
  });

  it('a drain with nothing on the lot is refused', () => {
    expect(bayChange(row({ cleans: 0 }), { action: 'drain', n: 3, by: 'AS' }, NOW, TODAY)).toHaveProperty('error');
  });

  it('⭐ FILL adds one dirty per driver', () => {
    expect(bayChange(row({ dirties: 3 }), { action: 'fill', n: 3, by: 'AS' }, NOW, TODAY)).toEqual({
      patch: { dirties: 6, dirties_by: 'AS', dirties_at: NOW },
      tap: { kind: 'fill', value: 6, prev: 3, tapped_by: 'AS' },
    });
  });

  it('fill on a never-counted dirty pile starts from 0', () => {
    expect(bayChange(row({ dirties: null }), { action: 'fill', n: 3, by: 'AS' }, NOW, TODAY)).toMatchObject({ patch: { dirties: 3 } });
  });

  it('dirties step ±1 like the cleans, never below 0', () => {
    expect(bayChange(row({ dirties: 3 }), { action: 'dirtiesStep', delta: 1, by: 'AS' }, NOW, TODAY)).toMatchObject({ patch: { dirties: 4 } });
    expect(bayChange(row({ dirties: 3 }), { action: 'dirtiesStep', delta: -1, by: 'AS' }, NOW, TODAY)).toMatchObject({ patch: { dirties: 2 } });
    expect(bayChange(row({ dirties: 0 }), { action: 'dirtiesStep', delta: -1, by: 'AS' }, NOW, TODAY)).toHaveProperty('error');
  });

  it('⭐ UNDO puts the whole row back, used included, so an undone drain is not left counted', () => {
    const c = bayChange(row({ cleans: 6, used: 7 }), {
      action: 'bayUndo', field: 'cleans', to: { cleans: 9, dirties: 3, used: 4, usedOn: TODAY }, by: 'AS',
    }, NOW, TODAY);
    expect(c).toEqual({
      patch: { cleans: 9, dirties: 3, used: 4, used_on: TODAY, cleans_by: 'AS', cleans_at: NOW },
      tap: { kind: 'undo', value: 9, prev: 6, tapped_by: 'AS' },
    });
  });
});

describe('parseLotRequest — the quick taps', () => {
  it('reads each new action', () => {
    expect(parseLotRequest({ action: 'cleansSet', count: '6', by: 'AS' })).toEqual({ action: 'cleansSet', count: 6, by: 'AS' });
    expect(parseLotRequest({ action: 'drain', n: 3, by: 'AS' })).toEqual({ action: 'drain', n: 3, by: 'AS' });
    expect(parseLotRequest({ action: 'fill', n: 3, by: 'AS' })).toEqual({ action: 'fill', n: 3, by: 'AS' });
    expect(parseLotRequest({ action: 'dirtiesStep', delta: -1, by: 'AS' })).toEqual({ action: 'dirtiesStep', delta: -1, by: 'AS' });
  });

  it('refuses a drain of nobody, a fractional crew, or a crew no bay has', () => {
    for (const n of [0, 2.5, 21, '3']) expect(parseLotRequest({ action: 'drain', n, by: 'AS' })).toHaveProperty('error');
  });

  it('refuses a set past the cap', () => {
    expect(parseLotRequest({ action: 'cleansSet', count: 2300, by: 'AS' })).toHaveProperty('error');
  });

  it('undo needs a whole snapshot and which count it was for', () => {
    const to = { cleans: 9, dirties: null, used: 4, usedOn: TODAY };
    expect(parseLotRequest({ action: 'bayUndo', field: 'cleans', to, by: 'AS' })).toEqual({ action: 'bayUndo', field: 'cleans', to, by: 'AS' });
    expect(parseLotRequest({ action: 'bayUndo', field: 'stalls', to, by: 'AS' })).toHaveProperty('error');
    expect(parseLotRequest({ action: 'bayUndo', field: 'cleans', to: { ...to, used: -1 }, by: 'AS' })).toHaveProperty('error');
    expect(parseLotRequest({ action: 'bayUndo', field: 'cleans', to: { ...to, usedOn: 'yesterday' }, by: 'AS' })).toHaveProperty('error');
  });
});
