import { describe, it, expect } from 'vitest';
import { classCodeFromRead } from '../../api/_lib/vehicleClassCodex';
import { toKeytagRead } from '../../api/_lib/keytagReader';

// ⭐ Aaron, 2026-09-25, on 0AN391 (a VAN DTG Tesla): "FG keeps putting the model code as the model".
// Its tag prints "CM3L 22" with no Model label, and the reader filed the code under MODEL, so the car
// read "2022 Tesla CM3L" even though the codex knows CM3L is a Model 3.
describe('a known code filed under model is still the code', () => {
  it('⭐ recovers CM3L from the model field', () => {
    expect(classCodeFromRead(undefined, 'CM3L')).toBe('CM3L');
    expect(classCodeFromRead(undefined, 'cm3l ')).toBe('CM3L');
  });

  it('never overrides a code the reader did report', () => {
    expect(classCodeFromRead('CCVL', 'CM3L')).toBe('CCVL');
  });

  // A model NAME is never a codex key, so a real name can't be mistaken for a code; an unknown
  // string stays where the reader put it and the caller asks, as before.
  it('leaves a real model name, and an unknown code, alone', () => {
    expect(classCodeFromRead(undefined, 'Versa')).toBeUndefined();
    expect(classCodeFromRead(undefined, 'Model Y')).toBeUndefined();
    // ⚠️ Real 4-character model names on the live fleet (40 cars, 2026-09-25): same shape as a code.
    for (const name of ['XC60', 'XC40', 'XC90', 'RAV4']) expect(classCodeFromRead(undefined, name)).toBeUndefined();
    expect(classCodeFromRead(undefined, 'CQZZ')).toBeUndefined();
    expect(classCodeFromRead(undefined, undefined)).toBeUndefined();
  });
});

describe('the read the car page is built from', () => {
  it('⭐ 0AN391\'s tag reads as a Tesla Model 3 with its code, not "CM3L"', () => {
    const read = toKeytagRead({ model: 'CM3L', classCode: '', year: 22, plate: '0AN391', color: 'BLU' });
    expect(read.classCode).toBe('CM3L');
    expect(read.make).toBe('Tesla');
    expect(read.model).toBe('Model 3');
    expect(read.year).toBe(2022);
  });

  it('a handwritten model still comes through as written', () => {
    expect(toKeytagRead({ model: 'Versa', make: 'Nissan' }).model).toBe('Versa');
  });
});

// Pass two: Effie proposes registrations from her own reading of a tag, outside the key-tag reader,
// so she could hand over "CM3L" as the model too.
import { modelNotCode } from '../../api/_lib/effie/holdExecutors';
describe("Effie's register proposals", () => {
  it('⭐ turn a known code into its model name', () => {
    expect(modelNotCode('CM3L')).toBe('Model 3');
  });
  it('leave real names alone', () => {
    for (const name of ['XC60', 'RAV4', 'Versa', 'Model Y']) expect(modelNotCode(name)).toBe(name);
  });
});

// Pass two on ORA: Effie's proposals stored her colour verbatim, never through the tag table.
import { colourNotCode } from '../../api/_lib/effie/holdExecutors';
describe("Effie's register proposal colour", () => {
  it('⭐ expands a raw tag code the way the reader does', () => {
    expect(colourNotCode('ORA')).toBe('Orange');
    expect(colourNotCode('BLA')).toBe('Black');
  });
  it('leaves a word, and an unknown code, as given', () => {
    expect(colourNotCode('Blue')).toBe('Blue');
    expect(colourNotCode('TAN')).toBe('TAN');
  });
});
