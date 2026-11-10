// What one tap on the header pill does (src/lib/pillEnd.ts). Aaron, 2026-11-09: *"just end it on tap since that's really
// what I need to do"*, and *"the same for movement log when making trips to the airport"*.
import { describe, it, expect } from 'vitest';
import { othPillPlan, tripPillPlan } from '../../src/lib/pillEnd';

const T0 = Date.parse('2026-11-09T02:00:00.000Z');
const min = (m: number) => T0 + m * 60_000;
const trip = (auth: string | null = 'PERSONAL') => ({ depart_time: new Date(T0).toISOString(), auth_type: auth });
const oth = (preset: string | null = null) => ({ start_time: new Date(T0).toISOString(), preset_reason: preset });

describe('tripPillPlan', () => {
  it('⭐ a real run ends Back at Washbay, with its minutes', () => {
    expect(tripPillPlan(trip(), min(12.4))).toMatchObject({ kind: 'end', logs: true, minutes: 12, chip: '✓ 12m' });
  });
  it('⭐ under 5 minutes opens the card, where it asks "Log it, or delete it?"', () => {
    expect(tripPillPlan(trip(), min(4.9))).toEqual({ kind: 'open' });
    expect(tripPillPlan(trip(), min(5))).toMatchObject({ kind: 'end' });
  });
  it('no authorization opens the card (it cannot end without one)', () => {
    expect(tripPillPlan(trip(null), min(12))).toEqual({ kind: 'open' });
  });
  it('a depart time that is not one opens the card', () => {
    expect(tripPillPlan({ depart_time: 'x', auth_type: 'PERSONAL' }, min(12))).toEqual({ kind: 'open' });
  });
});

describe('othPillPlan', () => {
  it('⭐ 5 minutes and up is logged', () => {
    expect(othPillPlan(oth('fleeting_cars'), min(14))).toMatchObject({ kind: 'end', logs: true, minutes: 14, chip: '✓ 14m' });
  });
  it('⭐ under 5 is thrown away, as End does, and the chip says so', () => {
    const p = othPillPlan(oth(), min(3));
    expect(p).toMatchObject({ kind: 'end', logs: false, chip: '✕ 3m' });
  });
  it('the edge rounds as End rounds: 4m 30s is 5, logged', () => {
    expect(othPillPlan(oth(), min(4.5))).toMatchObject({ logs: true, minutes: 5 });
    expect(othPillPlan(oth(), min(4.49))).toMatchObject({ logs: false, minutes: 4 });
  });
  it('⭐ EDV opens the card (plate, interior / exterior, the hold)', () => {
    expect(othPillPlan(oth('edv'), min(30))).toEqual({ kind: 'open' });
  });
});
