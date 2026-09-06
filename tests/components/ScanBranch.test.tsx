import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ScanBranch } from '../../src/components/holds/KeytagScan';
import type { KeytagScanResult } from '../../src/lib/resolveKeytagScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../../src/types';

// ⭐ ScanBranch now renders the re-plate offer, which resolves `adoptPlate` from context.
const adoptPlate = vi.fn(async () => true);
// ⭐ The fleet is here because `PlateShapeHint` reads it: a misread plate that resolves to a real
// car under its own branch's shape is named BEFORE the Register button that would duplicate it.
const FLEET = [{ id: 'c1', licensePlate: '0HH120', unitNumber: '5789714', make: 'Kia', model: 'Rio' }];
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ adoptPlate, vehicles: FLEET }),
}));

const FULL_READ: KeytagRead = { plate: 'LZM999', unitNumber: '5423827', make: 'Kia', model: 'Seltos', year: 2026, color: 'Gray' };

function vehicle(over: Partial<Vehicle>): Vehicle {
  return {
    id: 'v-1', unitNumber: '5423827', licensePlate: 'LUR554', make: 'Buick', model: 'Envista',
    year: 2026, color: 'Gray', status: 'CLEAR', branchId: 'YWG', isTesla: false,
    hasMobileCable: null, hasJ1772Adapter: null, ...over,
  };
}

function result(over: Partial<KeytagScanResult>): KeytagScanResult {
  return { rawPlate: 'LZM999', plate: 'LZM999', wasCorrected: false, vehicle: null, matchedByUnit: false, unitCandidates: [], resolution: { kind: 'new' }, ...over };
}

