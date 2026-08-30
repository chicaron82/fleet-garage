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
  // Blank too, and realistically so: these three were unwritable by any scan path until
  // 2026-08-30, so an existing car overwhelmingly has nothing in them.
  owningArea: null,
  classCode: null,
  vinLast9: null,
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

  it('case/whitespace differences are not changes', () => {
    const messy: KeytagRead = { plate: 'ABC123', make: '  toyota ', model: 'COROLLA', color: 'silver' };
    expect(resolveKeytag(messy, known)).toEqual({ kind: 'complete' });
  });

  it('plate is the match key, never itself a fill/change/conflict', () => {
    const other: KeytagRead = { plate: 'DIFFERENT', make: 'Toyota', model: 'Corolla', year: 2022, color: 'Silver', unitNumber: '5-4321' };
    expect(resolveKeytag(other, known)).toEqual({ kind: 'complete' });
  });
});

describe('resolveKeytag — partial (fills)', () => {
  it('fills blank existing fields from the read', () => {
    const sparse: KeytagExistingVehicle = { unitNumber: null, make: 'Toyota', model: '', year: 0, color: '', rentalClass: null, owningArea: null, classCode: null, vinLast9: null };
    const read: KeytagRead = { plate: 'ABC123', unitNumber: '5-4321', make: 'Toyota', model: 'Corolla', year: 2022, color: 'Silver' };
    const res = resolveKeytag(read, sparse);
    expect(res.kind).toBe('partial');
    if (res.kind !== 'partial') return;
    expect(res.conflicts).toEqual([]);
    expect(res.changes).toEqual([]);
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
    expect(res).toEqual({ kind: 'partial', fills: [{ field: 'year', value: 2021 }], changes: [], conflicts: [] });
  });
});

// ── The reworked contract (2026-07-22): a disagreement on an UNLOCKED field is a CHANGE (applied),
//    because the tag knows more than an inferred/older guess. Only a LOCKED (manual) field blocks it.
describe('resolveKeytag — partial (changes: unlocked disagreements are applied)', () => {
  it('a colour disagreement on an unlocked field → change (the tag corrects it)', () => {
    const res = resolveKeytag({ plate: 'ABC123', color: 'Blue' }, known);
    expect(res).toEqual({
      kind: 'partial',
      fills: [],
      changes: [{ field: 'color', from: 'Silver', value: 'Blue' }],
      conflicts: [],
    });
  });

  it('a year disagreement is a change, not a block', () => {
    const res = resolveKeytag({ plate: 'ABC123', year: 2019 }, known);
    expect(res).toEqual({
      kind: 'partial',
      fills: [],
      changes: [{ field: 'year', from: 2022, value: 2019 }],
      conflicts: [],
    });
  });
});

// ── The lock: a field the operator manually set (field_sources 'manual') is passed in `locked`, and
//    a disagreeing tag is BLOCKED (conflict), never applied.
describe('resolveKeytag — partial (conflicts: locked fields block the tag)', () => {
  it('a locked colour disagreement → conflict (Aaron\'s edit wins)', () => {
    const res = resolveKeytag({ plate: 'ABC123', color: 'Blue' }, known, { color: true });
    expect(res).toEqual({
      kind: 'partial',
      fills: [],
      changes: [],
      conflicts: [{ field: 'color', existing: 'Silver', read: 'Blue' }],
    });
  });

  it('locking one field does not lock the others — the rest still change', () => {
    // class is locked (manual), colour is not → class blocks, colour applies.
    const classed: KeytagExistingVehicle = { ...known, rentalClass: 'E6' };
    const read: KeytagRead = { plate: 'ABC123', color: 'Blue', rentalClass: 'F' };
    const res = resolveKeytag(read, classed, { rentalClass: true });
    expect(res).toEqual({
      kind: 'partial',
      fills: [],
      changes: [{ field: 'color', from: 'Silver', value: 'Blue' }],
      conflicts: [{ field: 'rentalClass', existing: 'E6', read: 'F' }],
    });
  });
});

describe('resolveKeytag — fills + changes together', () => {
  it('fills the blanks and applies the unlocked corrections in one pass', () => {
    const half: KeytagExistingVehicle = { unitNumber: null, make: 'Toyota', model: 'Corolla', year: 2022, color: 'Silver', rentalClass: null, owningArea: null, classCode: null, vinLast9: null };
    const read: KeytagRead = { plate: 'ABC123', unitNumber: '5-9999', color: 'Blue' };
    const res = resolveKeytag(read, half);
    expect(res.kind).toBe('partial');
    if (res.kind !== 'partial') return;
    expect(res.fills).toEqual([{ field: 'unitNumber', value: '5-9999' }]);
    expect(res.changes).toEqual([{ field: 'color', from: 'Silver', value: 'Blue' }]);
    expect(res.conflicts).toEqual([]);
  });
});

