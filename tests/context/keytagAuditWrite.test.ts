import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Vehicle } from '../../src/types';

// The auditor's write path — a HUMAN read the stored key-tag photo.
//
// ⭐ The two behaviours that separate this from every other tag write, and the reason it is its own
// module: confirming an unchanged field is still a WRITE (it stamps 'manual', which locks the field
// against later misreads), and a VIN may be CORRECTED here — the one place that is allowed, because
// `vinWrite`'s immutability exists to stop a MODEL rewriting a good value with nobody present.

const updates: Record<string, unknown>[] = [];
let existingSources: Record<string, string> = {};
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { field_sources: existingSources } }) }) }),
      update: (payload: Record<string, unknown>) => { updates.push(payload); return { eq: async () => ({ error: null }) }; },
    }),
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

import { makeSaveKeytagAudit, makeFlagKeytag, makeReopenKeytagAudit } from '../../src/context/keytagAuditWrite';

const car = (over: Partial<Vehicle> & { id: string }): Vehicle => ({
  unitNumber: '5420427', licensePlate: 'LUR202', make: 'Toyota', model: 'RAV4', year: 2026,
  color: 'White', status: 'CLEAR', branchId: 'YWG',
  owningArea: '8199', rentalClass: 'Q4', classCode: 'CCVL', vinLast9: 'ABC123456',
  ...over,
} as Vehicle);

const setAll = vi.fn();
const save = (fleet: Vehicle[]) => makeSaveKeytagAudit({ setAllVehicles: setAll, allVehicles: fleet, userId: 'aaron' });

const FULL = {
  owningArea: '8199', rentalClass: 'Q4', classCode: 'CCVL', unitNumber: '5420427', vinLast9: 'ABC123456',
};

beforeEach(() => { updates.length = 0; existingSources = {}; setAll.mockClear(); });

describe('saveKeytagAudit — confirming is a write', () => {
  it('⭐ stamps every confirmed field manual even when nothing changed', async () => {
    await save([car({ id: 'me' })])('me', FULL);
    expect(updates[0].field_sources).toEqual({
      owningArea: 'manual', rentalClass: 'manual', classCode: 'manual',
      unitNumber: 'manual', vinLast9: 'manual',
    });
  });

  it('writes no column for a field he only confirmed', async () => {
    await save([car({ id: 'me' })])('me', FULL);
    expect(updates[0]).not.toHaveProperty('owning_area');
    expect(updates[0]).not.toHaveProperty('class_code');
  });

  it('always records who audited it and when', async () => {
    await save([car({ id: 'me' })])('me', FULL);
    expect(updates[0]).toMatchObject({ keytag_audited_by: 'aaron', keytag_audit_result: 'verified' });
    expect(typeof updates[0].keytag_audited_at).toBe('string');
  });

  it('merges the manual stamps onto provenance the record already had', async () => {
    existingSources = { color: 'tag' };
    await save([car({ id: 'me' })])('me', { owningArea: '8199' });
    expect(updates[0].field_sources).toEqual({ color: 'tag', owningArea: 'manual' });
  });
});

describe('saveKeytagAudit — filling and correcting', () => {
  it('fills a blank field and stamps it', async () => {
    await save([car({ id: 'me', owningArea: null })])('me', { ...FULL, owningArea: '8199' });
    expect(updates[0]).toMatchObject({ owning_area: '8199' });
    expect((updates[0].field_sources as Record<string, string>).owningArea).toBe('manual');
  });

  it('⭐ CORRECTS a VIN that is already on file — the one write allowed to', async () => {
    // vinWrite refuses this by design: first good read wins, because a MODEL might be misreading.
    // Aaron with the tag in front of him is the other case entirely.
    // ⚠️ FIXTURE IS THE REAL CASE (2026-09-13): LFJ400 held `VXSL47717` — its tag's own value, the
    // right characters sliced one position too far left — and the windshield read `XSL477170`.
    // The old fixture was `ABC123456`, which cannot be a VIN at all (A is not a check digit) and so
    // stopped compiling as a test the moment the guard went on this path.
    await save([car({ id: 'me', vinLast9: 'VXSL47717' })])('me', { ...FULL, vinLast9: 'XSL477170' });
    expect(updates[0]).toMatchObject({ vin_last9: 'XSL477170' });
    expect((updates[0].field_sources as Record<string, string>).vinLast9).toBe('manual');
  });

  it('⭐⭐ REFUSES a VIN that cannot be one — and still saves every other field', async () => {
    // The guard added 2026-09-13. `VXSL47717` is what LFJ400's tag prints; this path wrote it in on
    // 2026-08-29 over a field that had just been cleared. It cannot happen again.
    const result = await save([car({ id: 'me', vinLast9: null })])('me', { ...FULL, vinLast9: 'VXSL47717' });
    expect(updates[0]).not.toHaveProperty('vin_last9');
    expect(result.vinRejected).toBe('VXSL47717');
  });

  it('⚠️ a refused VIN is NOT stamped manual — the stamp claims a human confirmed what FG HOLDS', async () => {
    await save([car({ id: 'me', vinLast9: null })])('me', { ...FULL, vinLast9: 'VXSL47717' });
    expect(updates[0].field_sources).not.toHaveProperty('vinLast9');
  });

  it('⚠️ leaves a field he could not read alone — neither written nor stamped', async () => {
    // A blank means "I couldn't see it either", which is not a fact about the car.
    await save([car({ id: 'me', vinLast9: null })])('me', { ...FULL, vinLast9: '   ' });
    expect(updates[0]).not.toHaveProperty('vin_last9');
    expect(updates[0].field_sources).not.toHaveProperty('vinLast9');
  });

  it('trims what he typed before comparing, so trailing space is not a change', async () => {
    await save([car({ id: 'me' })])('me', { ...FULL, classCode: '  CCVL  ' });
    expect(updates[0]).not.toHaveProperty('class_code');
    expect((updates[0].field_sources as Record<string, string>).classCode).toBe('manual');
  });
});

