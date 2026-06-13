import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EVAssetsTab } from '../../src/components/holds/EVAssetsTab';
import type { Vehicle, User } from '../../src/types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VSA_USER: User = {
  id: 'user-1', employeeId: 'E001', name: 'Test VSA', role: 'VSA', branchId: 'YWG',
};

const MOCK_TESLA: Vehicle = {
  id: 'v-tesla', unitNumber: '1111', licensePlate: 'TSL111',
  make: 'Tesla', model: 'Model 3', year: 2023, color: 'White',
  status: 'CLEAR', branchId: 'YWG',
  isTesla: true, hasMobileCable: true, hasJ1772Adapter: true,
};

const ALL_VEHICLES = [MOCK_TESLA];

// ── Mocks ────────────────────────────────────────────────────────────────────

const addVehicleMock = vi.fn().mockResolvedValue('new-id');
const updateVehicleEVAssetsMock = vi.fn().mockResolvedValue(true);
const addHoldMock = vi.fn().mockResolvedValue('hold-id');

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: VSA_USER }),
}));

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    vehicles: ALL_VEHICLES,
    holds: [],
    staleHolds: [],
    loading: false,
    loadError: false,
    reload: vi.fn(),
    addVehicle: addVehicleMock,
    updateVehicleEVAssets: updateVehicleEVAssetsMock,
    addHold: addHoldMock,
  }),
}));

vi.mock('../../src/hooks/useUserResolver', () => ({
  useUserResolver: () => ({ getName: (_id: string, name?: string) => name ?? 'Test VSA' }),
}));

vi.mock('../../src/lib/haptics', () => ({
  hapticMedium: vi.fn(),
  hapticLight: vi.fn(),
}));

beforeEach(() => {
  addVehicleMock.mockClear();
  updateVehicleEVAssetsMock.mockClear();
  addHoldMock.mockClear();
});

describe('EVAssetsTab and QuickAdd prefill behavior', () => {
  it('uppercases filter query input value and styles it uppercase', () => {
    render(<EVAssetsTab />);
    const input = screen.getByPlaceholderText('Filter Teslas…') as HTMLInputElement;
    
    // Type lowercase
    fireEvent.change(input, { target: { value: '0an12' } });
    
    // display value must be converted to uppercase
    expect(input.value).toBe('0AN12');
    // must carry uppercase display class
    expect(input.className).toContain('uppercase');
  });

  it('transfers license plate search query to QuickAddForm as plate prefill', () => {
    render(<EVAssetsTab />);
    const input = screen.getByPlaceholderText('Filter Teslas…') as HTMLInputElement;
    
    // Type a plate string (with letters)
    fireEvent.change(input, { target: { value: '0an12' } });
    
    // Click register
    const registerBtn = screen.getByRole('button', { name: 'Register a Tesla' });
    fireEvent.click(registerBtn);
    
    // QuickAddForm should be shown, plate input prefilled
    expect(screen.getByText('Register Tesla ⚡')).toBeInTheDocument();
    
    const plateInput = screen.getByPlaceholderText('e.g. HFE 872') as HTMLInputElement;
    expect(plateInput.value).toBe('0AN12');
    
    const unitInput = screen.getByPlaceholderText('e.g. 5421') as HTMLInputElement;
    expect(unitInput.value).toBe('');
  });

  it('transfers unit number search query to QuickAddForm as unit number prefill', () => {
    render(<EVAssetsTab />);
    const input = screen.getByPlaceholderText('Filter Teslas…') as HTMLInputElement;
    
    // Type a unit number string (digits only)
    fireEvent.change(input, { target: { value: '5421' } });
    
    // Click register
    const registerBtn = screen.getByRole('button', { name: 'Register a Tesla' });
    fireEvent.click(registerBtn);
    
    // QuickAddForm should be shown, unit input prefilled
    expect(screen.getByText('Register Tesla ⚡')).toBeInTheDocument();
    
    const unitInput = screen.getByPlaceholderText('e.g. 5421') as HTMLInputElement;
    expect(unitInput.value).toBe('5421');
    
    const plateInput = screen.getByPlaceholderText('e.g. HFE 872') as HTMLInputElement;
    expect(plateInput.value).toBe('');
  });
});
