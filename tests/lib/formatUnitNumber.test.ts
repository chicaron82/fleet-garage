import { describe, it, expect } from 'vitest';
import { formatUnitNumber } from '../../src/lib/formatUnitNumber';
import { formatUnitNumber as viaClosing } from '../../src/lib/closingInventory';

// ⭐ The tag groups the digits; a sheet that keeps the grouping can be checked against the tag.
describe('formatUnitNumber', () => {
  it('groups a seven-digit unit the way the key tag prints it', () => {
    expect(formatUnitNumber('5426952')).toBe('542 6952');
  });

  it('strips separators before grouping, so a re-read tag still formats', () => {
    expect(formatUnitNumber(' 542-6952 ')).toBe('542 6952');
  });

  it('⚠️ passes anything that is NOT seven digits through unchanged — never invents a shape', () => {
    expect(formatUnitNumber('12345')).toBe('12345');
    expect(formatUnitNumber('HRZ-9001')).toBe('HRZ-9001');
  });

  it('a car with no unit number stays empty rather than becoming a placeholder', () => {
    expect(formatUnitNumber(null)).toBe('');
    expect(formatUnitNumber(undefined)).toBe('');
    expect(formatUnitNumber('  ')).toBe('');
  });
});

// The closing sheet's import path still works after the move.
describe('closingInventory re-export', () => {
  it('is the same function', () => {
    expect(viaClosing).toBe(formatUnitNumber);
  });
});
