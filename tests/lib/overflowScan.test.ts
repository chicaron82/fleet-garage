import { describe, it, expect } from 'vitest';
import { planOverflowScan } from '../../src/lib/overflowScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../../src/types';

function vehicle(over: Partial<Vehicle>): Vehicle {
  return {
    id: 'v-1', unitNumber: '5423827', licensePlate: 'LUR554',
    make: 'Buick', model: 'Envista', year: 2026, color: 'Gray',
    status: 'CLEAR', branchId: 'YWG', isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
    ...over,
  };
}

const FLEET = [vehicle({ id: 'v-1', licensePlate: 'LUR554' })];

describe('planOverflowScan', () => {
  it('new + full read → register the car, send against it', () => {
    const read: KeytagRead = { plate: 'LUR315', unitNumber: '5424315', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' };
    const r = planOverflowScan(read, FLEET);
    expect(r?.register).toEqual({ unitNumber: '5424315', plate: 'LUR315', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' });
    expect(r?.backfill).toBeNull();
    expect(r?.unregistered).toBe(false);
    expect(r?.send).toEqual({ plate: 'LUR315', unit: '5424315', label: 'Unit 5424315' });
  });

  it('new but too partial to register → send as an ORPHAN (unregistered), still logged', () => {
    const read: KeytagRead = { plate: 'LUR777', unitNumber: '5424777' }; // no make/model
    const r = planOverflowScan(read, FLEET);
    expect(r?.register).toBeNull();
    expect(r?.unregistered).toBe(true);
    expect(r?.send).toEqual({ plate: 'LUR777', unit: '5424777', label: 'Unit 5424777' });
  });

  it('on-record + complete → just send, no fleet write', () => {
    const read: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    const r = planOverflowScan(read, FLEET);
    expect(r?.register).toBeNull();
    expect(r?.backfill).toBeNull();
    expect(r?.unregistered).toBe(false);
    expect(r?.send).toEqual({ plate: 'LUR554', unit: '5423827', label: 'Unit 5423827' });
  });

  it('on-record + partial (blank colour) → backfill, then send', () => {
    const partialFleet = [vehicle({ id: 'v-2', licensePlate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: '' })];
    const read: KeytagRead = { plate: 'LUR200', unitNumber: '5424200', make: 'Kia', model: 'Seltos', year: 2026, color: 'Silver' };
    const r = planOverflowScan(read, partialFleet);
    expect(r?.backfill).toEqual({ vehicleId: 'v-2', applies: [{ field: 'color', value: 'Silver' }] });
    expect(r?.register).toBeNull();
    expect(r?.send).toEqual({ plate: 'LUR200', unit: '5424200', label: 'Unit 5424200' });
  });

  it('unreadable tag (no plate) → null (nothing to log)', () => {
    const read: KeytagRead = { make: 'Kia', model: 'Seltos' };
    expect(planOverflowScan(read, FLEET)).toBeNull();
  });

  it('falls back to the plate as the label when no unit was read', () => {
    const read: KeytagRead = { plate: 'LUR888', make: 'Ford', model: 'Escape', year: 2025, color: 'Blue' };
    const r = planOverflowScan(read, FLEET);
    // no unit → too partial to register, but still loggable as a plate-only orphan send
    expect(r?.send.label).toBe('LUR888');
    expect(r?.unregistered).toBe(true);
  });
});
