import { describe, it, expect } from 'vitest';
import { auditModelCodes, oneEditApart, type AuditCar, type LearnedClassRow, type TaughtModelRow } from '../../src/lib/modelCodeAudit';

// Aaron, 2026-10-01: *"just like the class codes, can we have somewhere i can see FG's learned model
// codes to audit"*. Every rule below came from a real row in the live tables that evening.
//
// Fixtures lean on three facts of the built-in list: CTXF is a Chevrolet Trax, CTAA and CTBA are
// Chevrolet Trailblazers, CTAV is ambiguous. CQZZ / CQZX are in no list.

const car = (classCode: string, make: string, model: string, rentalClass: string | null): AuditCar =>
  ({ classCode, make, model, rentalClass });
const times = (n: number, c: AuditCar) => Array.from({ length: n }, () => ({ ...c }));
const learned = (code: string, rentalClass: string, pinned = false): LearnedClassRow => ({ code, rentalClass, pinned });
const taught = (code: string, make: string, model: string): TaughtModelRow => ({ code, make, model });

const TRAX = times(3, car('CTXF', 'Chevrolet', 'Trax', 'B4'));
const audit = (cars: AuditCar[], l: LearnedClassRow[] = [], t: TaughtModelRow[] = [], all: AuditCar[] = cars) =>
  auditModelCodes(cars, all, l, t);
const row = (a: ReturnType<typeof audit>, code: string) => a.rows.find(r => r.code === code)!;

describe('a healthy code', () => {
  it('⭐ shows what FG fills in, where it came from, and raises nothing', () => {
    const a = audit(TRAX, [learned('CTXF', 'B4')]);
    const r = row(a, 'CTXF');
    expect(r.model).toEqual({ name: 'Chevrolet Trax', source: 'built-in' });
    expect(r.rentalClass).toEqual({ value: 'B4', source: 'learned' });
    expect(r.liveCars).toBe(3);
    expect(r.problems).toEqual([]);
    expect(r.notes).toEqual([]);
    expect(a.toCheck).toBe(0);
    expect(a.unbacked).toBe(0);
  });

  it('leaves out a built-in code nothing was learned about and no car carries', () => {
    expect(audit(TRAX).rows.map(r => r.code)).toEqual(['CTXF']);
  });

  it('normalises the code on every side, so one code is one row', () => {
    const a = audit([car(' ctxf ', 'Chevrolet', 'Trax', 'B4')], [learned('ctxf', 'b4')], [taught('Ctxf ', 'Chevrolet', 'Trax')]);
    expect(a.rows).toHaveLength(1);
    expect(a.rows[0].code).toBe('CTXF');
    expect(a.rows[0].problems).toEqual([]);
  });
});

