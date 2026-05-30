import { describe, it, expect } from 'vitest';
import { buildFleetView, STATUS_ORDER, type FleetVehicleRow, type HoldRow } from '../../src/lib/fleet-master';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function vehicle(over: Partial<FleetVehicleRow> = {}): FleetVehicleRow {
  return {
    id: 'v1',
    unit_number: 'U1',
    license_plate: 'ABC123',
    make: 'Toyota',
    model: 'Corolla',
    year: 2024,
    color: 'White',
    branch_id: 'YWG',
    is_tesla: false,
    has_mobile_cable: null,
    has_j1772_adapter: null,
    ...over,
  };
}

function hold(over: Partial<HoldRow> = {}): HoldRow {
  return {
    id: 'h1',
    vehicle_id: 'v1',
    hold_types: ['mechanical'],
    status: 'ACTIVE',
    created_at: '2026-05-22T09:00:00Z',
    releases: null,
    ...over,
  };
}

const noInventory = new Map<string, string>();

// ── Empty / clear ─────────────────────────────────────────────────────────────

describe('buildFleetView — baseline', () => {
  it('returns [] for no vehicles', () => {
    expect(buildFleetView([], [], noInventory)).toEqual([]);
  });

  it('a vehicle with no holds and no inventory entry is clear', () => {
    const [v] = buildFleetView([vehicle()], [], noInventory);
    expect(v.status).toBe('clear');
    expect(v.holdCount).toBe(0);
    expect(v.holdSummary).toEqual([]);
    expect(v.holdId).toBeUndefined();
  });

  it('maps row fields onto the view shape', () => {
    const [v] = buildFleetView([vehicle({ unit_number: null, branch_id: null })], [], noInventory);
    expect(v.unitNumber).toBeNull();
    expect(v.licensePlate).toBe('ABC123');
    expect(v.branchId).toBe('YWG'); // null branch_id defaults to YWG
  });
});

// ── Status cascade ────────────────────────────────────────────────────────────

describe('buildFleetView — status cascade', () => {
  it('regular ACTIVE hold → held, with deduped type labels', () => {
    const holds = [
      hold({ id: 'a', hold_types: ['mechanical'], created_at: '2026-05-22T08:00:00Z' }),
      hold({ id: 'b', hold_types: ['mechanical', 'cosmetic'], created_at: '2026-05-22T09:00:00Z' }),
    ];
    const [v] = buildFleetView([vehicle()], holds, noInventory);
    expect(v.status).toBe('held');
    expect(v.holdId).toBe('a');                       // earliest created_at
    expect(v.holdCount).toBe(2);
    expect(v.holdSummary).toEqual(['Mechanical', 'Cosmetic']); // deduped, title-cased
    expect(v.holdType).toBe('Mechanical');
  });

  it('ACTIVE sale_car (no regular hold) → sale-car', () => {
    const [v] = buildFleetView([vehicle()], [hold({ hold_types: ['sale_car'] })], noInventory);
    expect(v.status).toBe('sale-car');
    expect(v.holdSummary).toEqual(['Sale Car']);
  });

  it('regular hold beats sale_car when both are active', () => {
    const holds = [hold({ id: 'r', hold_types: ['mechanical'] }), hold({ id: 's', hold_types: ['sale_car'] })];
    const [v] = buildFleetView([vehicle()], holds, noInventory);
    expect(v.status).toBe('held');
  });

  it('only pre-existing ACTIVE holds → pre-existing', () => {
    const [v] = buildFleetView([vehicle()], [hold({ hold_types: ['pre-existing'] })], noInventory);
    expect(v.status).toBe('pre-existing');
    expect(v.holdSummary).toEqual(['Pre-existing']);
  });

  it('released sale_car on open exception → auction-short-term', () => {
    const h = hold({
      hold_types: ['sale_car'],
      status: 'RELEASED',
      releases: [{ release_type: 'EXCEPTION', actual_return: null }],
    });
    const [v] = buildFleetView([vehicle()], [h], noInventory);
    expect(v.status).toBe('auction-short-term');
    expect(v.holdSummary).toEqual(['Auction']);
  });

  it('released hold on open exception (non sale_car) → on-exception', () => {
    const h = hold({
      hold_types: ['mechanical'],
      status: 'RELEASED',
      releases: [{ release_type: 'EXCEPTION', actual_return: null }],
    });
    const [v] = buildFleetView([vehicle()], [h], noInventory);
    expect(v.status).toBe('on-exception');
  });

  it('a returned exception (actual_return set) does not keep the vehicle on-exception', () => {
    const h = hold({
      status: 'RELEASED',
      releases: [{ release_type: 'EXCEPTION', actual_return: '2026-05-22T18:00:00Z' }],
    });
    const [v] = buildFleetView([vehicle()], [h], noInventory);
    expect(v.status).toBe('clear');
  });
});

// ── Inventory fallback (only when otherwise clear) ────────────────────────────

describe('buildFleetView — inventory fallback', () => {
  const inv = (status: string) => new Map([['ABC123', status]]);

  it.each([
    ['B', 'held'],
    ['M', 'held'],
    ['D', 'dirty'],
    ['A', 'available'],
  ])('inventory %s → %s', (code, expected) => {
    const [v] = buildFleetView([vehicle()], [], inv(code));
    expect(v.status).toBe(expected);
  });

  it('matches plate case-insensitively', () => {
    const [v] = buildFleetView([vehicle({ license_plate: 'abc123' })], [], new Map([['ABC123', 'D']]));
    expect(v.status).toBe('dirty');
  });

  it('does not override a real hold status', () => {
    const [v] = buildFleetView([vehicle()], [hold()], inv('A'));
    expect(v.status).toBe('held'); // hold wins; inventory only fills 'clear'
  });
});

// ── Sorting ───────────────────────────────────────────────────────────────────

describe('buildFleetView — sort order', () => {
  it('orders by STATUS_ORDER, then plate within a status', () => {
    const vehicles = [
      vehicle({ id: 'c', license_plate: 'ZZZ999' }),                 // clear
      vehicle({ id: 'a', license_plate: 'BBB222' }),                 // held
      vehicle({ id: 'b', license_plate: 'AAA111' }),                 // held
    ];
    const holds = [
      hold({ id: 'ha', vehicle_id: 'a' }),
      hold({ id: 'hb', vehicle_id: 'b' }),
    ];
    const out = buildFleetView(vehicles, holds, noInventory);
    expect(out.map(v => v.licensePlate)).toEqual(['AAA111', 'BBB222', 'ZZZ999']);
    expect(STATUS_ORDER[out[0].status]).toBeLessThan(STATUS_ORDER[out[2].status]);
  });
});
