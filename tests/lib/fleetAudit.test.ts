import { describe, it, expect } from 'vitest';
import { auditFleet, auditSummary, confusableKey, normalizePlate, unitOneApart, type AuditVehicle } from '../../src/lib/fleetAudit';

const v = (o: Partial<AuditVehicle> & { id: string }): AuditVehicle => ({
  unitNumber: null, licensePlate: '', make: 'Nissan', model: 'Rogue', year: 2025, color: 'White', ...o,
});

// The two real duplicates Aaron found on 2026-08-19, reproduced exactly.
const rogueGood = v({ id: 'r1', unitNumber: '5421656', licensePlate: 'LUR143' });
const rogueBad  = v({ id: 'r2', unitNumber: '5421656', licensePlate: 'LURL43' });
const kiaGood   = v({ id: 'k1', unitNumber: '5738117', licensePlate: '0EJ761', make: 'Kia', model: 'K4', color: 'Black' });
const kiaBad    = v({ id: 'k2', unitNumber: '5738117', licensePlate: 'OEJ761', make: 'Kia', model: 'K4', color: 'Black' });

describe('confusableKey', () => {
  it('⭐ collapses the exact two swaps that created real duplicates', () => {
    expect(confusableKey('LURL43')).toBe(confusableKey('LUR143'));   // L ↔ 1
    expect(confusableKey('OEJ761')).toBe(confusableKey('0EJ761'));   // O ↔ 0
  });
  it('does not collapse plates that genuinely differ', () => {
    expect(confusableKey('LZM516')).not.toBe(confusableKey('LZM539'));
  });
  it('normalizes spacing and case before anything else', () => {
    expect(normalizePlate(' lur 143 ')).toBe('LUR143');
  });
});

describe('auditFleet', () => {
  it('⭐ finds a unit number carried by two live records', () => {
    const [f] = auditFleet([rogueGood, rogueBad]);
    expect(f.kind).toBe('duplicate-unit');
    expect(f.key).toBe('duplicate-unit:5421656');
    expect(f.title).toContain('5421656');
    expect(f.detail).toMatch(/one car entered twice/);
    expect(f.vehicles.map(x => x.id).sort()).toEqual(['r1', 'r2']);
  });

  it('⭐ says so when the two records describe DIFFERENT vehicles', () => {
    // Unit 5427497 in the live fleet: a Green Prius and a Gray Prius. That is not a misread, and
    // calling it one would send him merging two real cars.
    const a = v({ id: 'p1', unitNumber: '5427497', licensePlate: 'LZM516', make: 'Toyota', model: 'Prius', color: 'Green', year: 2026 });
    const b = v({ id: 'p2', unitNumber: '5427497', licensePlate: 'LZM539', make: 'Toyota', model: 'Prius', color: 'Gray',  year: 2026 });
    const [f] = auditFleet([a, b]);
    expect(f.detail).toMatch(/wrong unit number/);
  });

  it('⭐ colour is what separates a duplicate from two identical cars', () => {
    // A fleet this size holds dozens of identical 2025 Rogues, so year+make+model proves almost
    // nothing on its own. Same spec, different colour → do NOT call it one car.
    const a = v({ id: 'a', unitNumber: '5421700', licensePlate: 'LUR700', color: 'White' });
    const b = v({ id: 'b', unitNumber: '5421700', licensePlate: 'LUR701', color: 'Black' });
    expect(auditFleet([a, b])[0].detail).toMatch(/wrong unit number/);
  });

  it('finds two records sharing one plate', () => {
    const a = v({ id: 'a', licensePlate: 'LUR500' });
    const b = v({ id: 'b', licensePlate: 'lur 500' });
    const [f] = auditFleet([a, b]);
    expect(f.kind).toBe('duplicate-plate');
  });

  it('⭐ catches the one-character misread even when the unit numbers differ', () => {
    // The case that matters most: this is what a fresh misread looks like BEFORE anyone notices,
    // and it is the check that would have flagged both duplicates on the day they were created.
    const a = v({ id: 'a', unitNumber: '5421656', licensePlate: 'LUR143' });
    const b = v({ id: 'b', unitNumber: '5421999', licensePlate: 'LURL43' });
    const [f] = auditFleet([a, b]);
    expect(f.kind).toBe('confusable-plate');
    expect(f.key).toBe('confusable-plate:LUR143|LURL43');
    expect(f.detail).toMatch(/read wrong/);
  });

  it('does not report the same pair twice under two kinds', () => {
    // Both real duplicates collide on unit AND on a confusable plate. The stronger finding wins;
    // a list that says the same thing twice trains him to skim it.
    const findings = auditFleet([rogueGood, rogueBad, kiaGood, kiaBad]);
    expect(findings).toHaveLength(2);
    expect(findings.every(f => f.kind === 'duplicate-unit')).toBe(true);
  });

  it('⭐ a dismissed finding stays gone', () => {
    const findings = auditFleet([rogueGood, rogueBad], ['duplicate-unit:5421656']);
    expect(findings).toEqual([]);
  });

  it('a blank identifier is a gap, not a collision', () => {
    // Half the fleet has no unit number recorded. Grouping on empty strings would report the whole
    // lot as one giant duplicate — the fastest possible way to make the feature useless.
    const a = v({ id: 'a', unitNumber: '', licensePlate: 'LUR001' });
    const b = v({ id: 'b', unitNumber: null, licensePlate: 'LUR002' });
    expect(auditFleet([a, b])).toEqual([]);
  });

  it('a clean fleet reports nothing at all', () => {
    expect(auditFleet([rogueGood, kiaGood])).toEqual([]);
  });
});

