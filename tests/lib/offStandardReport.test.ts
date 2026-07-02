import { describe, it, expect } from 'vitest';
import {
  fmtMinutes,
  fmtTime,
  rowToOffStandard,
  deriveShiftLine,
  generateOffStandardReport,
  deriveExplanation,
  type TripRow,
} from '../../src/lib/offStandardReport';
import type { OffStandardEntry, ShiftWithUser, User } from '../../src/types';

// ── fmtMinutes ────────────────────────────────────────────────────────────────

describe('fmtMinutes', () => {
  it('formats sub-hour totals as minutes', () => {
    expect(fmtMinutes(0)).toBe('0m');
    expect(fmtMinutes(45)).toBe('45m');
  });

  it('drops the minutes part on whole hours', () => {
    expect(fmtMinutes(60)).toBe('1h');
    expect(fmtMinutes(120)).toBe('2h');
  });

  it('combines hours and minutes', () => {
    expect(fmtMinutes(90)).toBe('1h 30m');
    expect(fmtMinutes(125)).toBe('2h 5m');
  });
});

// ── fmtTime ───────────────────────────────────────────────────────────────────

describe('fmtTime', () => {
  it('renders 24-hour HH:MM in local time', () => {
    // Build a local 09:05 moment; toISOString → UTC, fmtTime converts back to local.
    const local = new Date(2026, 4, 22, 9, 5);
    expect(fmtTime(local.toISOString())).toBe('09:05');
  });

  it('pads and uses 24h (no AM/PM)', () => {
    const local = new Date(2026, 4, 22, 17, 0);
    expect(fmtTime(local.toISOString())).toBe('17:00');
  });
});

// ── rowToOffStandard ──────────────────────────────────────────────────────────

describe('rowToOffStandard', () => {
  it('maps snake_case columns to the camelCase entry', () => {
    const row = {
      id: 'e1',
      start_time: '2026-05-22T09:00:00',
      stop_time: '2026-05-22T09:30:00',
      minutes: 30,
      reason: 'WFW',
      explanation: 'waited for keys',
      auto_from_trip: true,
    };
    const e = rowToOffStandard(row);
    expect(e).toMatchObject({
      id: 'e1',
      startTime: '2026-05-22T09:00:00',
      stopTime: '2026-05-22T09:30:00',
      minutes: 30,
      reason: 'WFW',
      explanation: 'waited for keys',
      autoFromTrip: true,
    });
  });

  it('applies defaults for null / missing optional columns', () => {
    const e = rowToOffStandard({ id: 'e2', start_time: 's', stop_time: 't', minutes: 5, reason: 'OTH' });
    expect(e.explanation).toBeUndefined();
    expect(e.autoFromTrip).toBe(false);   // missing → false
    expect(e.editStatus).toBeNull();      // missing → null
    expect(e.isBackdated).toBe(false);    // missing → false
  });

  it('coerces explicit null explanation to undefined', () => {
    const e = rowToOffStandard({ id: 'e3', start_time: 's', stop_time: 't', minutes: 5, reason: 'OTH', explanation: null });
    expect(e.explanation).toBeUndefined();
  });
});

// shiftTypeLabel consolidated into lib/shiftTypeMeta.shiftTypeSentence —
// covered in shiftTypeMeta.test.ts; deriveShiftLine below still exercises it.

// ── deriveShiftLine ───────────────────────────────────────────────────────────

function makeShift(over: Partial<ShiftWithUser>): ShiftWithUser {
  return {
    id: 's1',
    userId: 'u1',
    date: '2026-05-22',
    shiftType: 'closing',
    createdAt: '',
    updatedAt: '',
    branchId: 'YWG',
    user: { name: 'Ana', role: 'VSA' },
    ...over,
  };
}

describe('deriveShiftLine', () => {
  it('defaults to "8-hour shift" when the user has no shift on the date', () => {
    expect(deriveShiftLine([], 'u1', '2026-05-22')).toBe('8-hour shift');
  });

  it('renders label + time range when the shift has times', () => {
    const shifts = [makeShift({ startTime: '13:30', endTime: '22:00' })];
    expect(deriveShiftLine(shifts, 'u1', '2026-05-22')).toBe('Closing shift 13:30-22:00');
  });

  it('renders just the label when the shift has no times', () => {
    const shifts = [makeShift({ shiftType: 'pto' })];
    expect(deriveShiftLine(shifts, 'u1', '2026-05-22')).toBe('PTO');
  });

  it('prefers the shift that has times over one that does not', () => {
    const shifts = [
      makeShift({ id: 'a', shiftType: 'pto' }),
      makeShift({ id: 'b', shiftType: 'opening', startTime: '06:45', endTime: '15:15' }),
    ];
    expect(deriveShiftLine(shifts, 'u1', '2026-05-22')).toBe('Opening shift 06:45-15:15');
  });
});

