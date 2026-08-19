import { describe, it, expect } from 'vitest';
import {
  changeLines, formatValue, fieldLabel, describeChangeTime, changeCountLabel,
  type VehicleChangeRow,
} from '../../src/lib/vehicleChanges';

const row = (changed: Record<string, unknown>, op: VehicleChangeRow['op'] = 'UPDATE'): VehicleChangeRow =>
  ({ changedAt: '2026-08-18T22:14:00.000Z', op, changed });

describe('fieldLabel', () => {
  it('uses FG vocabulary for the columns that have it', () => {
    expect(fieldLabel('license_plate')).toBe('Plate');
    expect(fieldLabel('color')).toBe('Colour');
    expect(fieldLabel('owning_area')).toBe('Owning');
  });
  it('⭐ still renders a column nobody has mapped yet', () => {
    // A column added next month must appear in the trail the day it is added, not the day someone
    // remembers to update the label map. Silent dropping is how an audit trail lies by omission.
    expect(fieldLabel('some_new_flag')).toBe('Some new flag');
  });
});

describe('formatValue', () => {
  it('reads null, undefined and empty string the same way an operator does', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(undefined)).toBe('—');
    expect(formatValue('')).toBe('—');
  });
  it('renders booleans and numbers as words, not as literals', () => {
    expect(formatValue(true)).toBe('Yes');
    expect(formatValue(false)).toBe('No');
    expect(formatValue(0)).toBe('0');
  });
  it('keeps a jsonb value visible rather than dropping it', () => {
    expect(formatValue({ color: 'tag' })).toBe('{"color":"tag"}');
  });
});

describe('changeLines', () => {
  it('renders a from → to pair per changed column, alphabetically', () => {
    const lines = changeLines(row({
      status: { from: 'CLEAR', to: 'PRE_EXISTING' },
      color: { from: null, to: 'Blue' },
    }));
    expect(lines.map(l => l.label)).toEqual(['Colour', 'Status']);
    expect(lines[0]).toMatchObject({ from: '—', to: 'Blue' });
    expect(lines[1]).toMatchObject({ from: 'CLEAR', to: 'PRE_EXISTING' });
  });

  it('⭐ drops workflow noise but never a field about the CAR', () => {
    const lines = changeLines(row({
      edit_status: { from: 'none', to: 'pending' },
      ev_last_updated_at: { from: null, to: '2026-08-18' },
      key_count: { from: 2, to: 1 },
    }));
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe('Keys');
  });

  it('⭐ a DELETE renders the row going to nothing, not an empty change', () => {
    // A deleted row has nothing to diff against, so the trigger stores it whole. If this collapsed
    // to zero lines, the one event most worth seeing would render as blank.
    const lines = changeLines(row({ license_plate: 'LUR489', color: 'Blue' }, 'DELETE'));
    expect(lines.map(l => `${l.label} ${l.from}→${l.to}`)).toEqual(['Colour Blue→—', 'Plate LUR489→—']);
  });

  it('survives a malformed diff instead of throwing inside a render', () => {
    expect(changeLines(row({ color: 'not-a-pair', status: null }))).toEqual([]);
  });
});

describe('describeChangeTime', () => {
  const now = new Date(2026, 7, 18, 23, 0, 0); // Aug 18 2026, 11pm local

  it('⭐ carries a time of day — a window is what an incident is scoped by', () => {
    expect(describeChangeTime(new Date(2026, 7, 18, 14, 5).toISOString(), now)).toBe('today 2:05 PM');
    expect(describeChangeTime(new Date(2026, 7, 17, 9, 3).toISOString(), now)).toBe('yesterday 9:03 AM');
  });

  it('⭐ 12-hour, always — never whatever the device locale prefers', () => {
    // The verify run rendered "22:55" through toLocaleTimeString. Aaron reads AM/PM (nanays was
    // converted the same evening), and a format that changes per device is worse than either.
    expect(describeChangeTime(new Date(2026, 7, 18, 22, 55).toISOString(), now)).toBe('today 10:55 PM');
    expect(describeChangeTime(new Date(2026, 7, 18, 0, 5).toISOString(), now)).toBe('today 12:05 AM');
    expect(describeChangeTime(new Date(2026, 7, 18, 12, 30).toISOString(), now)).toBe('today 12:30 PM');
  });
  it('falls back to a dated stamp further out', () => {
    expect(describeChangeTime(new Date(2026, 7, 2, 9, 3).toISOString(), now)).toBe('Aug 2, 9:03 AM');
  });
  it('does not throw on a junk timestamp', () => {
    expect(describeChangeTime('not-a-date', now)).toBe('unknown time');
  });
});

describe('changeCountLabel', () => {
  it('counts in words, singular included', () => {
    expect(changeCountLabel([])).toBe('No record changes logged');
    expect(changeCountLabel([row({})])).toBe('1 record change');
    expect(changeCountLabel([row({}), row({})])).toBe('2 record changes');
  });
});
