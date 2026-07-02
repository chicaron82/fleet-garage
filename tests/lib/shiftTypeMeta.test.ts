import { describe, it, expect } from 'vitest';
import {
  SHIFT_TYPE_LABEL, shiftTypeSentence, SHIFT_TYPE_PILL, fmtTime24, shiftTimeRange,
} from '../../src/lib/shiftTypeMeta';
import type { ShiftType } from '../../src/types';

const ALL: ShiftType[] = ['opening', 'mid', 'closing', 'day-off', 'pto', 'sick'];

describe('SHIFT_TYPE_LABEL', () => {
  it('covers every shift type with a short label', () => {
    for (const t of ALL) expect(SHIFT_TYPE_LABEL[t]).toBeTruthy();
    expect(SHIFT_TYPE_LABEL['opening']).toBe('Opening');
    expect(SHIFT_TYPE_LABEL['day-off']).toBe('Day Off');
  });
});

describe('shiftTypeSentence', () => {
  it('reads as the report dialect', () => {
    expect(shiftTypeSentence('opening')).toBe('Opening shift');
    expect(shiftTypeSentence('mid')).toBe('Mid shift');
    expect(shiftTypeSentence('closing')).toBe('Closing shift');
    expect(shiftTypeSentence('day-off')).toBe('Day Off');
    expect(shiftTypeSentence('pto')).toBe('PTO');
    expect(shiftTypeSentence('sick')).toBe('Sick Day');
  });
});

describe('SHIFT_TYPE_PILL', () => {
  it('covers every shift type with literal Tailwind classes (JIT-safe)', () => {
    for (const t of ALL) expect(SHIFT_TYPE_PILL[t]).toMatch(/bg-.+text-/s);
  });
});

describe('fmtTime24', () => {
  it('trims HH:MM:SS to HH:MM and handles undefined', () => {
    expect(fmtTime24('06:45:00')).toBe('06:45');
    expect(fmtTime24('06:45')).toBe('06:45');
    expect(fmtTime24(undefined)).toBe('');
  });
});

describe('shiftTimeRange', () => {
  it('formats a range, null when either end is missing', () => {
    expect(shiftTimeRange('06:45:00', '15:30:00')).toBe('06:45 – 15:30');
    expect(shiftTimeRange(undefined, '15:30')).toBeNull();
    expect(shiftTimeRange('06:45', undefined)).toBeNull();
  });
});
