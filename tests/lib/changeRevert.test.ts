import { describe, it, expect } from 'vitest';
import { planRevert } from '../../src/lib/changeRevert';

// The real case (2026-08-22): a key-tag scan of LUR443 overwrote LUR243's identity. Every previous
// value was in the log; putting them back took eleven hand-written fields, two of them not editable
// in the UI at all. These tests pin both halves — it restores exactly what the entry recorded, and
// it REFUSES the moment anything has moved since.

const scanEntry = {
  make:         { from: 'Nissan',  to: 'Dodge' },
  model:        { from: 'Versa',   to: 'Durango' },
  year:         { from: 2025,      to: 2026 },
  color:        { from: 'Blue',    to: 'White' },
  unit_number:  { from: '5424882', to: '5429881' },
  rental_class: { from: 'B',       to: 'T' },
};
const afterScan = {
  make: 'Dodge', model: 'Durango', year: 2026, color: 'White',
  unit_number: '5429881', rental_class: 'T',
};

describe('planRevert', () => {
  it('⭐ restores exactly what the entry recorded', () => {
    const plan = planRevert(scanEntry, afterScan);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.patch).toEqual({
      make: 'Nissan', model: 'Versa', year: 2025, color: 'Blue',
      unit_number: '5424882', rental_class: 'B',
    });
    expect(plan.fields).toHaveLength(6);
  });

  it('restores a field back to NULL rather than skipping it', () => {
    // The scan also wrote a class code, an owning number and the other car's tag photo onto columns
    // that had been empty. A revert that silently left those set would only half-undo the damage.
    const plan = planRevert(
      { class_code: { from: null, to: 'CDGT' }, owning_area: { from: null, to: '8199' } },
      { class_code: 'CDGT', owning_area: '8199' },
    );
    expect(plan.ok && plan.patch).toEqual({ class_code: null, owning_area: null });
  });

  it('handles a jsonb column by comparing structurally', () => {
    const plan = planRevert(
      { field_sources: { from: {}, to: { make: 'tag' } } },
      { field_sources: { make: 'tag' } },
    );
    expect(plan.ok && plan.patch).toEqual({ field_sources: {} });
  });

  it('⭐⭐ REFUSES when a field has moved since', () => {
    // Somebody corrected the colour afterwards. Restoring the rest would undo their fix silently.
    const plan = planRevert(scanEntry, { ...afterScan, color: 'Silver' });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toContain('color');
    expect(plan.reason).toContain('changed since');
  });

  it('counts the drift rather than listing every field', () => {
    const plan = planRevert(scanEntry, { ...afterScan, color: 'Silver', year: 2024 });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toContain('2 of these fields');
  });

  it('⭐ never half-reverts — one drifted field blocks the whole entry', () => {
    // A partial revert leaves the record in a state that never existed on any real car.
    const plan = planRevert(scanEntry, { ...afterScan, unit_number: '9999999' });
    expect(plan.ok).toBe(false);
  });

  it('refuses a DELETE entry — re-creating a record is a different act', () => {
    const plan = planRevert({ id: 'x', make: 'Nissan' }, {}, 'DELETE');
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toContain('deleted');
  });

  it('refuses an entry with nothing revertible in it', () => {
    expect(planRevert({}, {}).ok).toBe(false);
    expect(planRevert({ note: 'not a from/to pair' }, {}).ok).toBe(false);
  });

  it('treats a missing current value and an explicit null as the same absence', () => {
    // A column the row simply does not carry must not read as drift.
    const plan = planRevert({ note: { from: 'old', to: null } }, {});
    expect(plan.ok && plan.patch).toEqual({ note: 'old' });
  });
});
