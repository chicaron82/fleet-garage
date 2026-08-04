import { describe, it, expect } from 'vitest';
import { computeBlankFills, missingRegisterFieldsResult } from '../../../../api/_lib/effie/holdExecutors';

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

// The shared register-path guard behind propose_register_and_hold + propose_register_vehicle:
// every one of the six identity fields must be present (non-blank) before a proposal is drafted.
describe('missingRegisterFieldsResult', () => {
  const full = { plate: 'ABC123', unit_number: '5422183', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' };

  it('returns null when every required field is present', () => {
    expect(missingRegisterFieldsResult(full, 'Ask the user.')).toBeNull();
  });

  it('lists exactly the blank fields and tails the caller hint', () => {
    const result = missingRegisterFieldsResult({ plate: 'ABC123', make: 'Toyota' }, 'Ask the user for these before proposing.');
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe('Still need: unit_number, model, year, color. Ask the user for these before proposing.');
  });

  it('treats undefined, null, empty string, and whitespace-only as missing', () => {
    const result = missingRegisterFieldsResult(
      { plate: 'ABC123', unit_number: '', make: '   ', model: undefined, year: 2026, color: 'White' },
      'Read them off the key tag or ask the user before proposing.',
    );
    const parsed = JSON.parse(result!);
    expect(parsed.reason).toBe('Still need: unit_number, make, model. Read them off the key tag or ask the user before proposing.');
  });

  it('counts year 0 as PRESENT — the guard string-coerces ("0" is non-blank), unlike computeBlankFills', () => {
    // Preserved quirk: this register guard uses `${v}`.trim(), so 0 → "0" → not missing. That
    // differs from computeBlankFills (which uses !year). Pinned so a future "cleanup" can't silently
    // change either path to match the other without a decision.
    expect(missingRegisterFieldsResult({ ...full, year: 0 }, 'Ask the user.')).toBeNull();
  });

  it('keeps the two call sites distinct via their hint text', () => {
    const bare = { plate: 'ABC123' };
    expect(JSON.parse(missingRegisterFieldsResult(bare, 'Ask the user for these before proposing.')!).reason)
      .toContain('Ask the user for these before proposing.');
    expect(JSON.parse(missingRegisterFieldsResult(bare, 'Read them off the key tag or ask the user before proposing.')!).reason)
      .toContain('Read them off the key tag or ask the user before proposing.');
  });
});
