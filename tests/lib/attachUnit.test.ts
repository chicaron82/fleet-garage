import { describe, it, expect } from 'vitest';
import { plateOnlyRecord, attachPlan, type AttachForm } from '../../src/lib/attachUnit';
import type { Vehicle } from '../../src/types';

function vehicle(over: Partial<Vehicle>): Vehicle {
  return {
    id: 'v-1', unitNumber: '5423827', licensePlate: 'LUR554',
    make: 'Buick', model: 'Envista', year: 2026, color: 'Gray',
    status: 'CLEAR', branchId: 'YWG', isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
    ...over,
  };
}
// The shape FG keeps for a geotab truck nobody has met: a plate and nothing else.
const plateOnly = vehicle({ id: 'geotab-veh-KGE609', licensePlate: 'KGE609', unitNumber: null, make: '', model: '', year: 0, color: '' });
const form = (over: Partial<AttachForm> = {}): AttachForm => ({
  unit: ' 5428263 ', make: 'Dodge', model: 'Ram 1500', year: 2026, color: 'White',
  rentalClass: '', classCode: '', isHybrid: false, ...over,
});

describe('plateOnlyRecord', () => {
  it('finds the live record that has the plate and no unit', () => {
    expect(plateOnlyRecord('geotab-veh-KGE609', [plateOnly])).toBe(plateOnly);
  });
  it('a record that already has a unit is NOT a target (that is a duplicate, not a blank)', () => {
    expect(plateOnlyRecord('v-1', [vehicle({})])).toBeNull();
  });
  it('an archived record, a missing record, or no id → null', () => {
    expect(plateOnlyRecord('geotab-veh-KGE609', [{ ...plateOnly, archivedAt: '2026-09-01T00:00:00Z' }])).toBeNull();
    expect(plateOnlyRecord('ghost', [plateOnly])).toBeNull();
    expect(plateOnlyRecord(null, [plateOnly])).toBeNull();
  });
});

describe('attachPlan', () => {
  it('blank record + whole form → the unit AND the identity', () => {
    expect(attachPlan(plateOnly, form())).toEqual({
      unit: '5428263',
      identity: { make: 'Dodge', model: 'Ram 1500', year: 2026, color: 'White', rentalClass: null, classCode: null, isHybrid: false },
    });
  });
  it('a half-typed form writes the unit only, never half an identity', () => {
    expect(attachPlan(plateOnly, form({ color: '' }))).toEqual({ unit: '5428263' });
    expect(attachPlan(plateOnly, form({ make: '', model: '' }))).toEqual({ unit: '5428263' });
  });
  it('a record that already says what it is keeps saying it', () => {
    const known = vehicle({ unitNumber: null });
    expect(attachPlan(known, form())).toEqual({ unit: '5428263' });
  });
});