describe('auditSummary', () => {
  it('reads like a goal state when empty, and counts when not', () => {
    expect(auditSummary([])).toBe('Nothing needs a look');
    expect(auditSummary(auditFleet([rogueGood, rogueBad]))).toBe('1 record needs a look');
    expect(auditSummary(auditFleet([rogueGood, rogueBad, kiaGood, kiaBad]))).toBe('2 records need a look');
  });
});

describe('a Tesla whose key count is not one', () => {
  const tesla = (o: Partial<AuditVehicle> & { id: string }): AuditVehicle =>
    v({ isTesla: true, make: 'Tesla', model: 'Model 3', year: 2022, color: 'Red', ...o });

  it('⭐ flags a Tesla recorded with more than one card', () => {
    const [f] = auditFleet([tesla({ id: 't1', licensePlate: '0GE608', keyCount: 2 })]);
    expect(f.kind).toBe('tesla-key-count');
    expect(f.detail).toMatch(/exactly one keycard/);
  });

  it('⭐ a Tesla short of its card reads as GROUNDED, not as a miscount', () => {
    const [f] = auditFleet([tesla({ id: 't2', licensePlate: '0GE608', keyCount: 0 })]);
    expect(f.detail).toMatch(/grounded/i);
  });

  it('says nothing about a correct Tesla, or one never counted', () => {
    // Never-counted is a GAP (the fleet-health chips own that), not a contradiction. Reporting it
    // here would put every unscanned Tesla in an alarm list and teach him to close the alarm list.
    expect(auditFleet([tesla({ id: 't3', licensePlate: '0GE608', keyCount: 1 })])).toEqual([]);
    expect(auditFleet([tesla({ id: 't4', licensePlate: '0GE608', keyCount: null })])).toEqual([]);
  });

  it('leaves non-Teslas alone — four keys on a Carnival is normal', () => {
    expect(auditFleet([v({ id: 'c1', licensePlate: 'LUR900', keyCount: 4 })])).toEqual([]);
  });
});


// ── 5. Plate ↔ owning cross-check (docs/ticket-plate-province-crosscheck.md) ────────────────────
// The check that needs only ONE row. The confusable-plate check compares two records, so a lone
// disagreement — a car with no twin — was invisible to it forever. 0ES919 was exactly that.

