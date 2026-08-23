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
    expect(describeChangeTime(new Date(2026, 7, 18, 14, 5).toISOString(), now)).toBe('today 14:05');
    expect(describeChangeTime(new Date(2026, 7, 17, 9, 3).toISOString(), now)).toBe('yesterday 09:03');
  });

  it('⭐ 24-hour and device-independent — FG is 24-hour everywhere', () => {
    // Two decisions in one line. Hand-formatted because toLocaleTimeString reads the DEVICE locale,
    // so the same log would render differently phone to phone. 24-hour because every other clock in
    // FG is (hand-off card, backdate sheet, shift report, off-standard report) — Aaron's call when
    // I asked: he reads 24h fine and wants FG consistent. The AM/PM constraint I nearly carried in
    // belonged to his SISTER's order sheet, not to this app.
    expect(describeChangeTime(new Date(2026, 7, 18, 22, 55).toISOString(), now)).toBe('today 22:55');
    expect(describeChangeTime(new Date(2026, 7, 18, 0, 5).toISOString(), now)).toBe('today 00:05');
    expect(describeChangeTime(new Date(2026, 7, 18, 12, 30).toISOString(), now)).toBe('today 12:30');
  });
  it('falls back to a dated stamp further out', () => {
    expect(describeChangeTime(new Date(2026, 7, 2, 9, 3).toISOString(), now)).toBe('Aug 2, 09:03');
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

// ── field_sources, and the two JSON blobs it used to print ──────────────────────────────────────
// Aaron, looking at a real record 2026-08-22: "cleaning up how this displays". The provenance map is
// a jsonb object and the trigger records the whole thing on both sides, so ONE field's provenance
// moving rendered as two 120-character blobs with the actual change buried inside them.

describe('changeLines — field_sources', () => {
  const row = (from: unknown, to: unknown) =>
    ({ changedAt: '2026-08-22T18:54:00Z', op: 'UPDATE' as const, changed: { field_sources: { from, to } } });

  it('⭐ shows only the key that MOVED, in FG vocabulary', () => {
    // The real entry: everything identical except classCode, derived → tag.
    const before = { make: 'tag', year: 'tag', color: 'tag', model: 'tag', classCode: 'derived', unitNumber: 'tag', rentalClass: 'tag' };
    const after  = { ...before, classCode: 'tag' };
    const lines = changeLines(row(before, after));
    expect(lines).toEqual([{ field: 'field_sources.classCode', label: 'Model code source', from: 'derived', to: 'tag' }]);
  });

  it('names a source that appears where there was none', () => {
    const lines = changeLines(row({}, { classCode: 'tag' }));
    expect(lines).toEqual([{ field: 'field_sources.classCode', label: 'Model code source', from: '—', to: 'tag' }]);
  });

  it('names one that disappears', () => {
    const lines = changeLines(row({ unitNumber: 'tag' }, {}));
    expect(lines[0]).toMatchObject({ label: 'Unit number source', from: 'tag', to: '—' });
  });

  it('⭐ says NOTHING when the object was rewritten but nothing actually moved', () => {
    // A write that stores an identical map is bookkeeping, and a line saying so is a line that
    // teaches him to scroll past this section.
    const same = { make: 'tag', classCode: 'tag' };
    expect(changeLines(row(same, { ...same }))).toEqual([]);
  });

  it('lists several movers separately rather than as one blob', () => {
    const lines = changeLines(row({ make: 'derived' }, { make: 'tag', color: 'tag' }));
    expect(lines.map(l => l.label).sort()).toEqual(['Colour source', 'Make source']);
  });

  it('survives a malformed provenance value without throwing', () => {
    expect(changeLines(row(null, 'not-an-object'))).toEqual([]);
  });
});

describe('changeLines — note_at', () => {
  it('⭐ drops the note timestamp, which only ever repeats the Note line', () => {
    // It printed a raw ISO string under every note change and said nothing the line above did not.
    const lines = changeLines({
      changedAt: '2026-08-21T18:56:00Z', op: 'UPDATE',
      changed: {
        note:    { from: null, to: 'Assigned to car star Fife' },
        note_at: { from: null, to: '2026-08-21T18:56:41.996+00:00' },
      },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe('Note');
  });
});
