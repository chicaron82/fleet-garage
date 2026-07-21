import { describe, it, expect } from 'vitest';
import { resolveKeytag, type KeytagExistingVehicle } from '../../src/lib/resolveKeytag';
import type { KeytagRead } from '../../api/_lib/keytagRead';

// A fully-known fleet vehicle (the "complete" baseline).
const known: KeytagExistingVehicle = {
  unitNumber: '5-4321',
  make: 'Toyota',
  model: 'Corolla',
  year: 2022,
  color: 'Silver',
  rentalClass: null, // realistic: an existing fleet car with no class yet
};

const fullRead: KeytagRead = {
  plate: 'ABC123',
  unitNumber: '5-4321',
  make: 'Toyota',
  model: 'Corolla',
  year: 2022,
  color: 'Silver',
};

describe('resolveKeytag — new', () => {
  it('plate not in the fleet → new registration', () => {
    expect(resolveKeytag(fullRead, null)).toEqual({ kind: 'new' });
  });

  it('is new even when the read is sparse (only a plate)', () => {
    expect(resolveKeytag({ plate: 'XYZ789' }, null)).toEqual({ kind: 'new' });
  });
});

describe('resolveKeytag — complete', () => {
  it('read matches a fully-known vehicle → nothing to do', () => {
    expect(resolveKeytag(fullRead, known)).toEqual({ kind: 'complete' });
  });

  it('a read that offers nothing new (all blank fields) → complete', () => {
    expect(resolveKeytag({ plate: 'ABC123' }, known)).toEqual({ kind: 'complete' });
  });

  it('case/whitespace differences are not conflicts', () => {
    const messy: KeytagRead = { plate: 'ABC123', make: '  toyota ', model: 'COROLLA', color: 'silver' };
    expect(resolveKeytag(messy, known)).toEqual({ kind: 'complete' });
  });

  it('plate is the match key, never itself a fill or conflict', () => {
    // A different plate string on the read doesn't matter — the caller already matched by
    // plate, so resolution only concerns the identity fields.
    const other: KeytagRead = { plate: 'DIFFERENT', make: 'Toyota', model: 'Corolla', year: 2022, color: 'Silver', unitNumber: '5-4321' };
    expect(resolveKeytag(other, known)).toEqual({ kind: 'complete' });
  });
});

describe('resolveKeytag — partial (fills)', () => {
  it('fills blank existing fields from the read', () => {
    const sparse: KeytagExistingVehicle = { unitNumber: null, make: 'Toyota', model: '', year: 0, color: '' };
    const read: KeytagRead = { plate: 'ABC123', unitNumber: '5-4321', make: 'Toyota', model: 'Corolla', year: 2022, color: 'Silver' };
    const res = resolveKeytag(read, sparse);
    expect(res.kind).toBe('partial');
    if (res.kind !== 'partial') return;
    expect(res.conflicts).toEqual([]);
    expect(res.fills).toEqual([
      { field: 'unitNumber', value: '5-4321' },
      { field: 'model', value: 'Corolla' },
      { field: 'year', value: 2022 },
      { field: 'color', value: 'Silver' },
    ]);
  });

  it('year 0 is treated as unknown and gets filled', () => {
    const noYear: KeytagExistingVehicle = { ...known, year: 0 };
    const res = resolveKeytag({ plate: 'ABC123', year: 2021 }, noYear);
    expect(res).toEqual({ kind: 'partial', fills: [{ field: 'year', value: 2021 }], conflicts: [] });
  });
});

describe('resolveKeytag — partial (conflicts)', () => {
  it('flags a disagreement instead of overwriting a good value', () => {
    const res = resolveKeytag({ plate: 'ABC123', color: 'Blue' }, known);
    expect(res).toEqual({
      kind: 'partial',
      fills: [],
      conflicts: [{ field: 'color', existing: 'Silver', read: 'Blue' }],
    });
  });

  it('a year mismatch is a conflict', () => {
    const res = resolveKeytag({ plate: 'ABC123', year: 2019 }, known);
    expect(res).toEqual({
      kind: 'partial',
      fills: [],
      conflicts: [{ field: 'year', existing: 2022, read: 2019 }],
    });
  });
});

describe('resolveKeytag — partial (fills + conflicts together)', () => {
  it('fills the blanks and flags the disagreements in one pass', () => {
    const half: KeytagExistingVehicle = { unitNumber: null, make: 'Toyota', model: 'Corolla', year: 2022, color: 'Silver' };
    const read: KeytagRead = { plate: 'ABC123', unitNumber: '5-9999', color: 'Blue' };
    const res = resolveKeytag(read, half);
    expect(res.kind).toBe('partial');
    if (res.kind !== 'partial') return;
    expect(res.fills).toEqual([{ field: 'unitNumber', value: '5-9999' }]);
    expect(res.conflicts).toEqual([{ field: 'color', existing: 'Silver', read: 'Blue' }]);
  });
});

// ── Rental-class backfill (2026-07-20) — how the existing fleet gets classed as it's scanned ──
describe('resolveKeytag — rentalClass backfill', () => {
  it('fills the class onto an existing car that has none (the whole point)', () => {
    const res = resolveKeytag({ ...fullRead, rentalClass: 'Q4' }, known); // known.rentalClass is null
    expect(res).toEqual({ kind: 'partial', fills: [{ field: 'rentalClass', value: 'Q4' }], conflicts: [] });
  });

  it('a matching class is not a fill or a conflict → complete', () => {
    const classed: KeytagExistingVehicle = { ...known, rentalClass: 'Q4' };
    expect(resolveKeytag({ ...fullRead, rentalClass: 'Q4' }, classed)).toEqual({ kind: 'complete' });
  });

  it('NEVER clobbers a class already on the car — a disagreement is a conflict, not a fill', () => {
    const classed: KeytagExistingVehicle = { ...known, rentalClass: 'Q4' };
    const res = resolveKeytag({ ...fullRead, rentalClass: 'P4' }, classed);
    expect(res).toEqual({ kind: 'partial', fills: [], conflicts: [{ field: 'rentalClass', existing: 'Q4', read: 'P4' }] });
  });

  it('a read with no class offers nothing — no fill on an unclassed car', () => {
    expect(resolveKeytag(fullRead, known)).toEqual({ kind: 'complete' }); // fullRead has no rentalClass
  });
});
