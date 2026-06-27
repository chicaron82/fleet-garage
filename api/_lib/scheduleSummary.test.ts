import { describe, it, expect } from 'vitest';
import { formatSchedule, describeShiftType, type ScheduleGroup } from './scheduleSummary';

const groups: ScheduleGroup[] = [
  { shiftType: 'opening', people: ['Marycel'] },
  { shiftType: 'closing', people: ['Aaron', 'Geoff'] },
  { shiftType: 'mid', people: [] },
  { shiftType: 'pto', people: ['Ray'] },
];

describe('describeShiftType', () => {
  it('labels known types and passes through unknown', () => {
    expect(describeShiftType('closing')).toBe('Closing');
    expect(describeShiftType('day-off')).toBe('Day off');
    expect(describeShiftType('weird')).toBe('weird');
  });
});

describe('formatSchedule', () => {
  it('filters to one shift type (who is closing) with the people', () => {
    expect(formatSchedule('Jun 26, 2026', groups, 'closing')).toBe('Jun 26, 2026 — Closing: Aaron, Geoff.');
  });

  it('lists the working shifts (closing first) when unfiltered, skipping empties + absences', () => {
    expect(formatSchedule('Jun 26, 2026', groups)).toBe('Jun 26, 2026 — Closing: Aaron, Geoff. Opening: Marycel.');
  });

  it('reports nobody on a filtered shift', () => {
    expect(formatSchedule('Jun 26, 2026', groups, 'mid')).toBe('No one is on the mid shift on Jun 26, 2026.');
  });

  it('reports an empty day', () => {
    expect(formatSchedule('Jun 27, 2026', [])).toBe('No one is scheduled on Jun 27, 2026.');
  });
});