// ── generateOffStandardReport ─────────────────────────────────────────────────

const USER: User = { id: 'u1', employeeId: 'EMP100', name: 'Ana Reyes', role: 'VSA', branchId: 'YWG' };

function entry(over: Partial<OffStandardEntry>): OffStandardEntry {
  return {
    id: 'e1',
    startTime: new Date(2026, 4, 22, 9, 0).toISOString(),
    stopTime: new Date(2026, 4, 22, 9, 30).toISOString(),
    minutes: 30,
    reason: 'WFW',
    autoFromTrip: false,
    ...over,
  } as OffStandardEntry;
}

describe('generateOffStandardReport', () => {
  it('includes the header identity block and shift line', () => {
    const r = generateOffStandardReport([], [], USER, 'Closing shift 13:30-22:00', 'May 22, 2026');
    expect(r).toContain('Ana Reyes');
    expect(r).toContain('EMP100');
    expect(r).toContain('Closing shift 13:30-22:00');
    expect(r).toContain('May 22, 2026');
  });

  it('shows "(none)" and a zero total with no entries', () => {
    const r = generateOffStandardReport([], [], USER, '8-hour shift', 'May 22, 2026');
    expect(r).toContain('(none)');
    expect(r).toContain('Total off-standard:  0m');
  });

  it('lists entries and sums the total', () => {
    const entries = [entry({ minutes: 30 }), entry({ id: 'e2', minutes: 45, reason: 'OTH' })];
    const r = generateOffStandardReport(entries, [], USER, '8-hour shift', 'May 22, 2026');
    expect(r).toContain('Total off-standard:  1h 15m');
  });

  it('computes trip duration from arrive − depart (regression: was depart − depart = 0)', () => {
    const trips: TripRow[] = [{
      depart_time: new Date(2026, 4, 22, 14, 0).toISOString(),
      arrive_time: new Date(2026, 4, 22, 14, 25).toISOString(),
      is_shuttle: false,
      reason: 'Airport Run',
    }];
    const r = generateOffStandardReport([], trips, USER, '8-hour shift', 'May 22, 2026');
    expect(r).toContain('AIRPORT TRIPS');
    expect(r).toContain('(25m)');
    expect(r).not.toContain('(0m)');
  });

  it('labels shuttle transfers distinctly', () => {
    const trips: TripRow[] = [{
      depart_time: new Date(2026, 4, 22, 14, 0).toISOString(),
      arrive_time: new Date(2026, 4, 22, 14, 10).toISOString(),
      is_shuttle: true,
      reason: null,
    }];
    const r = generateOffStandardReport([], trips, USER, '8-hour shift', 'May 22, 2026');
    expect(r).toContain('Shuttle Transfer');
  });

  it('omits the trips section entirely when there are no trips', () => {
    const r = generateOffStandardReport([entry({})], [], USER, '8-hour shift', 'May 22, 2026');
    expect(r).not.toContain('AIRPORT TRIPS');
  });
});

// ── deriveExplanation ─────────────────────────────────────────────────────────

describe('deriveExplanation', () => {
  it('returns the free text when there is no preset', () => {
    expect(deriveExplanation(null, '', 'custom note')).toBe('custom note');
  });

  it('expands EDV with the unit number when present', () => {
    expect(deriveExplanation('edv', 'YWG-1234', '')).toBe('Extremely Dirty Vehicle — YWG-1234');
  });

  it('expands EDV without a unit when none is given', () => {
    expect(deriveExplanation('edv', '', '')).toBe('Extremely Dirty Vehicle');
  });

  it('maps each preset to its canonical label', () => {
    expect(deriveExplanation('fleeting_cars', '', '')).toBe('Fleeting cars');
    expect(deriveExplanation('closing_duties', '', '')).toBe('Closing duties');
    expect(deriveExplanation('opening_duties', '', '')).toBe('Opening duties');
    expect(deriveExplanation('lot_organization', '', '')).toBe('Lot organization');
    expect(deriveExplanation('customer_pickup', '', '')).toBe('Pickup / drop-off');
  });
});
