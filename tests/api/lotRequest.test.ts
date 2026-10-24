import { describe, it, expect } from 'vitest';
import { pinMatches, parseLotRequest, cleanBy, DIRTIES_MAX, bearerOf } from '../../api/_lib/lotRequest';

describe('pinMatches', () => {
  it('matches the set PIN, trimmed', () => {
    expect(pinMatches(' 4821 ', '4821')).toBe(true);
  });
  it('⚠️ refuses a wrong PIN, a missing one, and any PIN when none is set', () => {
    expect(pinMatches('4820', '4821')).toBe(false);
    expect(pinMatches(undefined, '4821')).toBe(false);
    expect(pinMatches(4821, '4821')).toBe(false);
    expect(pinMatches('4821', undefined)).toBe(false);
    expect(pinMatches('', '')).toBe(false);
  });
});

describe('parseLotRequest', () => {
  const NOW = Date.parse('2026-10-18T17:00:00Z');
  it('a reading on the airport (migration 157) goes to the reading rules, with the tap time', () => {
    expect(parseLotRequest({ action: 'reading', field: 'cleans', value: 0, at: '2026-10-18T16:50:00Z', by: 'AS' }, NOW))
      .toEqual({ action: 'reading', field: 'cleans', value: 0, at: '2026-10-18T16:50:00.000Z', by: 'AS' });
  });
  it('⚠️ the retired stall actions are refused, so an old open tab cannot write the stall board', () => {
    expect(parseLotRequest({ action: 'stall', stall: 'O7', state: 'dirty', by: 'AS' }, NOW)).toHaveProperty('error');
    expect(parseLotRequest({ action: 'undo', stall: 'P7', prev: { state: null } }, NOW)).toHaveProperty('error');
    expect(parseLotRequest({ action: 'aisle', delta: 1 }, NOW)).toHaveProperty('error');
  });
  it('unknown or empty requests are refused', () => {
    expect(parseLotRequest({ action: 'drop table' })).toHaveProperty('error');
    expect(parseLotRequest(null)).toHaveProperty('error');
  });
});

describe('cleanBy', () => {
  it('keeps a short label and never stores an empty name', () => {
    expect(cleanBy('  Larry   J ')).toBe('Larry J');
    expect(cleanBy('')).toBe('Lot');
    expect(cleanBy('x'.repeat(40))).toHaveLength(12);
  });
});

describe('parseLotRequest — Erin St count (migration 153)', () => {
  it('+1 and −1 on cleans; fix only rides a −1', () => {
    expect(parseLotRequest({ action: 'cleans', delta: 1, fix: true, by: 'AS' })).toEqual({ action: 'cleans', delta: 1, fix: false, giveDirty: false, by: 'AS' });
    expect(parseLotRequest({ action: 'cleans', delta: -1, fix: true, by: 'AS' })).toEqual({ action: 'cleans', delta: -1, fix: true, giveDirty: false, by: 'AS' });
    expect(parseLotRequest({ action: 'cleans', delta: -1, by: 'AS' })).toEqual({ action: 'cleans', delta: -1, fix: false, giveDirty: false, by: 'AS' });
  });
  it('giveDirty only rides a slip fix (ticket-erin-clean-plus-takes-a-dirty)', () => {
    expect(parseLotRequest({ action: 'cleans', delta: -1, fix: true, giveDirty: true, by: 'AS' })).toMatchObject({ giveDirty: true });
    expect(parseLotRequest({ action: 'cleans', delta: -1, fix: false, giveDirty: true, by: 'AS' })).toMatchObject({ giveDirty: false });
    expect(parseLotRequest({ action: 'cleans', delta: 1, giveDirty: true, by: 'AS' })).toMatchObject({ giveDirty: false });
  });
  it('cleans move one car at a time', () => {
    for (const delta of [2, -2, 0, '1', null]) expect(parseLotRequest({ action: 'cleans', delta })).toHaveProperty('error');
  });
  it('a dirty count is a whole number from 0 to the cap, typed or numeric', () => {
    expect(parseLotRequest({ action: 'dirties', count: 23, by: 'AS' })).toEqual({ action: 'dirties', count: 23, by: 'AS' });
    expect(parseLotRequest({ action: 'dirties', count: ' 18 ' })).toMatchObject({ action: 'dirties', count: 18 });
    expect(parseLotRequest({ action: 'dirties', count: 0 })).toMatchObject({ count: 0 });
    expect(parseLotRequest({ action: 'dirties', count: DIRTIES_MAX })).toMatchObject({ count: DIRTIES_MAX });
  });
  it('⚠️ refuses a fat-fingered or nonsense dirty count rather than showing it', () => {
    for (const count of [DIRTIES_MAX + 1, 2300, -1, 2.5, 'abc', '', null, '1e2']) {
      expect(parseLotRequest({ action: 'dirties', count })).toHaveProperty('error');
    }
  });
});

describe('bearerOf — the second door (FG\'s My Day card, 2026-10-15)', () => {
  it('takes the token from a Bearer header', () => {
    expect(bearerOf('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerOf('  Bearer   tok ')).toBe('tok');
  });
  it('⚠️ anything else is no token, so the PIN is still required', () => {
    for (const h of [undefined, '', 'Bearer', 'Bearer ', 'Basic abc', 'abc', 42, 'Bearer a b']) expect(bearerOf(h)).toBeNull();
  });
});

// The per-person crew state (migration 154) was retired 2026-10-24: the crew line is the schedule now
// (docs/ticket-crew-line-is-the-schedule.md). A stale client that still sends it gets a plain refusal.
describe('parseLotRequest — crew (retired 2026-10-24)', () => {
  it('a crew state is an unknown action now', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(parseLotRequest({ action: 'crew', users: [id], state: 'moving', by: 'AS' })).toEqual({ error: 'Unknown action.' });
  });
});

describe('parseLotRequest — leaveOff (migration 155)', () => {
  const u = '3b2a8659-4546-4231-9085-6d92e28a1133';
  it('a person and on/off', () => {
    expect(parseLotRequest({ action: 'leaveOff', user: u, off: true, by: 'AS' })).toEqual({ action: 'leaveOff', user: u, off: true, by: 'AS' });
    expect(parseLotRequest({ action: 'leaveOff', user: u, off: false })).toMatchObject({ off: false });
  });
  it('refuses a missing person or a missing choice', () => {
    expect(parseLotRequest({ action: 'leaveOff', user: 'larry', off: true })).toHaveProperty('error');
    expect(parseLotRequest({ action: 'leaveOff', user: u })).toHaveProperty('error');
  });
});
