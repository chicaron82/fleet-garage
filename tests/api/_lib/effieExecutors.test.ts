import { describe, it, expect } from 'vitest';
import { computeBlankFills } from '../../../api/_lib/effieExecutors';

// The blanks-only backfill rule behind propose_update_and_hold: fill a field ONLY when the
// existing fleet row is blank AND the key tag read a value. Never overwrite a known field.
describe('computeBlankFills', () => {
  const fullTag = { unit_number: '5422183', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' };

  it('fills every blank field the tag supplies', () => {
    const existing = { unit_number: null, make: null, model: null, year: null, color: null };
    expect(computeBlankFills(existing, fullTag)).toEqual([
      { field: 'unitNumber', value: '5422183' },
      { field: 'make', value: 'Toyota' },
      { field: 'model', value: 'Corolla' },
      { field: 'year', value: 2026 },
      { field: 'color', value: 'White' },
    ]);
  });

  it('NEVER overwrites a field already on record — even if the tag disagrees', () => {
    const existing = { unit_number: '5422183', make: 'Toyota', model: 'Camry', year: 2025, color: 'Silver' };
    expect(computeBlankFills(existing, fullTag)).toEqual([]);
  });

  it('fills only the blanks, leaving the known fields untouched', () => {
    const existing = { unit_number: '5422183', make: 'Toyota', model: null, year: 0, color: '' };
    expect(computeBlankFills(existing, fullTag)).toEqual([
      { field: 'model', value: 'Corolla' },
      { field: 'year', value: 2026 },
      { field: 'color', value: 'White' },
    ]);
  });

  it('treats year 0 and whitespace strings as blank', () => {
    const existing = { unit_number: '   ', make: null, model: null, year: 0, color: null };
    const fills = computeBlankFills(existing, fullTag);
    expect(fills.find((f) => f.field === 'unitNumber')?.value).toBe('5422183');
    expect(fills.find((f) => f.field === 'year')?.value).toBe(2026);
  });

  it('skips a blank field the tag also lacks a value for', () => {
    const existing = { unit_number: null, make: null, model: null, year: null, color: null };
    expect(computeBlankFills(existing, { make: 'Toyota' })).toEqual([{ field: 'make', value: 'Toyota' }]);
  });

  it('trims the values it fills', () => {
    const existing = { unit_number: null, make: null, model: null, year: null, color: null };
    expect(computeBlankFills(existing, { color: '  White  ' })).toEqual([{ field: 'color', value: 'White' }]);
  });
});