describe('auditFleet — a plate that disagrees with its owning branch', () => {
  const car = (over: Partial<AuditVehicle> & { id: string; licensePlate: string }): AuditVehicle => ({
    unitNumber: over.id, make: 'Ford', model: 'Escape', year: 2025, color: 'Blue', ...over,
  });

  it('⭐ flags the real case: an Alberta-shaped plate owned by Winnipeg', () => {
    const f = auditFleet([car({ id: 'v1', licensePlate: '0ES919', owningArea: '8199' })], []);
    const hit = f.find(x => x.kind === 'plate-owning')!;
    expect(hit).toBeTruthy();
    expect(hit.title).toContain('0ES919');
    expect(hit.title).toContain('Winnipeg (8199)');
    expect(hit.detail).toContain('AAA999');
    expect(hit.detail).toContain('9AA999');
  });

  it('⭐⭐ NEVER suggests which side is wrong', () => {
    // The rule Aaron's key tag bought: the owning code was the bad half, not the plate, and a
    // suggested "correction" would have overwritten a plate that was right all along.
    const f = auditFleet([car({ id: 'v1', licensePlate: '0ES919', owningArea: '8199' })], []);
    const hit = f.find(x => x.kind === 'plate-owning')!;
    expect(hit.detail).toMatch(/only the key tag can say which/);
    expect(hit.detail).not.toMatch(/OES919|should be|likely|probably|try /i);
  });

  it('says nothing when the plate agrees with its branch', () => {
    const f = auditFleet([
      car({ id: 'v1', licensePlate: 'LZM516', owningArea: '8199' }),   // MB shape, MB branch
      car({ id: 'v2', licensePlate: '0ES919', owningArea: '8193' }),   // AB shape, AB branch
    ], []);
    expect(f.filter(x => x.kind === 'plate-owning')).toHaveLength(0);
  });

  it('⭐ stays silent on a genuinely re-plated car — two or more characters off', () => {
    // The four live cases: long-stay Teslas re-plated where they sit. Flag these and the board
    // fills with permanent noise, and a list you cannot clear is a list you stop reading.
    const f = auditFleet([car({ id: 'v1', licensePlate: 'LUR143', owningArea: '8191' })], []);  // MB plate, BC branch
    expect(f.filter(x => x.kind === 'plate-owning')).toHaveLength(0);
  });

  it('ignores a plate of a different length entirely', () => {
    // A misread swaps a character; it does not add or drop one. Different length = different format.
    const f = auditFleet([car({ id: 'v1', licensePlate: 'ABCD123', owningArea: '8199' })], []);
    expect(f.filter(x => x.kind === 'plate-owning')).toHaveLength(0);
  });

  it('says nothing when the owning branch is absent or unknown', () => {
    // Most of the fleet predates the capture. Absent is never a finding.
    const f = auditFleet([
      car({ id: 'v1', licensePlate: '0ES919' }),
      car({ id: 'v2', licensePlate: '0ES919', owningArea: '9999' }),
    ], []);
    expect(f.filter(x => x.kind === 'plate-owning')).toHaveLength(0);
  });

  it('⭐ says nothing for 8890, whose own fleet disagrees about its format', () => {
    // A branch that cannot vouch for a shape must not be used to judge one — inventing a format
    // for it would flag four correct cars.
    const f = auditFleet([car({ id: 'v1', licensePlate: 'LUR143', owningArea: '8890' })], []);
    expect(f.filter(x => x.kind === 'plate-owning')).toHaveLength(0);
  });

  it('keys on the plate so a dismissal survives a re-registration', () => {
    const f = auditFleet([car({ id: 'v1', licensePlate: '0ES919', owningArea: '8199' })], []);
    expect(f.find(x => x.kind === 'plate-owning')!.key).toBe('plate-owning:0ES919');
    const dismissed = auditFleet([car({ id: 'v-NEW-ROW', licensePlate: '0ES919', owningArea: '8199' })],
                                 ['plate-owning:0ES919']);
    expect(dismissed.filter(x => x.kind === 'plate-owning')).toHaveLength(0);
  });

  it('defers to a duplicate finding rather than piling on', () => {
    // Two rows for one car is the bigger story; this check must not add a second line about it.
    const f = auditFleet([
      car({ id: 'v1', unitNumber: '5774567', licensePlate: '0ES919', owningArea: '8199' }),
      car({ id: 'v2', unitNumber: '5774567', licensePlate: '0ES919', owningArea: '8199' }),
    ], []);
    expect(f.filter(x => x.kind === 'plate-owning')).toHaveLength(0);
    expect(f.some(x => x.kind === 'duplicate-unit')).toBe(true);
  });
});

// ── check 4: two unit numbers one character apart, on the same model ─────────────────────────────
// The two duplicates found 2026-09-12. Both were invisible to checks 1 and 3: the units differ by
// one digit (so no exact collision) and the plates differ by TWO characters (so no confusable key).
const jettaGood = v({ id: 'j1', unitNumber: '5423082', licensePlate: 'LZM527', make: 'Volkswagen', model: 'Jetta', year: 2026, color: 'Blue' });
const jettaBad  = v({ id: 'j2', unitNumber: '5429082', licensePlate: 'LMS527', make: 'Volkswagen', model: 'Jetta', year: 2026, color: 'Blue' });
const fordGood  = v({ id: 'f1', unitNumber: '5425814', licensePlate: 'LFJ213', make: 'Ford', model: 'F-150', year: 2024, color: 'Gray' });
const fordBad   = v({ id: 'f2', unitNumber: '5424814', licensePlate: 'LPU213', make: 'Ford', model: 'F-150', year: 2024, color: 'Gray' });