describe('saveKeytagAudit — the unit# collision guard', () => {
  const OTHER = car({ id: 'other', licensePlate: 'LUR234', unitNumber: '5422027' });

  it('⭐ refuses a unit number another live record already carries', async () => {
    const res = await save([OTHER, car({ id: 'me' })])('me', { ...FULL, unitNumber: '5422027' });
    expect(res.unitConflict?.licensePlate).toBe('LUR234');
    expect(updates[0]).not.toHaveProperty('unit_number');
    expect(updates[0].field_sources).not.toHaveProperty('unitNumber');
  });

  it('⭐ still writes everything else he read', async () => {
    const res = await save([OTHER, car({ id: 'me', owningArea: null })])('me', {
      ...FULL, unitNumber: '5422027', owningArea: '8199',
    });
    expect(res.unitConflict).toBeTruthy();
    expect(updates[0]).toMatchObject({ owning_area: '8199' });
  });

  it('does not trip on a unit number the record already has', async () => {
    // The guard exists for a CHANGE. Firing it on an unchanged value would block the audit of any
    // car that is already half of a pre-existing duplicate.
    const twin = car({ id: 'other', licensePlate: 'LUR234', unitNumber: '5420427' });
    const res = await save([twin, car({ id: 'me' })])('me', FULL);
    expect(res.unitConflict).toBeUndefined();
    expect((updates[0].field_sources as Record<string, string>).unitNumber).toBe('manual');
  });

  it('throws rather than guessing when the vehicle is not in the fleet', async () => {
    await expect(save([])('ghost', FULL)).rejects.toThrow('Vehicle not found');
  });
});

describe('flagKeytag', () => {
  it('⭐ stamps the car unreadable — this IS the retake watchlist', async () => {
    const flag = makeFlagKeytag({ setAllVehicles: setAll, userId: 'aaron' });
    await flag('me');
    expect(updates[0]).toMatchObject({ keytag_audit_result: 'unreadable', keytag_audited_by: 'aaron' });
  });

  // ⭐ The default is load-bearing: every existing caller passes one argument, and a generalisation
  // that silently changed what those calls write would be a migration disguised as a refactor.
  it('⭐ defaults to unreadable when no outcome is named', async () => {
    const flag = makeFlagKeytag({ setAllVehicles: setAll, userId: 'aaron' });
    await flag('me');
    expect(updates[0]).toMatchObject({ keytag_audit_result: 'unreadable' });
  });

  it('⭐ stamps check-vehicle when the TAG is what has no answer on it', async () => {
    const flag = makeFlagKeytag({ setAllVehicles: setAll, userId: 'aaron' });
    await flag('me', 'check-vehicle');
    expect(updates[0]).toMatchObject({ keytag_audit_result: 'check-vehicle', keytag_audited_by: 'aaron' });
  });

  it('⚠️ writes no identity field under EITHER flag — he did not read them', async () => {
    const flag = makeFlagKeytag({ setAllVehicles: setAll, userId: 'aaron' });
    await flag('me');
    await flag('me', 'check-vehicle');
    for (const col of ['owning_area', 'rental_class', 'class_code', 'unit_number', 'vin_last9', 'field_sources']) {
      expect(updates[0], `unreadable must not write ${col}`).not.toHaveProperty(col);
      expect(updates[1], `check-vehicle must not write ${col}`).not.toHaveProperty(col);
    }
  });
});

describe('reopenKeytagAudit — the auditor\'s undo', () => {
  // ⭐ WHY IT EXISTS: an audited car leaves the queue permanently, so the first wrong entry could
  // only be corrected with hand-written SQL. A surface that writes at the TOP of the provenance
  // ladder needs a way back, or every one of its mistakes is permanent.
  const reopen = () => makeReopenKeytagAudit({ setAllVehicles: setAll });

  it('clears the audit stamp so the car re-enters the queue', async () => {
    await reopen()('me');
    expect(updates[0]).toEqual({ keytag_audited_at: null, keytag_audited_by: null, keytag_audit_result: null });
  });

  it('⚠️ leaves the manual locks alone — reopening is not un-confirming', async () => {
    // Dropping them would let the next scan overwrite good values in the window before he gets
    // back to the car.
    await reopen()('me');
    expect(updates[0]).not.toHaveProperty('field_sources');
  });

  it('clears an unreadable flag too — a car off the retake list goes back in line', async () => {
    await reopen()('me');
    expect(updates[0].keytag_audit_result).toBeNull();
  });
});

