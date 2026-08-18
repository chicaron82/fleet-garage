import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ScanBranch } from '../../src/components/holds/KeytagScan';
import type { KeytagScanResult } from '../../src/lib/resolveKeytagScan';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../../src/types';

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
    render(<ScanBranch scan={{ read: FULL_READ, result: result({}) }} staged={false} onRegister={onRegister} onBackfill={vi.fn()} />);
    expect(screen.getByText(/not in the fleet/)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Register .*Kia Seltos/ });
    fireEvent.click(btn);
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it('new but an incomplete read → no register button, points to chat', () => {
    const thin: KeytagRead = { plate: 'LZM999' }; // no make/model/unit/year
    render(<ScanBranch scan={{ read: thin, result: result({}) }} staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Register/ })).not.toBeInTheDocument();
    expect(screen.getByText(/add it via Effie chat/)).toBeInTheDocument();
  });

  it('staged → shows the receipt, not the register button', () => {
    render(<ScanBranch scan={{ read: FULL_READ, result: result({}) }} staged onRegister={vi.fn()} onBackfill={vi.fn()} />);
    expect(screen.getByText(/✓ Staged LZM999 to register/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Register/ })).not.toBeInTheDocument();
  });

  it('complete → says it is already in the fleet with the details', () => {
    const v = vehicle({ licensePlate: 'LUR554' });
    render(<ScanBranch scan={{ read: { plate: 'LUR554' }, result: result({ plate: 'LUR554', vehicle: v, resolution: { kind: 'complete' } }) }} staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} />);
    expect(screen.getByText(/Already in the fleet/)).toBeInTheDocument();
    expect(screen.getByText(/2026 Buick Envista/)).toBeInTheDocument();
  });

  it('partial → shows the fields the tag adds, and click fires onBackfill', () => {
    const v = vehicle({ licensePlate: 'LUR554', model: '', year: 0 });
    const onBackfill = vi.fn();
    render(<ScanBranch scan={{ read: { plate: 'LUR554', model: 'Envista', year: 2026 }, result: result({ plate: 'LUR554', vehicle: v, resolution: { kind: 'partial', fills: [{ field: 'model', value: 'Envista' }, { field: 'year', value: 2026 }], changes: [], conflicts: [] } }) }} staged={false} onRegister={vi.fn()} onBackfill={onBackfill} />);
    expect(screen.getByText(/in the fleet/)).toBeInTheDocument();
    expect(screen.getByText(/The tag adds/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fill in/ }));
    expect(onBackfill).toHaveBeenCalledTimes(1);
  });

  it('partial + staged → shows the receipt, not the fill-in button', () => {
    const v = vehicle({ licensePlate: 'LUR554', model: '', year: 0 });
    render(<ScanBranch scan={{ read: { plate: 'LUR554', model: 'Envista', year: 2026 }, result: result({ plate: 'LUR554', vehicle: v, resolution: { kind: 'partial', fills: [{ field: 'model', value: 'Envista' }], changes: [], conflicts: [] } }) }} staged onRegister={vi.fn()} onBackfill={vi.fn()} />);
    expect(screen.getByText(/✓ Staged the backfill/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fill in/ })).not.toBeInTheDocument();
  });

  it('partial with only conflicts (no fills) → no fill-in button', () => {
    const v = vehicle({ licensePlate: 'LUR554' });
    render(<ScanBranch scan={{ read: { plate: 'LUR554', model: 'Sorento' }, result: result({ plate: 'LUR554', vehicle: v, resolution: { kind: 'partial', fills: [], changes: [], conflicts: [{ field: 'model', existing: 'Envista', read: 'Sorento' }] } }) }} staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} />);
    expect(screen.getByText(/Disagrees on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fill in/ })).not.toBeInTheDocument();
  });

  it('a corrected misread shows the show-your-work line', () => {
    render(<ScanBranch scan={{ read: { plate: 'LMR554' }, result: result({ rawPlate: 'LMR554', plate: 'LUR554', wasCorrected: true }) }} staged={false} onRegister={vi.fn()} onBackfill={vi.fn()} />);
    expect(screen.getByText(/corrected to/)).toBeInTheDocument();
  });
});
