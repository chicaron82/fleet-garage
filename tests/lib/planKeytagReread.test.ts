import { describe, it, expect } from 'vitest';
import { planKeytagReread } from '../../src/lib/planKeytagReread';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../../src/types';

function vehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v-1', unitNumber: '5423827', licensePlate: 'LUR554', make: 'Kia', model: 'Seltos',
    year: 2025, color: 'Gray', status: 'CLEAR', branchId: 'YWG', isTesla: false,
    hasMobileCable: null, hasJ1772Adapter: null,
    owningArea: null, classCode: null, vinLast9: null, rentalClass: null, ...over,
  };
}

const TAG: KeytagRead = { plate: 'LUR554', owningArea: '08199', classCode: 'CKSV', vinLast9: '3S7792108', rentalClass: 'Q4' };

// ⭐ The backlog half of the pipeline fix. Aaron: *"having to find 45 keytags from ~150 to reupload
// is a hassle lol isn't there a better solution. can't it just be re-read and filled out?"*
describe('planKeytagReread', () => {
  it('fills the blanks the stored photo can answer', () => {
    const p = planKeytagReread(TAG, vehicle());
    expect(p.fills).toEqual(expect.arrayContaining([
      { field: 'owningArea', value: '8199' },   // normalized, not the printed 08199
      { field: 'classCode', value: 'CKSV' },
      { field: 'vinLast9', value: '3S7792108' },
      { field: 'rentalClass', value: 'Q4' },
    ]));
    expect(p.disagreements).toEqual([]);
  });

  // ⚠️⚠️ THE SAFETY ARGUMENT FOR RUNNING THIS UNATTENDED. A live scan applies an unlocked change
  // because the operator is at the car watching the warning. Nobody watches a bulk run — and the
  // photo being re-read is the SAME one that produced the current value, so a disagreement means
  // the model changed its mind, not that the car did.
  it('⚠️ never applies a disagreement — only counts it', () => {
    const p = planKeytagReread({ ...TAG, color: 'Black' }, vehicle({ color: 'Gray' }));
    expect(p.fills.some(f => f.field === 'color')).toBe(false);
    expect(p.disagreements).toContainEqual({ field: 'color', from: 'Gray', value: 'Black' });
  });

  it('⚠️ a locked (manually audited) field is a disagreement too, never a write', () => {
    const p = planKeytagReread(
      { vinLast9: '3S7792109' } as KeytagRead,
      vehicle({ vinLast9: '3S7792108', fieldSources: { vinLast9: 'manual' } }),
    );
    expect(p.fills).toEqual([]);
    expect(p.disagreements).toContainEqual({ field: 'vinLast9', existing: '3S7792108', read: '3S7792109' });
  });

  it('a car the tag agrees with entirely plans nothing at all', () => {
    const p = planKeytagReread(TAG, vehicle({ owningArea: '8199', classCode: 'CKSV', vinLast9: '3S7792108', rentalClass: 'Q4' }));
    expect(p).toEqual({ fills: [], disagreements: [] });
  });

  // ⚠️ THE KEY COUNT IS AARON'S: *"some of these photos have # of keys in them so they'd still need
  // my eyes."* It is counted off a ring, not read off printed text — a different kind of claim.
  it('⚠️ never plans a key count, whatever the read carries', () => {
    const p = planKeytagReread({ ...TAG, keyCount: 2 } as KeytagRead & { keyCount: number }, vehicle({ keyCount: null }));
    expect(p.fills.some(f => (f.field as string) === 'keyCount')).toBe(false);
  });

  // ⚠️⚠️ THE CROSS-CONTAMINATION GUARD, stated as a test because it is a property of the SIGNATURE.
  // The car is an argument, never a plate lookup — so a tag whose plate reads as a different car
  // still fills the car whose record holds the photo, and can never write onto the other one.
  it('⚠️ a misread plate cannot redirect the fills to another car', () => {
    const p = planKeytagReread({ ...TAG, plate: 'LZM999' }, vehicle({ licensePlate: 'LUR554' }));
    expect(p.fills).toContainEqual({ field: 'vinLast9', value: '3S7792108' });
  });
});
