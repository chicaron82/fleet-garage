import { describe, it, expect } from 'vitest';
import { priorFlippingAttested } from '../../src/lib/airportFlipping';
import { businessDateOf } from '../../src/lib/shiftDay';
import type { HandoffNote, WashbayLog } from '../../src/types';

const DATE = '2026-06-21';

const handoff = (over: Partial<HandoffNote> = {}): HandoffNote => ({
  id: 'h1', branchId: 'YWG', loggedById: 'u1', loggedByName: 'Ana',
  loggedAt: `${DATE}T14:00:00`, fullPages: 2, lastPageEntries: 3, teamSize: 2,
  lotStatus: 'manageable', morningHours: 8, carryOverCleared: 0, airportFlipping: false,
  ...over,
});
const log = (over: Partial<WashbayLog> = {}): WashbayLog => ({ airportFlipping: false, ...over } as WashbayLog);

describe('priorFlippingAttested', () => {
  it('true when a handoff today flagged flipping', () => {
    expect(priorFlippingAttested([handoff({ airportFlipping: true })], undefined, DATE)).toBe(true);
  });

  it("false when today's handoff did not flag it", () => {
    expect(priorFlippingAttested([handoff({ airportFlipping: false })], undefined, DATE)).toBe(false);
  });

  it('ignores a flagged handoff from a different shift-day', () => {
    const yesterday = handoff({ airportFlipping: true, loggedAt: '2026-06-20T14:00:00' });
    expect(priorFlippingAttested([yesterday], undefined, DATE)).toBe(false);
  });

  it("true when today's washbay log carries the flag", () => {
    expect(priorFlippingAttested([], log({ airportFlipping: true }), DATE)).toBe(true);
  });

  it('false on empty inputs', () => {
    expect(priorFlippingAttested([], undefined, DATE)).toBe(false);
  });

  it('a post-midnight handoff maps to its shift-day, not the calendar date', () => {
    // 02:00 on the 22nd is before the 04:00 cutover → it belongs to shift-day the 21st
    expect(businessDateOf('2026-06-22T02:00:00')).toBe(DATE);
    const lateNight = handoff({ airportFlipping: true, loggedAt: '2026-06-22T02:00:00' });
    expect(priorFlippingAttested([lateNight], undefined, DATE)).toBe(true);
  });
});
