// A trip to the airport takes a clean (Aaron, 2026-11-03: *"Making a trip to the airport automatically removes 1 clean
// from the count"*; docs/ticket-bay-on-deck-trip-clean-quick-holds.md). The trip's Reset gives it back.
import { describe, it, expect } from 'vitest';
import { BAY_ACTIONS, bayChange, type BayRow } from '../../api/_lib/lotBay';
import { parseLotRequest } from '../../api/_lib/lotRequest';

const NOW = '2026-11-03T20:00:00.000Z';
const TODAY = '2026-11-03';
const row = (over: Partial<BayRow> = {}): BayRow => ({ cleans: 15, dirties: 4, used: 9, used_on: TODAY, ...over });

describe('bayChange — tripClean', () => {
  it('⭐ a trip takes one clean and counts it as used; the dirties are not touched', () => {
    expect(bayChange(row(), { action: 'tripClean', delta: -1, by: 'AS' }, NOW, TODAY)).toEqual({
      patch: { cleans: 14, cleans_by: 'AS', cleans_at: NOW, used: 10, used_on: TODAY },
      tap: { kind: 'used', value: 14, prev: 15, tapped_by: 'AS' },
    });
  });

  it('⭐ its Reset gives the clean back, takes the used back off, and takes NO dirty (a +1 tap would)', () => {
    expect(bayChange(row({ cleans: 14, used: 10 }), { action: 'tripClean', delta: 1, by: 'AS' }, NOW, TODAY)).toEqual({
      patch: { cleans: 15, cleans_by: 'AS', cleans_at: NOW, used: 9, used_on: TODAY },
      tap: { kind: 'undo', value: 15, prev: 14, tapped_by: 'AS' },
    });
    // Control: the +1 TAP does take a dirty, which is why the give-back is its own action.
    expect(bayChange(row({ cleans: 14 }), { action: 'cleans', delta: 1, fix: false, by: 'AS' }, NOW, TODAY))
      .toMatchObject({ patch: { dirties: 3 } });
  });

  it('at 0 cleans the trip is refused (the trip itself still runs; the phone says so)', () => {
    expect(bayChange(row({ cleans: 0 }), { action: 'tripClean', delta: -1, by: 'AS' }, NOW, TODAY))
      .toEqual({ error: 'Erin St was already at 0 cleans.' });
  });

  it('a give-back across the 04:00 cutover never makes used negative', () => {
    expect(bayChange(row({ used: 5, used_on: '2026-11-02' }), { action: 'tripClean', delta: 1, by: 'AS' }, NOW, TODAY))
      .toMatchObject({ patch: { used: 0, used_on: TODAY } });
  });
});

describe('parseLotRequest — tripClean', () => {
  it('parses −1 and +1, refuses anything else', () => {
    expect(parseLotRequest({ action: 'tripClean', delta: -1, by: 'AS' })).toEqual({ action: 'tripClean', delta: -1, by: 'AS' });
    expect(parseLotRequest({ action: 'tripClean', delta: 1, by: 'AS' })).toEqual({ action: 'tripClean', delta: 1, by: 'AS' });
    expect(parseLotRequest({ action: 'tripClean', delta: -3, by: 'AS' })).toHaveProperty('error');
  });

  // ⚠️ The count's front door is a HAND-COPIED switch (the bay log's one list does not cover it). Same trap as Next up's
  // "Unknown action." on 2026-11-03: a count action in BAY_ACTIONS with no case here would be refused at the door.
  it('⚠️ every count action the server knows gets past the front door', () => {
    const sample: Record<string, Record<string, unknown>> = {
      cleans: { delta: 1 }, dirties: { count: 3 }, cleansSet: { count: 3 }, drain: { n: 2 }, dirtiesStep: { delta: 1 }, fill: { n: 2 },
      bayUndo: { field: 'cleans', to: { cleans: 1, dirties: 0, used: 0, usedOn: null } }, tripClean: { delta: -1 },
    };
    for (const action of BAY_ACTIONS) {
      expect(sample[action], `a sample for ${action}`).toBeDefined();
      expect(parseLotRequest({ action, by: 'AS', ...sample[action] }), action).not.toHaveProperty('error');
    }
  });
});
