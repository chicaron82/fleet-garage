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

  // ⚠️⚠️ THIS TEST ONCE ASSERTED THE BUG, and it is kept (rewritten) rather than deleted because
  // that is the more useful record. As first written, three hours before Aaron found LUR243, it
  // said a mismatched plate "still fills the car whose record holds the photo" — and called that
  // the guard. It WAS half a guard: the car is an argument, so a wrong plate can never redirect
  // values ONTO another car. But I wrote the fixture, chose the assertion, watched it pass, and
  // never asked the other half of the question — whether the photo belonged to this car at all.
  // A check I author on a fixture I choose cannot disconfirm me.
  //
  // Both halves now hold: the plate can never SELECT a car, and it can always VETO one.
  it('⚠️ a mismatched plate redirects nothing — and now fills nothing either', () => {
    const p = planKeytagReread({ ...TAG, plate: 'LZM999' }, vehicle({ licensePlate: 'LUR554' }));
    expect(p.fills).toEqual([]);
    expect(p.wrongPhoto).toEqual({ readPlate: 'LZM999', recordPlate: 'LUR554' });
  });
});


// ⚠️⚠️ THE HOLE THE VEHICLE-AS-ARGUMENT DECISION OPENED, found the evening it shipped. Passing the
// vehicle in stops a misread plate redirecting car A's values onto car B. It does nothing about the
// mirror case — a photo stored on the WRONG RECORD — because the one field that could object is
// exactly the field the design ignores.
//
// LUR243: corrected in August (Dodge Durango → Nissan Versa) with its old tag deliberately cleared,
// given a new photo by a batch upload that morning that belongs to another car, then filled by the
// re-read that evening with a 2026 VIN on a 2025 Versa. Aaron: *"pulled up LUR243, it has the wrong
// keytag attached to it."*
describe('planKeytagReread — is this even this car\'s tag?', () => {
  it('⚠️ writes NOTHING when the stored tag names a different car', () => {
    const p = planKeytagReread({ ...TAG, plate: 'LUR243' }, vehicle({ licensePlate: 'LZM541' }));
    expect(p.fills).toEqual([]);
    expect(p.disagreements).toEqual([]);
    expect(p.wrongPhoto).toEqual({ readPlate: 'LUR243', recordPlate: 'LZM541' });
  });

  // ⚠️ VETO ONLY, NEVER SELECT. The plate cannot choose a car — that is the lookup this module
  // exists to avoid. It can only refuse. Both guards are needed; neither alone is enough.
  it('⚠️ the plate still cannot redirect the fills anywhere', () => {
    const p = planKeytagReread({ ...TAG, plate: 'LUR243' }, vehicle({ licensePlate: 'LZM541' }));
    expect(p.fills).toEqual([]);   // not "filled onto LUR243" — filled nowhere
  });

  it('a matching plate proceeds exactly as before', () => {
    const p = planKeytagReread(TAG, vehicle({ licensePlate: 'LUR554' }));
    expect(p.wrongPhoto).toBeUndefined();
    expect(p.fills.length).toBeGreaterThan(0);
  });

  // ⚠️ A formatting difference is not a mismatch — the comparison is the one resolveKeytagScan
  // itself uses to match a tag to a car, so a tag FG would have matched must never be vetoed.
  it('⚠️ spacing and case are not a mismatch', () => {
    const p = planKeytagReread({ ...TAG, plate: 'lur 554' }, vehicle({ licensePlate: 'LUR554' }));
    expect(p.wrongPhoto).toBeUndefined();
  });

  // An unreadable plate line is not a disagreement — it is silence, and silence vetoes nothing.
  it('⚠️ a tag with no readable plate vetoes nothing', () => {
    const p = planKeytagReread({ vinLast9: '3S7792108' } as KeytagRead, vehicle());
    expect(p.wrongPhoto).toBeUndefined();
    expect(p.fills).toContainEqual({ field: 'vinLast9', value: '3S7792108' });
  });
});
