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
  scanRouterActions(read, resolveKeytagScan(read, fleet), 1).map(a => a.kind);

describe('scanRouterActions', () => {
  it('on-record vehicle → view / flag / lnf / trip, all routed to the right screen', () => {
    const read: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    const actions = scanRouterActions(read, resolveKeytagScan(read, FLEET), 1);
    expect(actions.map(a => a.kind)).toEqual(['view', 'flag', 'lnf', 'trip']);
    expect(actions.find(a => a.kind === 'view')!.screen).toEqual({ name: 'vehicle', vehicleId: 'v-1' });
    expect(actions.find(a => a.kind === 'flag')!.screen).toEqual({ name: 'new-hold', vehicleId: 'v-1', prefillNonce: 1 });
    expect(actions.find(a => a.kind === 'lnf')!.screen).toEqual({ name: 'lost-and-found', prefillPlate: 'LUR554', prefillNonce: 1 });
    expect(actions.find(a => a.kind === 'trip')!.screen).toEqual({ name: 'movement-log', prefillPlate: 'LUR554', prefillNonce: 1, autoStart: true });
  });

  it('stamps the scan nonce onto the plate-prefill routes so a repeat scan re-fills', () => {
    const read: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    const first  = scanRouterActions(read, resolveKeytagScan(read, FLEET), 7);
    const second = scanRouterActions(read, resolveKeytagScan(read, FLEET), 8);
    const nonceOf = (as: typeof first, kind: string) =>
      (as.find(a => a.kind === kind)!.screen as { prefillNonce?: number }).prefillNonce;
    // Same tag, two scans → different nonce on EVERY prefill route. `flag` joined trip+lnf on
    // 2026-07-22: new-hold re-seeds from a value, so without a per-scan nonce a repeat scan of the
    // same car no-opped after `clearVehicle` and the form sat empty (caught by the line-check).
    expect(nonceOf(first, 'trip')).toBe(7);
    expect(nonceOf(second, 'trip')).toBe(8);
    expect(nonceOf(first, 'lnf')).toBe(7);
    expect(nonceOf(second, 'lnf')).toBe(8);
    expect(nonceOf(first, 'flag')).toBe(7);
    expect(nonceOf(second, 'flag')).toBe(8);
  });

  it('NEVER offers register for an on-record car', () => {
    const read: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
    expect(kinds(read)).not.toContain('register');
  });

  it('new + readable → register / register-and-flag / lnf, carrying the WHOLE read', () => {
    // The bug this pins (found live 2026-07-17): passing only `prefill` made the operator retype
    // make/model/unit/year that FG had just read off the tag in his hand. If the tag was readable
    // enough to offer Register at all, every field it read must travel to the form.
    const read: KeytagRead = { plate: 'LUR315', unitNumber: '5424315', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' };
    const scanned = { unitNumber: '5424315', plate: 'LUR315', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White', rentalClass: '', isHybrid: false };
    const actions = scanRouterActions(read, resolveKeytagScan(read, FLEET), 1);
    expect(actions.map(a => a.kind)).toEqual(['register', 'register-and-flag', 'lnf']);
    expect(actions.find(a => a.kind === 'register')!.screen).toEqual({ name: 'register-vehicle', prefill: 'LUR315', scanned });
    expect(actions.find(a => a.kind === 'register-and-flag')!.screen).toEqual({ name: 'register-vehicle', fromHold: true, prefill: 'LUR315', scanned });
  });

  it('the scanned identity is never partial when Register is offered (no half-filled form)', () => {
    const read: KeytagRead = { plate: 'LUR315', unitNumber: '5424315', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White' };
    const reg = scanRouterActions(read, resolveKeytagScan(read, FLEET), 1).find(a => a.kind === 'register')!;
    const s = (reg.screen as { scanned?: Record<string, unknown> }).scanned!;
    // Every field the form asks for must have arrived — an empty one is a field the operator retypes.
    for (const key of ['unitNumber', 'plate', 'make', 'model', 'year', 'color']) {
      expect(s[key], `scanned.${key} must travel to the register form`).toBeTruthy();
    }
  });

  // The threshold for "too partial" MOVED on 2026-07-19 (LUR437, class code CDGT not yet in the
  // codex). Previously any missing make/model collapsed the whole registration path and left the
  // operator with Lost & Found on a car he needed to hold. The guard below still stands — never
  // offer a register route that would write an empty record — but plate + unit# is no longer
  // "nothing", it's a real car missing two fields. Degrade the offer; don't delete it.
  it('unknown class code (plate + unit#, no make/model) → still offers register, pre-filled', () => {
    const read: KeytagRead = { plate: 'LUR437', unitNumber: '5429949', classCode: 'CDGT', year: 2026, color: 'Black' };
    const k = kinds(read);
    expect(k).toContain('register');
    expect(k).toContain('lnf');

    const reg = scanRouterActions(read, resolveKeytagScan(read, FLEET), 1).find(a => a.kind === 'register')!;
    // The label has to say what he must add — a silent partial prefill is a trap.
    expect(reg.label).toMatch(/make\/model/i);
    const s = (reg.screen as { scanned?: Record<string, unknown> }).scanned!;
    // Everything the tag DID read must travel; only the unresolved pair is blank.
    expect(s.unitNumber).toBe('5429949');
    expect(s.plate).toBe('LUR437');
    expect(s.year).toBe(2026);
    expect(s.color).toBe('Black');
    expect(s.make).toBe('');
    expect(s.model).toBe('');
  });

  it('genuinely too partial (no unit#) → Lost & Found only (never a broken register route)', () => {
    const read: KeytagRead = { plate: 'LUR777' }; // plate alone is not a car record
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
    expect(scanRouterActions(read, resolveKeytagScan(read, FLEET), 1)).toEqual([]);
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

describe('scanRouterActions — the repair deep-link (held cars)', () => {
  const onRecord: KeytagRead = { plate: 'LUR554', unitNumber: '5423827', make: 'Buick', model: 'Envista', year: 2026, color: 'Gray' };
  const actions = (held: boolean) => scanRouterActions(onRecord, resolveKeytagScan(onRecord, FLEET), 7, held);

  it('offers NO repair route on a clean car', () => {
    expect(actions(false).map(a => a.kind)).not.toContain('repair');
  });

  it('offers it FIRST on a held car — the likely reason he is standing there', () => {
    const a = actions(true);
    expect(a[0].kind).toBe('repair');
    expect(a[0].label).toMatch(/repaired/i);
  });

  it('⭐ ROUTES rather than writing — the thin-hub law stays intact', () => {
    // The overlay must never perform the repair itself; it hands the INTENT to the vehicle
    // module, which owns the action. If this ever becomes a write in the scan card, that law
    // is broken and this test is the place it should fail.
    const repair = actions(true)[0];
    expect(repair.screen).toMatchObject({ name: 'vehicle', vehicleId: expect.any(String), openRepair: true });
  });

  it('stamps the nonce so a REPEAT scan of the same tag re-opens the action', () => {
    // Same trap as the prefill nonces: without it the destination sees an unchanged value and
    // silently no-ops on the second scan.
    const first = scanRouterActions(onRecord, resolveKeytagScan(onRecord, FLEET), 7, true)[0];
    const second = scanRouterActions(onRecord, resolveKeytagScan(onRecord, FLEET), 8, true)[0];
    expect(first.screen).toMatchObject({ openRepairNonce: 7 });
    expect(second.screen).toMatchObject({ openRepairNonce: 8 });
  });

  it('still offers view / flag / trip alongside it', () => {
    const k = actions(true).map(a => a.kind);
    expect(k).toEqual(expect.arrayContaining(['repair', 'view', 'flag', 'lnf', 'trip']));
  });
});
