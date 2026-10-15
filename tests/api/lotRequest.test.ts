import { describe, it, expect } from 'vitest';
import { pinMatches, isStallId, parseLotRequest, cleanBy } from '../../api/_lib/lotRequest';

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

describe('isStallId', () => {
  it('knows the lot as it stands', () => {
    expect(isStallId('O2')).toBe(true);
    expect(isStallId('P20')).toBe(true);
    expect(isStallId('S6')).toBe(true);
  });
  it('refuses the cart return, the booth, and anything off the map', () => {
    for (const bad of ['O1', 'N1', 'N2', 'P21', 'S7', 'Q3', 'p3', '', null]) expect(isStallId(bad)).toBe(false);
  });
});

describe('parseLotRequest', () => {
  it('a stall tap', () => {
    expect(parseLotRequest({ action: 'stall', stall: 'O7', state: 'dirty', by: 'AS' }))
      .toEqual({ action: 'stall', stall: 'O7', state: 'dirty', by: 'AS' });
  });
  it('a stall can be taken (a customer or staff car), and an undo can go back to taken', () => {
    expect(parseLotRequest({ action: 'stall', stall: 'P3', state: 'taken', by: 'AS' }))
      .toEqual({ action: 'stall', stall: 'P3', state: 'taken', by: 'AS' });
    expect(parseLotRequest({ action: 'undo', stall: 'P3', prev: { state: 'taken', by: 'AS', at: null }, by: 'AS' }))
      .toMatchObject({ action: 'undo', prev: { state: 'taken' } });
  });
  it('refuses a state that is not open, clean, dirty or taken', () => {
    expect(parseLotRequest({ action: 'stall', stall: 'O7', state: 'purple' })).toHaveProperty('error');
  });
  it('an undo back to "nobody has looked" is allowed', () => {
    expect(parseLotRequest({ action: 'undo', stall: 'P7', prev: { state: null, by: null, at: null }, by: 'AS' }))
      .toEqual({ action: 'undo', stall: 'P7', prev: { state: null, by: null, at: null }, by: 'AS' });
  });
  it('an undo to a made-up state is refused', () => {
    expect(parseLotRequest({ action: 'undo', stall: 'P7', prev: { state: 'gone' } })).toHaveProperty('error');
  });
  it('the aisle moves one car at a time', () => {
    expect(parseLotRequest({ action: 'aisle', delta: 1 })).toMatchObject({ action: 'aisle', delta: 1 });
    expect(parseLotRequest({ action: 'aisle', delta: 5 })).toHaveProperty('error');
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
