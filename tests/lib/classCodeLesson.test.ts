import { describe, it, expect } from 'vitest';
import { classCodeLessonFromScan, classCodeLearnedLabel } from '../../src/lib/classCodeLesson';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../../src/types';

/** A read whose class code the codex MISSED — that's what an empty `make` means here
 *  (`isUnknownClassCode` = a class code was printed and no make came back). */
const missed = (o: Partial<KeytagRead> = {}): KeytagRead => ({
  plate: 'LUR514', unitNumber: '5429311', classCode: 'CX6R',
  make: undefined, model: undefined, year: 2026, color: 'Silver',
  ...o,
} as KeytagRead);

const car = (o: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1', unitNumber: '5429311', licensePlate: 'LUR514',
  make: 'Volvo', model: 'XC60', year: 2026, color: 'Silver',
  status: 'AVAILABLE', branchId: 'YWG',
  ...o,
} as Vehicle);

describe('classCodeLessonFromScan', () => {
  it('⭐ teaches the codex from a car FG ALREADY KNOWS — the gap that made codes re-log forever', () => {
    // Found live on LUR514: the card asked for a make/model that was already on the record below it.
    expect(classCodeLessonFromScan(missed(), car())).toEqual({
      code: 'CX6R', make: 'Volvo', model: 'XC60',
    });
  });

  it('normalizes the code to the codex key rather than trusting the tag text', () => {
    expect(classCodeLessonFromScan(missed({ classCode: ' cx6r ' }), car())?.code).toBe('CX6R');
  });

  it('teaches nothing when the codex already resolved the code', () => {
    // A read with a make means the lookup HIT — there is no gap to close.
    expect(classCodeLessonFromScan(missed({ make: 'Volvo' }), car())).toBeNull();
  });

  it('teaches nothing when the tag printed no class code', () => {
    expect(classCodeLessonFromScan(missed({ classCode: '' }), car())).toBeNull();
  });

  it('teaches nothing on an UNREGISTERED car — that scan is still a real gap', () => {
    // No record to learn from, so it belongs in the self-reporting log, not the codex.
    expect(classCodeLessonFromScan(missed(), null)).toBeNull();
  });

  it('⭐ refuses a HALF record — a make with no model would poison the codex', () => {
    expect(classCodeLessonFromScan(missed(), car({ model: '   ' }))).toBeNull();
    expect(classCodeLessonFromScan(missed(), car({ make: '' }))).toBeNull();
  });

  it('trims the record values it teaches', () => {
    const lesson = classCodeLessonFromScan(missed(), car({ make: ' Toyota ', model: ' Tacoma ' }));
    expect(lesson).toEqual({ code: 'CX6R', make: 'Toyota', model: 'Tacoma' });
  });
});

describe('classCodeLearnedLabel', () => {
  it('says what it learned and where from — the inverse of the "not in the codex" warning', () => {
    const label = classCodeLearnedLabel({ code: 'CX6R', make: 'Volvo', model: 'XC60' });
    expect(label).toContain('CX6R');
    expect(label).toContain('Volvo XC60');
  });
});