describe('unitOneApart', () => {
  it('⭐ catches the real misreads, which are digit-for-digit', () => {
    expect(unitOneApart('5423082', '5429082')).toBe(true);   // 3 → 9
    expect(unitOneApart('5425814', '5424814')).toBe(true);   // 5 → 4
  });
  it('rejects two characters apart — that is two cars, or a read too broken to guess at', () => {
    expect(unitOneApart('5423082', '5429182')).toBe(false);
  });
  it('rejects identical and different-length units', () => {
    expect(unitOneApart('5423082', '5423082')).toBe(false);  // exact collision is check 1's job
    expect(unitOneApart('5423082', '542308')).toBe(false);
  });
  it('⚠️ would MISS these if it collapsed confusables instead of comparing positions', () => {
    // The whole reason this is not built on confusableKey: 3/9, 5/4 and 3/2 are not confusable
    // shapes, so a shape key maps both members of each pair to themselves and never groups them.
    expect(confusableKey('5423082')).not.toBe(confusableKey('5429082'));
    expect(unitOneApart('5423082', '5429082')).toBe(true);
  });
});

describe('auditFleet — confusable units', () => {
  it('⭐ finds the Jetta pair that checks 1 and 3 both walked past', () => {
    const findings = auditFleet([jettaGood, jettaBad]);
    expect(findings.map(f => f.kind)).toEqual(['confusable-unit']);
    const [f] = findings;
    expect(f.key).toBe('confusable-unit:5423082|5429082');
    expect(f.title).toContain('5423082');
    expect(f.title).toContain('5429082');
    expect(f.detail).toMatch(/very likely read wrong/);
    expect(f.vehicles.map(x => x.id).sort()).toEqual(['j1', 'j2']);
  });

  it('⭐ finds the F-150 pair too', () => {
    const [f] = auditFleet([fordGood, fordBad]);
    expect(f.kind).toBe('confusable-unit');
    expect(f.vehicles.map(x => x.id).sort()).toEqual(['f1', 'f2']);
  });

  it('⭐ does NOT fire across different models, which is the gate that makes it usable', () => {
    // Live pair on 2026-09-12: unit 5424874 (Nissan Versa) and 5424814 (Ford F-150) are one digit
    // apart and are obviously two different cars. Eight such pairs exist in the fleet; the make and
    // model gate takes all eight to zero.
    const versa = v({ id: 'x1', unitNumber: '5424874', licensePlate: 'LUR900', make: 'Nissan', model: 'Versa', year: 2025, color: 'White' });
    expect(auditFleet([versa, fordGood]).filter(f => f.kind === 'confusable-unit')).toHaveLength(0);
  });

  it('softens the message when year or colour disagree, instead of staying silent', () => {
    // Gate on make+model (measured), hedge on year/colour (uncertain) — never drop the finding,
    // because a read wrong in two fields is exactly the case being hunted.
    const olderFord = v({ id: 'f3', unitNumber: '5424814', licensePlate: 'LPU213', make: 'Ford', model: 'F-150', year: 2023, color: 'Black' });
    const [f] = auditFleet([fordGood, olderFord]);
    expect(f.kind).toBe('confusable-unit');
    expect(f.detail).toMatch(/worth confirming against the key tags/);
  });

  it('leaves an exact unit collision to check 1 rather than reporting it twice', () => {
    const kinds = auditFleet([rogueGood, rogueBad]).map(f => f.kind);
    expect(kinds).toContain('duplicate-unit');
    expect(kinds).not.toContain('confusable-unit');
  });

  it('a blank unit number is a gap, not a near-collision', () => {
    const blank = v({ id: 'b1', unitNumber: null, licensePlate: 'LUR901', make: 'Ford', model: 'F-150', year: 2024, color: 'Gray' });
    expect(auditFleet([fordGood, blank]).filter(f => f.kind === 'confusable-unit')).toHaveLength(0);
  });

  it('a dismissal sticks, because the key is derived from the units not the row ids', () => {
    expect(auditFleet([jettaGood, jettaBad], ['confusable-unit:5423082|5429082'])).toHaveLength(0);
  });
});
