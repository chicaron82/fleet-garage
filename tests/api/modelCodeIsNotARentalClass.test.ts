import { describe, it, expect, vi, beforeEach } from 'vitest';

// ⭐⭐ Aaron, 2026-10-01, on the audit card for 0EZ443 (a Calgary tag: `08193  C` · `CK4L 25`):
// *"Do we still have CK4L as a rental class somewhere?"*
//
// It did, in two places. A 2026-09-29 scan filed the tag's MODEL CODE in the class slot; the learner
// taught `CK4L → CK4L` over the correct `CK4L → C`; the car stored rental class `CK4L`; and the audit's
// wrong-box guard, which learns its vocabulary from the fleet, then accused the CORRECT box and passed
// the wrong one. Every door that value went through is pinned here.
// docs/October/ticket-model-code-is-not-a-rental-class.md

const upserts: Record<string, unknown>[] = [];
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u-aaron' } } }) },
    from: () => ({ upsert: (row: Record<string, unknown>) => { upserts.push(row); return Promise.resolve({ error: null }); } }),
  },
  writeWithRefresh: (op: () => unknown) => op(),
}));

import { isCodeShapedClass, resolveRentalClass } from '../../api/_lib/classPin';
import { toKeytagRead } from '../../api/_lib/keytagReader';
import { auditWarnings, rentalClassVocabulary } from '../../src/lib/keytagAuditQueue';
import { pinClassMapping } from '../../src/context/classPinWrite';

beforeEach(() => { upserts.length = 0; });

describe('the shape rule', () => {
  // Every rental class on the live fleet, 2026-10-01: 846 cars, 25 kinds, none longer than two.
  const REAL = ['B', 'C', 'F', 'R', 'S', 'T', 'V', 'B4', 'B5', 'B9', 'E1', 'E6', 'E7', 'E8', 'E9',
    'H4', 'L2', 'M1', 'O6', 'P4', 'Q4', 'T4', 'T6', 'W4', 'Z4'];

  it('⚠️ passes every rental class the fleet actually uses', () => {
    for (const c of REAL) expect(isCodeShapedClass(c), c).toBe(false);
  });

  it('⭐ a four-character value is a model code, whatever any table says', () => {
    for (const c of ['CK4L', 'ck4l ', 'CTAV', 'CM3L', 'CQZZ']) expect(isCodeShapedClass(c), c).toBe(true);
  });

  it('an exact echo of the car\'s own model code is never its class', () => {
    expect(isCodeShapedClass('CK4', 'CK4')).toBe(true);
    expect(isCodeShapedClass('C', 'CK4L')).toBe(false);
  });

  it('a blank is not a claim', () => {
    expect(isCodeShapedClass('')).toBe(false);
    expect(isCodeShapedClass(null)).toBe(false);
  });
});

describe('door 1 — the tag reader', () => {
  it('⭐ 0EZ443: the model code in the class slot is dropped, and kept as the code', () => {
    const read = toKeytagRead({ plate: '0EZ443', classCode: 'CK4L', rentalClass: 'CK4L', year: 25 });
    expect(read.rentalClass).toBeUndefined();
    expect(read.classCode).toBe('CK4L');
    expect(read.model).toBe('K4');
  });

  it('⭐ recovers the code when it was filed ONLY under the class', () => {
    const read = toKeytagRead({ plate: '0EZ443', classCode: '', rentalClass: 'CK4L', year: 25 });
    expect(read.rentalClass).toBeUndefined();
    expect(read.classCode).toBe('CK4L');
  });

  it('a real class reads straight through', () => {
    expect(toKeytagRead({ classCode: 'CK4L', rentalClass: 'c' }).rentalClass).toBe('C');
    expect(toKeytagRead({ classCode: 'CRHX', rentalClass: 'Q4' }).rentalClass).toBe('Q4');
  });
});

