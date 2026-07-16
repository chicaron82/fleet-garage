import { describe, it, expect } from 'vitest';
import { scanRouterActions } from '../../src/lib/scanRouterActions';
import { resolveKeytagScan } from '../../src/lib/resolveKeytagScan';
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
const kinds = (read: KeytagRead, fleet: Vehicle[] = FLEET) =>
  scanRouterActions(read, resolveKeytagScan(read, fleet)).map(a => a.kind);

describe('scanRouterActions', () => {
  it('on-record vehicle → view / flag / lnf / trip, all routed to the right screen', () => {
    const read: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    const actions = scanRouterActions(read, resolveKeytagScan(read, FLEET));
    expect(actions.map(a => a.kind)).toEqual(['view', 'flag', 'lnf', 'trip']);
    expect(actions.find(a => a.kind === 'view')!.screen).toEqual({ name: 'vehicle', vehicleId: 'v-1' });
    expect(actions.find(a => a.kind === 'flag')!.screen).toEqual({ name: 'new-hold', vehicleId: 'v-1' });
    expect(actions.find(a => a.kind === 'lnf')!.screen).toEqual({ name: 'lost-and-found', prefillPlate: 'LUR554' });
    expect(actions.find(a => a.kind === 'trip')!.screen).toEqual({ name: 'movement-log', prefillPlate: 'LUR554' });
  });

  it('NEVER offers register for an on-record car', () => {
    const read: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    expect(kinds(read)).not.toContain('register');
  });

  it('new + readable → register / register-and-flag / lnf (register prefilled with the plate)', () => {
    const read: KeytagRead = { plate: 'LUR315', unitNumber: '5424315', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' };
    const actions = scanRouterActions(read, resolveKeytagScan(read, FLEET));
    expect(actions.map(a => a.kind)).toEqual(['register', 'register-and-flag', 'lnf']);
    expect(actions.find(a => a.kind === 'register')!.screen).toEqual({ name: 'register-vehicle', prefill: 'LUR315' });
    expect(actions.find(a => a.kind === 'register-and-flag')!.screen).toEqual({ name: 'register-vehicle', fromHold: true, prefill: 'LUR315' });
  });

  it('new but too partial to register → Lost & Found only (never a broken register route)', () => {
    const read: KeytagRead = { plate: 'LUR777', unitNumber: '5424777' }; // no make/model
    expect(kinds(read)).toEqual(['lnf']);
  });

  it('never offers a vehicle action (view/flag/trip) for a car FG does not know', () => {
    const read: KeytagRead = { plate: 'LUR315', unitNumber: '5424315', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' };
    const k = kinds(read);
    expect(k).not.toContain('view');
    expect(k).not.toContain('flag');
    expect(k).not.toContain('trip');
  });

  it('unreadable tag (no plate) → no actions', () => {
    const read: KeytagRead = { make: 'Kia', model: 'Seltos' };
    expect(scanRouterActions(read, resolveKeytagScan(read, FLEET))).toEqual([]);
  });

  it('lost & found is always offered (found an item in any car)', () => {
    const onRecord: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    const brandNew: KeytagRead = { plate: 'LUR315', unitNumber: '5424315', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' };
    const tooThin: KeytagRead = { plate: 'LUR777' };
    expect(kinds(onRecord)).toContain('lnf');
    expect(kinds(brandNew)).toContain('lnf');
    expect(kinds(tooThin)).toContain('lnf');
  });
});
