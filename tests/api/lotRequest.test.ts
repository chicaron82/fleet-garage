import { describe, it, expect } from 'vitest';
import { parseLotRequest, cleanBy, DIRTIES_MAX, bearerOf } from '../../api/_lib/lotRequest';
import { BAY_LOG_ACTIONS } from '../../api/_lib/lotBayLog';

describe('parseLotRequest', () => {
  it('⚠️ the retired airport actions are refused, so an old open tab or a queued tap cannot write them (2026-10-29)', () => {
    expect(parseLotRequest({ action: 'reading', field: 'cleans', value: 0, at: '2026-10-18T16:50:00Z', by: 'AS' })).toHaveProperty('error');
    expect(parseLotRequest({ action: 'stall', stall: 'O7', state: 'dirty', by: 'AS' })).toHaveProperty('error');
    expect(parseLotRequest({ action: 'undo', stall: 'P7', prev: { state: null } })).toHaveProperty('error');
    expect(parseLotRequest({ action: 'aisle', delta: 1 })).toHaveProperty('error');
  });
  it('⚠️ the PIN page\'s unlock is refused too: the PIN door is gone (2026-11-05)', () => {
    expect(parseLotRequest({ action: 'check', by: 'AS' })).toHaveProperty('error');
  });
  it('the bay log (migration 161) goes to its own rules', () => {
    expect(parseLotRequest({ action: 'bayStart', vehicleId: 'v-123', by: 'AS' })).toEqual({ action: 'bayStart', vehicleId: 'v-123', by: 'AS' });
    expect(parseLotRequest({ action: 'bayExit', id: 7, exit: 'skip', by: 'AS' })).toEqual({ action: 'bayExit', id: 7, exit: 'skip', by: 'AS' });
  });
  it('⚠️ Next up reaches the bay log: his first real load came back "Unknown action." (2026-11-03)', () => {
    expect(parseLotRequest({ action: 'bayStandbySet', vehicleId: 'v-123', by: 'AS' })).toEqual({ action: 'bayStandbySet', vehicleId: 'v-123', by: 'AS' });
    expect(parseLotRequest({ action: 'bayStandbyClear', by: 'AS' })).toEqual({ action: 'bayStandbyClear', by: 'AS' });
  });
  it('Clean only and Back to Next up parse (2026-11-03)', () => {
    expect(parseLotRequest({ action: 'bayExit', id: 7, exit: 'clean', pull: false, by: 'AS' })).toEqual({ action: 'bayExit', id: 7, exit: 'clean', by: 'AS', pull: false });
    expect(parseLotRequest({ action: 'bayExit', id: 7, exit: 'clean', pull: true, by: 'AS' })).toEqual({ action: 'bayExit', id: 7, exit: 'clean', by: 'AS' });
    expect(parseLotRequest({ action: 'bayExit', id: 7, exit: 'clean', pull: 'no', by: 'AS' })).toHaveProperty('error');
    expect(parseLotRequest({ action: 'bayBumpToNextUp', id: 7, replace: true, by: 'AS' })).toEqual({ action: 'bayBumpToNextUp', id: 7, by: 'AS', replace: true });
    expect(parseLotRequest({ action: 'bayBumpToNextUp', id: 7, by: 'AS' })).toEqual({ action: 'bayBumpToNextUp', id: 7, by: 'AS', replace: false });
    expect(parseLotRequest({ action: 'bayBumpToNextUp', by: 'AS' })).toHaveProperty('error');
  });
  it('every bay-log action the server knows gets past the front door (one list, no hand copy)', () => {
    const sample: Record<string, Record<string, unknown>> = {
      bayStart: { vehicleId: 'v-1' }, bayExit: { id: 1, exit: 'clean' }, bayExitUndo: { id: 1 }, bayStandbySet: { vehicleId: 'v-1' }, bayStandbyClear: {},
      bayBumpToNextUp: { id: 1 }, bayNote: { id: 1, note: 'x' }, bayLinkHold: { id: 1, holdId: 'h-1' },
      bayAdd: { vehicleId: 'v-1' }, bayAddUndo: { id: 1 },
    };
    for (const action of BAY_LOG_ACTIONS) {
      expect(sample[action], `a sample for ${action}`).toBeDefined();
      expect(parseLotRequest({ action, by: 'AS', ...sample[action] })).not.toHaveProperty('error');
    }
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