describe('door 2 — the learner', () => {
  it('⭐ never teaches code → code', () => {
    const d = resolveRentalClass(null, 'CK4L');
    expect(d.teach).toBe(false);
    expect(d.rentalClass).toBeUndefined();
  });

  it('⭐ a poisoned stored row is not handed back as an "inferred" class', () => {
    const d = resolveRentalClass({ rental_class: 'CK4L', pinned_at: null }, undefined);
    expect(d.rentalClass).toBeUndefined();
    expect(d.rentalClassInferred).toBeUndefined();
  });

  it('…and a clean tag read heals the poisoned row', () => {
    expect(resolveRentalClass({ rental_class: 'CK4L', pinned_at: null }, 'C')).toEqual({ rentalClass: 'C', teach: true });
  });

  it('the normal path is untouched', () => {
    expect(resolveRentalClass({ rental_class: 'C', pinned_at: null }, undefined))
      .toEqual({ rentalClass: 'C', rentalClassInferred: true, teach: false });
  });
});

describe('door 3 — the audit card', () => {
  // The fleet exactly as it stood: 23 K4s carrying class C, and one carrying its own model code.
  const fleet = [
    ...Array.from({ length: 23 }, () => ({ classCode: 'CK4L', rentalClass: 'C' })),
    { classCode: 'CK4L', rentalClass: 'CK4L' },
    { classCode: 'CRHX', rentalClass: 'Q4' },
  ];
  const classes = rentalClassVocabulary(fleet);
  const codes = new Set(fleet.map(v => v.classCode).filter(c => !classes.has(c)));

  it('⭐ one poisoned row cannot teach the vocabulary that a code is a class', () => {
    expect([...classes].sort()).toEqual(['C', 'Q4']);
    expect(codes.has('CK4L')).toBe(true);
  });

  it('⭐ the warning lands on the RENTAL CLASS box, not on the correct model code', () => {
    const w = auditWarnings({ classCode: 'CK4L', rentalClass: 'CK4L' }, classes, codes);
    expect(w.map(x => x.field)).toEqual(['rentalClass']);
    expect(w[0].message).toMatch(/is a model code/);
  });

  // ⚠️ The exact state of 2026-10-01: a vocabulary ALREADY poisoned. The shape rule must hold anyway,
  // because the hook's fix and the card's fix should not depend on each other.
  it('⚠️ holds even against a vocabulary that is already poisoned', () => {
    const poisonedClasses = new Set(['C', 'Q4', 'CK4L']);
    const poisonedCodes = new Set(['CRHX']); // CK4L subtracted, as the hook used to do
    const w = auditWarnings({ classCode: 'CK4L', rentalClass: 'CK4L' }, poisonedClasses, poisonedCodes);
    expect(w.map(x => x.field)).toEqual(['rentalClass']);
  });

  it('flags a code no other car carries — shape, not vocabulary', () => {
    const w = auditWarnings({ classCode: '', rentalClass: 'CQZZ' }, new Set(['C']), new Set());
    expect(w.map(x => x.field)).toEqual(['rentalClass']);
  });

  it('the original guard still fires: a real class typed in the model-code box', () => {
    const w = auditWarnings({ classCode: 'Q4', rentalClass: '' }, classes, codes);
    expect(w.map(x => x.field)).toEqual(['classCode']);
  });

  it('a correct card raises nothing', () => {
    expect(auditWarnings({ classCode: 'CK4L', rentalClass: 'C' }, classes, codes)).toEqual([]);
  });
});

describe('door 4 — a hand edit', () => {
  it('⭐ refuses to PIN code → code, and writes nothing', async () => {
    expect(await pinClassMapping('CK4L', 'CK4L')).toEqual({ pinned: false });
    expect(upserts).toEqual([]);
  });

  it('still pins a real class', async () => {
    expect((await pinClassMapping('CK4L', 'C')).pinned).toBe(true);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ code: 'CK4L', rental_class: 'C' });
  });
});