// ── Rental-class: fill an unclassed car, and the provenance ladder in action (inferred < tag < manual)
describe('resolveKeytag — rentalClass provenance ladder', () => {
  it('fills the class onto an existing car that has none (the whole point)', () => {
    const res = resolveKeytag({ ...fullRead, rentalClass: 'Q4' }, known); // known.rentalClass is null
    expect(res).toEqual({ kind: 'partial', fills: [{ field: 'rentalClass', value: 'Q4' }], changes: [], conflicts: [] });
  });

  it('a matching class is not a change or conflict → complete', () => {
    const classed: KeytagExistingVehicle = { ...known, rentalClass: 'Q4' };
    expect(resolveKeytag({ ...fullRead, rentalClass: 'Q4' }, classed)).toEqual({ kind: 'complete' });
  });

  it('INFERRED class (unlocked): a fresh tag CORRECTS it → change (the 156 self-heal)', () => {
    const classed: KeytagExistingVehicle = { ...known, rentalClass: 'Q4' }; // DiZee's inferred guess
    const res = resolveKeytag({ ...fullRead, rentalClass: 'C' }, classed);   // no lock passed
    expect(res).toEqual({ kind: 'partial', fills: [], changes: [{ field: 'rentalClass', from: 'Q4', value: 'C' }], conflicts: [] });
  });

  it('MANUAL class (locked): the tag is blocked → conflict (the CCLH/E6 fix)', () => {
    const classed: KeytagExistingVehicle = { ...known, rentalClass: 'E6' }; // Aaron edited it
    const res = resolveKeytag({ ...fullRead, rentalClass: 'F' }, classed, { rentalClass: true });
    expect(res).toEqual({ kind: 'partial', fills: [], changes: [], conflicts: [{ field: 'rentalClass', existing: 'E6', read: 'F' }] });
  });

  it('a read with no class offers nothing — no change on an unclassed car', () => {
    expect(resolveKeytag(fullRead, known)).toEqual({ kind: 'complete' }); // fullRead has no rentalClass
  });
});


// ⭐⭐ THE THREE FIELDS THE READER ALWAYS GAVE AND NO WRITER TOOK. Aaron, after dumping his camera
// roll into the batch register, 2026-08-30: *"were the keytags in the audit really that unreadable?
// i feel most of them could have been read easily."* They were readable. Of the 45 cars the batch
// left in his audit queue, 44 were missing owning area and 44 were missing the VIN — and NOT ONE was
// missing its unit number. A smudged tag does not lose two specific lines on every car.
describe('the tag fields a scan could never write', () => {
  const bare: KeytagExistingVehicle = { ...known, unitNumber: null, make: '', model: '', year: 0, color: '' };

  it('⭐ fills owning area, model code and VIN from the read', () => {
    const r = resolveKeytag({ owningArea: '8199', classCode: 'CKSV', vinLast9: '3S7792108' } as KeytagRead, bare);
    expect(r.kind).toBe('partial');
    if (r.kind !== 'partial') return;
    expect(r.fills).toEqual(expect.arrayContaining([
      { field: 'owningArea', value: '8199' },
      { field: 'classCode', value: 'CKSV' },
      { field: 'vinLast9', value: '3S7792108' },
    ]));
  });

  // ⚠️⚠️ THE TRAP THAT MAKES `readValue` EXIST. Tags PRINT the branch with a leading zero — "08199"
  // — and FG stores 8199, because normalizeOwning has always stripped it. Comparing the printed
  // form against the stored one calls a correctly-recorded car a CHANGE, and a change is APPLIED —
  // so every scan of every car would have quietly rewritten its branch to the printed form.
  it('⚠️ a printed "08199" against a stored "8199" is NOT a change', () => {
    const r = resolveKeytag({ owningArea: '08199' } as KeytagRead, { ...known, owningArea: '8199' });
    expect(r.kind).toBe('complete');
  });

  it('⚠️ and it fills in the stored form, never the printed one', () => {
    const r = resolveKeytag({ owningArea: '08199' } as KeytagRead, bare);
    if (r.kind !== 'partial') throw new Error('expected partial');
    expect(r.fills).toContainEqual({ field: 'owningArea', value: '8199' });
  });

  // A branch number too short to be one is not a fact — normalizeOwning returns '', and a blank
  // read must offer nothing rather than blanking the record.
  it('⚠️ an unusable owning read offers nothing at all', () => {
    const r = resolveKeytag({ owningArea: '81' } as KeytagRead, bare);
    if (r.kind !== 'partial') { expect(r.kind).toBe('complete'); return; }
    expect(r.fills.some(f => f.field === 'owningArea')).toBe(false);
  });

  // The provenance ladder applies to them exactly as it does to the older six: a value Aaron typed
  // into the auditor is 'manual' and LOCKED, so a later misread reports a conflict instead of
  // overwriting the VIN he checked against the tag in his hand.
  it('⚠️ a manually-audited VIN blocks a disagreeing read', () => {
    const r = resolveKeytag(
      { vinLast9: '3S7792109' } as KeytagRead,
      { ...known, vinLast9: '3S7792108' },
      { vinLast9: true },
    );
    if (r.kind !== 'partial') throw new Error('expected partial');
    expect(r.conflicts).toEqual([{ field: 'vinLast9', existing: '3S7792108', read: '3S7792109' }]);
    expect(r.changes).toEqual([]);
  });
});