describe('saveKeytagAudit — the owning area is normalised on the way in', () => {
  // Aaron: "the leading zero i usually would drop anyway, as some older owning ones have 08890,
  // 08999, 08898. that handwritten seltos has 08197 but its still just 8197 so 4."
  //
  // ⚠️ `normalizeOwning` has always known this, and until now NO WRITER CALLED IT — it was wired
  // into the scan read alone, so a hand-typed owning went to the database exactly as printed. That
  // is how SPHV03 came to hold `02294` for a branch that is 2294.
  it('⭐ drops a printed leading zero — 08191 IS 8191', async () => {
    await save([car({ id: 'me', owningArea: null })])('me', { ...FULL, owningArea: '08191' });
    expect(updates[0]).toMatchObject({ owning_area: '8191' });
  });

  it('treats a printed 08199 as a CONFIRMATION of a stored 8199, not a change', async () => {
    await save([car({ id: 'me', owningArea: '8199' })])('me', { ...FULL, owningArea: '08199' });
    expect(updates[0]).not.toHaveProperty('owning_area');
    expect((updates[0].field_sources as Record<string, string>).owningArea).toBe('manual');
  });

  it('⭐ keeps a genuine five-digit branch that does not start with a zero', async () => {
    // His own caveat: overseas numbering may legitimately run to five digits. Only LEADING zeros
    // are stripped, so such a number survives intact.
    await save([car({ id: 'me', owningArea: null })])('me', { ...FULL, owningArea: '12294' });
    expect(updates[0]).toMatchObject({ owning_area: '12294' });
  });

  it('refuses a stub too short to be a branch rather than storing a fragment', async () => {
    await save([car({ id: 'me', owningArea: null })])('me', { ...FULL, owningArea: '081' });
    expect(updates[0]).not.toHaveProperty('owning_area');
  });
});

describe('saveKeytagAudit — a tag that spells the model out (the labelled layout)', () => {
  // docs ticket-two-tag-formats: the US / old-Montreal tag prints `TUCSON` where the Canadian tag
  // prints a model CODE. The auditor had nowhere to put a name, so it landed in `class_code`.
  const SPELLED = { owningArea: '1198', rentalClass: 'Q4', unitNumber: '5420427', vinLast9: 'ABC123456', modelSpelledOut: true };

  it('⭐ writes the model and leaves class_code neither written NOR stamped', async () => {
    await save([car({ id: 'me', model: '', classCode: undefined })])('me', { ...SPELLED, classCode: 'TUCSON', model: 'TUCSON' });
    expect(updates[0]).toMatchObject({ model: 'Tucson' }); // the codex knows the spelling
    expect(updates[0]).not.toHaveProperty('class_code');
    expect(updates[0].field_sources).not.toHaveProperty('classCode');
    expect((updates[0].field_sources as Record<string, string>).model).toBe('manual');
  });

  it('⭐ OVERWRITES the model FG holds — a person holding the tag outranks an earlier guess', async () => {
    await save([car({ id: 'me', make: 'Hyundai', model: 'Elantra' })])('me', { ...SPELLED, model: 'Tucson' });
    expect(updates[0]).toMatchObject({ model: 'Tucson' });
  });

  it('adopts FG\'s spelling and fills a BLANK make, stamped derived', async () => {
    const fleet = [car({ id: 'me', make: '', model: '' }), car({ id: 'sib', make: 'Hyundai', model: 'Tucson', unitNumber: '5429999' })];
    await save(fleet)('me', { ...SPELLED, model: 'TUCSON' });
    expect(updates[0]).toMatchObject({ model: 'Tucson', make: 'Hyundai' });
    expect((updates[0].field_sources as Record<string, string>).make).toBe('derived');
  });

  it('⚠️ never replaces a make that is already on the record', async () => {
    await save([car({ id: 'me', make: 'Jeep', model: '' })])('me', { ...SPELLED, model: 'Tucson' });
    expect(updates[0]).not.toHaveProperty('make');
  });

  it('a confirmed spelling that already matches writes no column but still stamps it', async () => {
    await save([car({ id: 'me', make: 'Hyundai', model: 'Tucson' })])('me', { ...SPELLED, model: 'TUCSON' });
    expect(updates[0]).not.toHaveProperty('model');
    expect((updates[0].field_sources as Record<string, string>).model).toBe('manual');
  });

  it('⚠️ ignores a model when the switch is OFF — the code box meant a code', async () => {
    await save([car({ id: 'me' })])('me', { ...FULL, model: 'Tucson' });
    expect(updates[0]).not.toHaveProperty('model');
    expect(updates[0].field_sources).not.toHaveProperty('model');
  });

  it('a blank spelled-out model is not a claim', async () => {
    await save([car({ id: 'me' })])('me', { ...SPELLED, model: '  ' });
    expect(updates[0]).not.toHaveProperty('model');
    expect(updates[0].field_sources).not.toHaveProperty('model');
  });
});
