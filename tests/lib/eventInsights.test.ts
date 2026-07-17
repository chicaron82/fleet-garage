import { describe, it, expect } from 'vitest';
import { eventInsights, type PersonalEvent } from '../../src/lib/eventInsights';

const ev = (over: Partial<PersonalEvent>): PersonalEvent => ({
  id: 'e-1', eventDate: '2026-07-17', eventTime: '12:30:00', title: 'Staff BBQ', ...over,
});

describe('eventInsights', () => {
  it("today's event → the heads-up insight Aaron pictured", () => {
    expect(eventInsights([ev({})], '2026-07-17')).toEqual([
      { kind: 'event', icon: '📅', label: 'Staff BBQ', detail: 'Today at 12:30' },
    ]);
  });

  it('trims the seconds off the time', () => {
    expect(eventInsights([ev({ eventTime: '09:05:00' })], '2026-07-17')[0].detail).toBe('Today at 09:05');
  });

  it('an all-day note (no time) reads "Today", not "Today at null"', () => {
    expect(eventInsights([ev({ eventTime: null })], '2026-07-17')[0].detail).toBe('Today');
  });

  it('another day → nothing (yesterday is simply past, tomorrow is not yet)', () => {
    expect(eventInsights([ev({ eventDate: '2026-07-16' })], '2026-07-17')).toEqual([]);
    expect(eventInsights([ev({ eventDate: '2026-07-18' })], '2026-07-17')).toEqual([]);
  });

  it('a clean day → [] so the card stays hidden', () => {
    expect(eventInsights([], '2026-07-17')).toEqual([]);
  });

  it('orders by time, all-day notes first', () => {
    const list = eventInsights([
      ev({ id: 'a', eventTime: '15:00:00', title: 'Meeting' }),
      ev({ id: 'b', eventTime: null, title: 'Payday' }),
      ev({ id: 'c', eventTime: '12:30:00', title: 'Staff BBQ' }),
    ], '2026-07-17');
    expect(list.map(i => i.label)).toEqual(['Payday', 'Staff BBQ', 'Meeting']);
  });

  it('ignores a blank-titled row rather than rendering an empty chip', () => {
    expect(eventInsights([ev({ title: '   ' })], '2026-07-17')).toEqual([]);
  });
});
