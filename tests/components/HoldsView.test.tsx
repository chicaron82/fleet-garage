import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehicle, User, Hold } from '../../src/types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VSA_USER: User = {
  id: 'user-1', employeeId: 'E001', name: 'Test VSA', role: 'VSA', branchId: 'YWG',
};

const VEHICLE_HELD: Vehicle = {
  id: 'v-1', unitNumber: '1234567', licensePlate: 'HLD111',
  make: 'Toyota', model: 'Camry', year: 2023, color: 'Black',
  status: 'HELD', branchId: 'YWG',
  isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
};

const VEHICLE_CLEAR: Vehicle = {
  id: 'v-2', unitNumber: '7654321', licensePlate: 'CLR222',
  make: 'Honda', model: 'Civic', year: 2022, color: 'White',
  status: 'CLEAR', branchId: 'YWG',
  isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
};

const TEST_HOLD: Hold = {
  id: 'hold-1', vehicleId: 'v-1', status: 'ACTIVE',
  holdType: 'damage', holdTypes: ['damage'],
  damageDescription: 'Front bumper damage',
  flaggedById: 'user-1', flaggedByName: 'Test VSA',
  flaggedAt: '2026-05-01T10:00:00.000Z',
};

const ALL_VEHICLES = [VEHICLE_HELD, VEHICLE_CLEAR];

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: VSA_USER }),
}));

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    vehicles:       ALL_VEHICLES,
    holds:          [TEST_HOLD],
    staleHolds:     [],
    loading:        false,
    loadError:      false,
    reload:         vi.fn(),
    getVehicleByUnit: (u: string) => ALL_VEHICLES.find(v => v.unitNumber === u) ?? null,
    releaseStreak:  () => 0,
    archivedVehicles: [],
    restoreVehicle: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useUserResolver', () => ({
  useUserResolver: () => ({ getName: (_id: string, name?: string) => name ?? 'Test VSA' }),
}));

vi.mock('../../src/hooks/useBarcodeInterceptor', () => ({
  useBarcodeInterceptor: vi.fn(),
}));

vi.mock('../../src/components/shared/CameraBarcodeScanner', () => ({
  CameraBarcodeScanner: () => <button data-testid="camera-scanner-stub">Scan</button>,
}));

vi.mock('../../src/components/dashboard/DashboardSummaryCards', () => ({
  DashboardSummaryCards: () => <div data-testid="summary-cards" />,
}));

vi.mock('../../src/components/my-shift/PendingApprovalsSection', () => ({
  PendingApprovalsSection: () => <div data-testid="pending-approvals" />,
}));

vi.mock('../../src/components/dashboard/StaleHoldsAlert', () => ({
  StaleHoldsAlert: () => <div data-testid="stale-holds-alert" />,
}));

vi.mock('../../src/components/holds/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock('../../src/lib/holdBadge', () => ({
  holdContextEmojis: vi.fn().mockReturnValue([]),
  holdBadgeConfig: vi.fn().mockReturnValue({ label: 'Damage', className: 'bg-red-50 text-red-700' }),
  unresolvedHoldTypes: vi.fn((h) => h.holdTypes ?? []),
}));

vi.mock('../../src/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('../../src/lib/barcode', () => ({
  parseFleetBarcode: vi.fn().mockReturnValue({ ok: false }),
}));

const importComponent = async () => {
  const mod = await import('../../src/components/dashboard/HoldsView');
  return mod.HoldsView;
};

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear();
});

describe('HoldsView — vehicle list', () => {
  it('renders HELD vehicles in the default list', async () => {
    const HoldsView = await importComponent();
    render(<HoldsView onSelectVehicle={vi.fn()} onRegisterAndFlag={vi.fn()} />);

    expect(screen.getByText('1234567')).toBeInTheDocument();
    expect(screen.getByText(/HLD111/)).toBeInTheDocument();
  });

  it('hides CLEAR vehicles when no search is active', async () => {
    const HoldsView = await importComponent();
    render(<HoldsView onSelectVehicle={vi.fn()} onRegisterAndFlag={vi.fn()} />);

    expect(screen.queryByText('7654321')).not.toBeInTheDocument();
  });
});

describe('HoldsView — search', () => {
  it('filters by unit number', async () => {
    const user = userEvent.setup();
    const HoldsView = await importComponent();
    render(<HoldsView onSelectVehicle={vi.fn()} onRegisterAndFlag={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/search unit/i), '7654321');
    expect(await screen.findByText('7654321')).toBeInTheDocument();
  });

  it('filters by plate fragment', async () => {
    const user = userEvent.setup();
    const HoldsView = await importComponent();
    render(<HoldsView onSelectVehicle={vi.fn()} onRegisterAndFlag={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/search unit/i), 'CLR');
    expect(await screen.findByText(/CLR222/)).toBeInTheDocument();
  });

  it('shows "not in the system" + register CTA for unmatched search ≥2 chars', async () => {
    const user = userEvent.setup();
    const HoldsView = await importComponent();
    render(<HoldsView onSelectVehicle={vi.fn()} onRegisterAndFlag={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/search unit/i), 'ZZZZ');
    expect(await screen.findByText(/"ZZZZ" not in the system\./)).toBeInTheDocument();
    expect(screen.getByText(/Add to ledger/i)).toBeInTheDocument();
  });

  it('calls onRegisterAndFlag with the search term when register CTA is clicked', async () => {
    const user = userEvent.setup();
    const onRegisterAndFlag = vi.fn();
    const HoldsView = await importComponent();
    render(<HoldsView onSelectVehicle={vi.fn()} onRegisterAndFlag={onRegisterAndFlag} />);

    await user.type(screen.getByPlaceholderText(/search unit/i), 'ZZZZ');
    await user.click(await screen.findByText(/Add to ledger/i));

    expect(onRegisterAndFlag).toHaveBeenCalledWith('ZZZZ');
  });
});

describe('HoldsView — vehicle card interaction', () => {
  it('calls onSelectVehicle directly when card is clicked with no search', async () => {
    const user = userEvent.setup();
    const onSelectVehicle = vi.fn();
    const HoldsView = await importComponent();
    render(<HoldsView onSelectVehicle={onSelectVehicle} onRegisterAndFlag={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Toyota Camry/i }));
    expect(onSelectVehicle).toHaveBeenCalledWith('v-1');
  });

  it('shows confirmation sheet when card is clicked during active search', async () => {
    const user = userEvent.setup();
    const onSelectVehicle = vi.fn();
    const HoldsView = await importComponent();
    render(<HoldsView onSelectVehicle={onSelectVehicle} onRegisterAndFlag={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/search unit/i), '1234567');
    await user.click(await screen.findByRole('button', { name: /Toyota Camry/i }));

    expect(await screen.findByText(/Confirm vehicle/i)).toBeInTheDocument();
    expect(onSelectVehicle).not.toHaveBeenCalled();
  });

  it('calls onSelectVehicle after confirming in the confirmation sheet', async () => {
    const user = userEvent.setup();
    const onSelectVehicle = vi.fn();
    const HoldsView = await importComponent();
    render(<HoldsView onSelectVehicle={onSelectVehicle} onRegisterAndFlag={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/search unit/i), '1234567');
    await user.click(await screen.findByRole('button', { name: /Toyota Camry/i }));
    await user.click(await screen.findByRole('button', { name: /yes, open it/i }));

    expect(onSelectVehicle).toHaveBeenCalledWith('v-1');
  });
});
