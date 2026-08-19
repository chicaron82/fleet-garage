import { describe, it, expect } from 'vitest';
import { auditFleet, auditSummary, confusableKey, normalizePlate, type AuditVehicle } from '../../src/lib/fleetAudit';

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