describe('ScanBranch', () => {
  it('new + a complete read → offers to register (and click fires onRegister)', () => {
    const onRegister = vi.fn();
    render(<ScanBranch scan={{ read: FULL_READ, result: result({}) }} staged={false} onRegister={onRegister} onBackfill={vi.fn()} scanNonce={1} />);
    expect(screen.getByText(/not in the fleet/)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Register .*Kia Seltos/ });
    fireEvent.click(btn);
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it('new but an incomplete read → no register button, points to chat', () => {
    const thin: KeytagRead = { plate: 'LZM999' }; // no make/model/unit/year
    render(<ScanBranch scan={{ read: thin, result: result({}) }} staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} scanNonce={1} />);
    expect(screen.queryByRole('button', { name: /Register/ })).not.toBeInTheDocument();
    expect(screen.getByText(/add it via Effie chat/)).toBeInTheDocument();
  });

  it('staged → shows the receipt, not the register button', () => {
    render(<ScanBranch scan={{ read: FULL_READ, result: result({}) }} staged onRegister={vi.fn()} onBackfill={vi.fn()} scanNonce={1} />);
    expect(screen.getByText(/✓ Staged LZM999 to register/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Register/ })).not.toBeInTheDocument();
  });

  it('complete → says it is already in the fleet with the details', () => {
    const v = vehicle({ licensePlate: 'LUR554' });
    render(<ScanBranch scan={{ read: { plate: 'LUR554' }, result: result({ plate: 'LUR554', vehicle: v, resolution: { kind: 'complete' } }) }} staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} scanNonce={1} />);
    expect(screen.getByText(/Already in the fleet/)).toBeInTheDocument();
    expect(screen.getByText(/2026 Buick Envista/)).toBeInTheDocument();
  });

  it('partial → shows the fields the tag adds, and click fires onBackfill', () => {
    const v = vehicle({ licensePlate: 'LUR554', model: '', year: 0 });
    const onBackfill = vi.fn();
    render(<ScanBranch scan={{ read: { plate: 'LUR554', model: 'Envista', year: 2026 }, result: result({ plate: 'LUR554', vehicle: v, resolution: { kind: 'partial', fills: [{ field: 'model', value: 'Envista' }, { field: 'year', value: 2026 }], changes: [], conflicts: [] } }) }} staged={false} onRegister={vi.fn()} onBackfill={onBackfill} scanNonce={1} />);
    expect(screen.getByText(/in the fleet/)).toBeInTheDocument();
    expect(screen.getByText(/The tag adds/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fill in/ }));
    expect(onBackfill).toHaveBeenCalledTimes(1);
  });

  it('partial + staged → shows the receipt, not the fill-in button', () => {
    const v = vehicle({ licensePlate: 'LUR554', model: '', year: 0 });
    render(<ScanBranch scan={{ read: { plate: 'LUR554', model: 'Envista', year: 2026 }, result: result({ plate: 'LUR554', vehicle: v, resolution: { kind: 'partial', fills: [{ field: 'model', value: 'Envista' }], changes: [], conflicts: [] } }) }} staged onRegister={vi.fn()} onBackfill={vi.fn()} scanNonce={1} />);
    expect(screen.getByText(/✓ Staged the backfill/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fill in/ })).not.toBeInTheDocument();
  });

  it('partial with only conflicts (no fills) → no fill-in button', () => {
    const v = vehicle({ licensePlate: 'LUR554' });
    render(<ScanBranch scan={{ read: { plate: 'LUR554', model: 'Sorento' }, result: result({ plate: 'LUR554', vehicle: v, resolution: { kind: 'partial', fills: [], changes: [], conflicts: [{ field: 'model', existing: 'Envista', read: 'Sorento' }] } }) }} staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} scanNonce={1} />);
    expect(screen.getByText(/Disagrees on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fill in/ })).not.toBeInTheDocument();
  });

  it('a corrected misread shows the show-your-work line', () => {
    render(<ScanBranch scan={{ read: { plate: 'LMR554' }, result: result({ rawPlate: 'LMR554', plate: 'LUR554', wasCorrected: true }) }} staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} scanNonce={1} />);
    expect(screen.getByText(/corrected to/)).toBeInTheDocument();
  });

  // ⭐⭐ Aaron's real case, 2026-09-06: unit 5508783 came back re-plated LJF682 → MCM565. The tag is
  // the current truth, the record is the stale half, and this branch resolves the car by its UNIT —
  // so before this it filed the item and said nothing about the plate.
  it('a re-plated car OFFERS the new plate', () => {
    const v = vehicle({ licensePlate: 'LJF682', unitNumber: '5508783' });
    render(<ScanBranch
      scan={{ read: { ...FULL_READ, plate: 'MCM565', unitNumber: '5508783' },
              result: result({ plate: 'MCM565', vehicle: v, matchedByUnit: true,
                               resolution: { kind: 'complete' } }) }}
      staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} scanNonce={1} />);
    // It states what it SEES before it asks — both plates on screen, so the claim is checkable.
    expect(screen.getByText(/different plate, not a misread/)).toBeInTheDocument();
    // MCM565 appears twice — the branch's own header AND the offer. LJF682 only exists in the
    // offer, because it is the RECORD's plate: that is the half the operator cannot otherwise see.
    expect(screen.getAllByText('MCM565').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('LJF682')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New plates/ })).toBeInTheDocument();
  });

  // ⚠️ The other half of the rule, and the reason `classifyPlateDifference` exists: the cheap reader
  // is ~87.5% on plates, so a one-character difference is a bad read, not a trip to the plate office.
  it('a MISREAD offers nothing — one character off is not a re-plate', () => {
    const v = vehicle({ licensePlate: 'LUR254', unitNumber: '5508783' });
    render(<ScanBranch
      scan={{ read: { ...FULL_READ, plate: 'LUR234', unitNumber: '5508783' },
              result: result({ plate: 'LUR234', vehicle: v, matchedByUnit: true,
                               resolution: { kind: 'complete' } }) }}
      staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} scanNonce={1} />);
    expect(screen.queryByText(/different plate, not a misread/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New plates/ })).not.toBeInTheDocument();
  });

  // ⚠️⚠️ THE DUPLICATE THIS PREVENTS IS NOT HYPOTHETICAL. `fleetAudit`'s header records unit 5421656
  // entered twice as LUR143 and LURL43, and 5738117 as 0EJ761 and OEJ761 — one car each, from a
  // single misread character, both live for months. This is that knowledge arriving BEFORE the tap.
  it('⭐ names the car a misread plate probably is, before offering to register a duplicate', () => {
    render(<ScanBranch
      scan={{ read: { ...FULL_READ, plate: 'OHH120', owningArea: '8193' },
              result: result({ plate: 'OHH120', vehicle: null, resolution: { kind: 'new' } }) }}
      staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} scanNonce={1} />);
    expect(screen.getByText(/not in the fleet/)).toBeInTheDocument();
    expect(screen.getByText('0HH120')).toBeInTheDocument();
    expect(screen.getByText(/either the plate or the owning number was read wrong/i)).toBeInTheDocument();
  });

  it('⚠️ stays silent when nothing in the fleet is one character away', () => {
    render(<ScanBranch
      scan={{ read: { ...FULL_READ, plate: 'OZZ999', owningArea: '8193' },
              result: result({ plate: 'OZZ999', vehicle: null, resolution: { kind: 'new' } }) }}
      staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} scanNonce={1} />);
    expect(screen.queryByText(/either the plate or the owning number/i)).not.toBeInTheDocument();
  });
});