describe('a learned class worth his eyes', () => {
  it('⭐ flags a code that is not four characters (CVA, CELIA, CTM342)', () => {
    const a = audit(TRAX, [learned('CVA', 'B4'), learned('CELIA', 'B4'), learned('CTM342', 'B4')]);
    for (const code of ['CVA', 'CELIA', 'CTM342']) expect(row(a, code).problems[0]).toMatch(/isn't shaped like a model code/);
  });

  it('⭐ flags a class that is itself a model code (CK4L → CK4L)', () => {
    const a = audit(TRAX, [learned('CQZZ', 'CK4L')]);
    expect(row(a, 'CQZZ').problems[0]).toMatch(/is a model code, not a class/);
  });

  it('⭐ flags a class no car on the fleet has (CKRG → CA, CCRA → 34)', () => {
    const a = audit(TRAX, [learned('CQZZ', 'CA')]);
    expect(row(a, 'CQZZ').problems[0]).toMatch(/no car on the fleet has that class/);
  });

  it('an archived car still vouches for a class — the vocabulary is everything the fleet has carried', () => {
    const archived = car('CXXX', 'Volvo', 'V60', 'P4');
    const a = audit(TRAX, [learned('CQZZ', 'P4')], [], [...TRAX, archived]);
    expect(row(a, 'CQZZ').problems).toEqual([]);
  });

  it('⭐ flags a learned class the cars carrying the code disagree with', () => {
    const cars = [...TRAX, car('CQZZ', 'Kia', 'Seltos', 'B5')];
    const a = audit(cars, [learned('CTXF', 'B5')]);
    expect(row(a, 'CTXF').problems).toEqual(['FG learned class B5, but the cars carrying it are B4 ×3.']);
  });

  // ⚠️ A pin is his decision, made knowing what the cars say (CRHX → E6 over a lot of Q4 tags). The
  // audit that second-guesses a pin is the scanner re-teaching Q4 all over again.
  it('never questions a class he pinned, and never offers to forget it', () => {
    const cars = [...TRAX, car('CQZZ', 'Kia', 'Seltos', 'B5')];
    const r = row(audit(cars, [learned('CTXF', 'B5', true)]), 'CTXF');
    expect(r.problems).toEqual([]);
    expect(r.rentalClass).toEqual({ value: 'B5', source: 'pinned' });
    expect(r.canForgetClass).toBe(false);
  });

  it('offers Forget on a learned class only', () => {
    expect(row(audit(TRAX, [learned('CTXF', 'B4')]), 'CTXF').canForgetClass).toBe(true);
    expect(row(audit(TRAX), 'CTXF').canForgetClass).toBe(false);
  });
});

describe('a model worth his eyes', () => {
  it('⭐ flags a model the cars carrying the code contradict (CCMH: Camry vs Camry SE)', () => {
    const a = audit(times(5, car('CTXF', 'Chevrolet', 'Trax LS', 'B4')));
    expect(row(a, 'CTXF').problems).toEqual(['FG fills in Chevrolet Trax, but the cars carrying it are Chevrolet Trax LS ×5.']);
  });

  it('flags cars that do not agree among themselves, without picking a side', () => {
    const cars = [...TRAX, car('CTXF', 'Chevrolet', 'Trailblazer', 'B5')];
    expect(row(audit(cars), 'CTXF').problems).toEqual(["The cars carrying it don't agree: Chevrolet Trax ×3, Chevrolet Trailblazer."]);
  });

  it('matches a model without caring about case', () => {
    expect(row(audit([car('CTXF', 'CHEVROLET', 'trax', 'B4')]), 'CTXF').problems).toEqual([]);
  });

  it('⭐ flags a taught model the built-in list overrides (CBRS: Blazer vs Trailblazer)', () => {
    const r = row(audit(TRAX, [], [taught('CTXF', 'Chevrolet', 'Blazer')]), 'CTXF');
    expect(r.model).toEqual({ name: 'Chevrolet Trax', source: 'built-in' });
    expect(r.shadowedTaught).toBe('Chevrolet Blazer');
    expect(r.problems).toEqual(["You taught Chevrolet Blazer, but FG's built-in list says Chevrolet Trax and wins."]);
    expect(r.canForgetModel).toBe(true);
  });

  it('a taught model that agrees with the built-in one is redundant, not wrong', () => {
    const r = row(audit(TRAX, [], [taught('CTXF', 'Chevrolet', 'Trax')]), 'CTXF');
    expect(r.problems).toEqual([]);
    expect(r.shadowedTaught).toBe('Chevrolet Trax');
    expect(r.canForgetModel).toBe(true);
  });

  it('a taught model fills a gap the built-in list leaves, and can be forgotten', () => {
    const r = row(audit([car('CQZZ', 'Kia', 'Seltos', 'B5')], [], [taught('CQZZ', 'Kia', 'Seltos')]), 'CQZZ');
    expect(r.model).toEqual({ name: 'Kia Seltos', source: 'taught' });
    expect(r.shadowedTaught).toBeNull();
    expect(r.canForgetModel).toBe(true);
  });

  it('never offers to forget a built-in model', () => {
    expect(row(audit(TRAX), 'CTXF').canForgetModel).toBe(false);
  });

  // CTAV names two cars (2026-09-25). FG resolves it to nothing, whatever anyone taught.
  it('⭐ an ambiguous code fills in nothing, says why, and is not a problem', () => {
    const cars = [...times(2, car('CTAV', 'Chevrolet', 'Trax', 'B4')), car('CTAV', 'Chevrolet', 'Trailblazer', 'B5')];
    const r = row(audit(cars, [], [taught('CTAV', 'Chevrolet', 'Trailblazer')]), 'CTAV');
    expect(r.model).toBeNull();
    expect(r.shadowedTaught).toBe('Chevrolet Trailblazer');
    expect(r.problems).toEqual([]);
    expect(r.notes).toEqual(['Used for more than one model, so FG asks and never guesses.']);
  });

  it('notes a code on cars that FG has no model for', () => {
    expect(row(audit([car('CQZZ', 'Kia', 'Seltos', 'B5')]), 'CQZZ').notes).toEqual(['FG has no model for this code. One car carries it.']);
    expect(row(audit(times(2, car('CQZZ', 'Kia', 'Seltos', 'B5'))), 'CQZZ').notes).toEqual(['FG has no model for this code. 2 cars carry it.']);
  });
});

describe('a code no live car carries', () => {
  const SELTOS = times(2, car('CQZZ', 'Kia', 'Seltos', 'B5'));

  it('⭐ is a problem when a one-edit twin on live cars carries the SAME class (CX4L beside CK4L)', () => {
    const r = row(audit(SELTOS, [learned('CQZX', 'B5')]), 'CQZX');
    expect(r.problems).toEqual(['No live car carries it. It is one character from CQZZ (2 cars), which is also class B5.']);
  });

  // ⚠️ The dense-space trap: every code starts with C, so "one edit from a living code" alone matched
  // nearly every unbacked row on the first dry run. A different class is a neighbour, not a suspect.
  it('⭐ is only a note when the twin carries a different class', () => {
    const cars = [...SELTOS, ...TRAX];
    const r = row(audit(cars, [learned('CQZX', 'B4')]), 'CQZX');
    expect(r.problems).toEqual([]);
    expect(r.notes).toEqual(['No live car carries this code. Nearest living code: CQZZ (2 cars).']);
  });

  it('⭐ a built-in code is cleared of suspicion — a real code whose cars all left', () => {
    // CTBA and CTAA are both built-in Trailblazers, one character apart, both B5.
    const cars = [car('CTAA', 'Chevrolet', 'Trailblazer', 'B5')];
    const r = row(audit(cars, [learned('CTBA', 'B5')]), 'CTBA');
    expect(r.problems).toEqual([]);
    expect(r.notes).toEqual(['No live car carries this code. Nearest living code: CTAA (1 car).']);
  });

  // CSM3 → Tesla Model 3 was taught from a misread of CTM3 at a registration. Being taught is exactly
  // how a misread gets a model, so it cannot be what clears one.
  it('⭐ a TAUGHT model does not clear it', () => {
    const r = row(audit(SELTOS, [learned('CQZX', 'B5')], [taught('CQZX', 'Kia', 'Seltos')]), 'CQZX');
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(/one character from CQZZ/);
  });

  it('names the busiest twin when there are several', () => {
    const cars = [...SELTOS, car('CQZY', 'Kia', 'Seltos', 'B5')];
    expect(row(audit(cars, [learned('CQZX', 'B5')]), 'CQZX').problems[0]).toMatch(/from CQZZ \(2 cars\)/);
  });

  it('says so plainly when nothing is near it', () => {
    expect(row(audit(TRAX, [learned('CQZZ', 'B4')]), 'CQZZ').notes).toEqual(['No live car carries this code.']);
  });
});

describe('oneEditApart', () => {
  it('is one wrong character, or two neighbours swapped', () => {
    expect(oneEditApart('CX4L', 'CK4L')).toBe(true);
    expect(oneEditApart('CRBV', 'CRVB')).toBe(true);
  });
  it('is not the same code, a different length, two wrong characters, or a far swap', () => {
    expect(oneEditApart('CK4L', 'CK4L')).toBe(false);
    expect(oneEditApart('CK4', 'CK4L')).toBe(false);
    expect(oneEditApart('CXXL', 'CK4L')).toBe(false);
    expect(oneEditApart('LK4C', 'CK4L')).toBe(false);
  });
});

describe('the order he reads it in', () => {
  it('⭐ problems first, then the unbacked, then the healthy — busiest first within each', () => {
    const cars = [...TRAX, ...times(5, car('CTAA', 'Chevrolet', 'Trailblazer', 'B5')), car('CQZZ', 'Kia', 'Seltos', 'B5')];
    const a = audit(cars, [learned('CVA', 'B5'), learned('CQQQ', 'B4'), learned('CTXF', 'B5')]);
    expect(a.rows.map(r => r.code)).toEqual(['CTXF', 'CVA', 'CQQQ', 'CTAA', 'CQZZ']);
    expect(a.toCheck).toBe(2);
    expect(a.unbacked).toBe(1);
  });
});
