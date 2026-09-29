import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EVAssetsTab } from '../../src/components/holds/EVAssetsTab';
import type { Vehicle, User } from '../../src/types';

// ⚠️ The tab awaited `updateVehicleEVAssets`, dropped its false, and closed the sheet — a lost
// assessment looked exactly like a saved one, and the loan/hold follow-ups then hung off a status that
// never landed (line-check 2026-09-28).

const VSA_USER: User = { id: 'u1', employeeId: 'E1', name: 'Test VSA', role: 'VSA', branchId: 'YWG' };
const TESLA: Vehicle = {
  id: 'v-tesla', unitNumber: '5429999', licensePlate: 'LUR999',
  make: 'Tesla', model: 'Model 3', year: 2025, color: 'White',
  status: 'CLEAR', branchId: 'YWG', isTesla: true, hasMobileCable: true, hasJ1772Adapter: true,
} as Vehicle;

const updateVehicleEVAssets = vi.fn().mockResolvedValue(true);
const createEvAssetLoan = vi.fn().mockResolvedValue(undefined);
const addHold = vi.fn().mockResolvedValue('hold-id');

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: VSA_USER }) }));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    vehicles: [TESLA], updateVehicleEVAssets, addHold,
    evAssetLoans: [], createEvAssetLoan, returnEvAssetLoan: vi.fn(),
  }),
}));
vi.mock('../../src/hooks/useUserResolver', () => ({ useUserResolver: () => ({ getName: () => 'Test VSA' }) }));
vi.mock('../../src/components/vehicle/EVAssetHistoryPanel', () => ({ EVAssetHistoryPanel: () => null }));
vi.mock('../../src/components/vehicle/EvLoanSection', () => ({ EvLoanSection: () => null }));

beforeEach(() => { vi.clearAllMocks(); updateVehicleEVAssets.mockResolvedValue(true); });

const openSheetAndSave = async () => {
  fireEvent.click(screen.getByRole('button', { name: /5429999/ }));
  const save = await screen.findByRole('button', { name: /Update Assets/i });
  fireEvent.click(save);
};

describe('EVAssetsTab — a lost EV write keeps the sheet and says so', () => {
  it('⭐ says it did not save, and does NOT close back to the roster', async () => {
    updateVehicleEVAssets.mockResolvedValue(false);
    render(<EVAssetsTab />);
    await openSheetAndSave();
    await waitFor(() => expect(updateVehicleEVAssets).toHaveBeenCalled());
    expect(await screen.findByText(/didn't save/i)).toBeInTheDocument();
    // still on the sheet — the button he just pressed is still there
    expect(screen.getByRole('button', { name: /Update Assets/i })).toBeInTheDocument();
  });

  it('⚠️ skips the follow-ups — no hold or loan hung off a status that never landed', async () => {
    updateVehicleEVAssets.mockResolvedValue(false);
    render(<EVAssetsTab />);
    await openSheetAndSave();
    await waitFor(() => expect(updateVehicleEVAssets).toHaveBeenCalled());
    expect(addHold).not.toHaveBeenCalled();
    expect(createEvAssetLoan).not.toHaveBeenCalled();
  });

  it('a landed write closes back to the roster with nothing said', async () => {
    render(<EVAssetsTab />);
    await openSheetAndSave();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Update Assets/i })).toBeNull());
    expect(screen.queryByText(/didn't save/i)).toBeNull();
  });
});
