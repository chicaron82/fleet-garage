// Already on today's list (Aaron, 2026-11-06: *"Maybe a heads up "this vehicle was already cleaned (insert time since)
// ago"?"*; docs/ticket-bay-already-done-today.md). The heads-up takes Start / On deck's place; Clean it again brings
// them back. A warning, never a block.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const row = (id: number, vehicle_id: string, plate: string, exit: BayLogRow['exit'], exitedAt: string | null): BayLogRow => ({
  id, vehicle_id, plate, unit_number: null, car: null, odometer: null, started_at: '2026-11-06T19:39:00.000Z', exit,
  exited_at: exitedAt, took_dirty: true, redo_of: null, shift_day: '2026-11-06', note: null, hold_id: null,
});
let rows: BayLogRow[] = [];
const start = vi.fn(async () => null);
vi.mock('../../src/hooks/useBayLog', () => ({ useBayLog: () => ({ loaded: true, rows, start }) }));
vi.mock('../../src/hooks/useBayStandby', () => ({ useBayStandby: () => ({ loaded: true, standby: null, load: vi.fn(async () => null) }) }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Aaron S.' } }) }));
const { ScanBayStart } = await import('../../src/components/scan-router/ScanBayStart');

const lur322 = { id: 'v-322', licensePlate: 'LUR322', odometerAt: null } as never;

describe('ScanBayStart: already on today\'s list', () => {
  it('⭐ a car cleaned earlier today: the heads-up, not Start; Clean it again brings Start back', () => {
    rows = [row(274, 'v-322', 'LUR322', 'clean', '2026-11-06T19:40:00.000Z')];
    render(<ScanBayStart vehicle={lur322} onOpenBay={() => {}} />);
    expect(screen.getByRole('alert').textContent).toMatch(/LUR322 was cleaned .* \(\d\d:40\)/);
    expect(screen.queryByRole('button', { name: /Start clean/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /On deck/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clean it again' }));
    expect(screen.getByRole('button', { name: /Start clean/ })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a car with nothing today (or only a Skip) goes straight to Start', () => {
    rows = [row(1, 'v-other', 'LUR344', 'clean', '2026-11-06T19:39:00.000Z'), row(2, 'v-322', 'LUR322', 'skip', '2026-11-06T19:20:00.000Z')];
    render(<ScanBayStart vehicle={lur322} onOpenBay={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: /Start clean/ })).toBeTruthy();
  });
});
