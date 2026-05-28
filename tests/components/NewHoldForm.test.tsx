import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehicle, User } from '../../src/types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VSA_USER: User = {
  id: 'user-1', employeeId: 'E001', name: 'Test VSA', role: 'VSA', branchId: 'YWG',
};

const VEHICLE: Vehicle = {
  id: 'v-1', unitNumber: '5500001', licensePlate: 'AAA111',
  make: 'Toyota', model: 'Corolla', year: 2024, color: 'White',
  status: 'CLEAR', branchId: 'YWG',
  isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
};

// ── Mocks ────────────────────────────────────────────────────────────────────

const addHoldSpy    = vi.fn().mockResolvedValue(undefined);
const addVehicleSpy = vi.fn().mockResolvedValue('v-new');
const compressImageSpy = vi.fn().mockResolvedValue('data:image/jpeg;base64,STUB');

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: VSA_USER }),
}));

// getActiveHold returns null by default — overridden per-test where needed
let getActiveHoldImpl: (id: string) => unknown = () => null;

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    vehicles:         [VEHICLE],
    getVehicleByUnit: (u: string) => (u === VEHICLE.unitNumber ? VEHICLE : null),
    getActiveHold:    (id: string) => getActiveHoldImpl(id),
    addHold:          addHoldSpy,
    addVehicle:       addVehicleSpy,
  }),
}));

vi.mock('../../src/hooks/useBarcodeInterceptor', () => ({
  useBarcodeInterceptor: vi.fn(),
}));

vi.mock('../../src/components/shared/CameraBarcodeScanner', () => ({
  CameraBarcodeScanner: () => <button data-testid="camera-scanner-stub">Scan</button>,
}));

// Stub renders a button that injects one damage type so canSubmit can be reached
vi.mock('../../src/components/holds/DamagePresetsSelector', () => ({
  DamagePresetsSelector: ({ toggleDamageType }: { toggleDamageType: (t: string) => void }) => (
    <button
      data-testid="damage-preset-stub"
      type="button"
      onClick={() => toggleDamageType('Scratch')}
    >
      Add Scratch
    </button>
  ),
}));

vi.mock('../../src/components/holds/MechanicalConcernSelector', () => ({
  MechanicalConcernSelector: () => <div data-testid="mechanical-stub" />,
}));

vi.mock('../../src/lib/vehicleRegistry', () => ({
  createOrEnrichRegistry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../src/lib/image', () => ({
  compressImage: compressImageSpy,
}));

vi.mock('../../src/lib/haptics', () => ({
  hapticLight:  vi.fn(),
  hapticMedium: vi.fn(),
  hapticHeavy:  vi.fn(),
}));

vi.mock('../../src/lib/barcode', () => ({
  parseFleetBarcode: vi.fn().mockReturnValue({ ok: false }),
}));

vi.mock('../../src/lib/holdBadge', () => ({
  getTireSwapSeason:  vi.fn().mockReturnValue('Winter'),
  holdContextEmojis:  vi.fn().mockReturnValue([]),
}));

const importComponent = async () => {
  const mod = await import('../../src/components/holds/NewHoldForm');
  return mod.NewHoldForm;
};

const BASE_PROPS = {
  onBack:    vi.fn(),
  onSuccess: vi.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Simulates adding a photo via the hidden camera file input.
function addPhoto(file: File) {
  const input = document.querySelector('input[type="file"][capture]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  fireEvent.change(input);
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  addHoldSpy.mockClear();
  compressImageSpy.mockClear();
  BASE_PROPS.onBack = vi.fn();
  BASE_PROPS.onSuccess = vi.fn();
  getActiveHoldImpl = () => null;
});

describe('NewHoldForm — vehicle selection', () => {
  it('renders vehicle search when no preselectedId is provided', async () => {
    const NewHoldForm = await importComponent();
    render(<NewHoldForm {...BASE_PROPS} />);

    expect(screen.getByPlaceholderText(/search by unit/i)).toBeInTheDocument();
  });

  it('skips search and shows vehicle card when preselectedId is provided', async () => {
    const NewHoldForm = await importComponent();
    render(<NewHoldForm {...BASE_PROPS} vehicleId="v-1" />);

    expect(screen.queryByPlaceholderText(/search by unit/i)).not.toBeInTheDocument();
    expect(screen.getByText('5500001')).toBeInTheDocument();
    expect(screen.getByText(/Plate: AAA111/i)).toBeInTheDocument();
  });

  it('shows search results for a matching unit number', async () => {
    const user = userEvent.setup();
    const NewHoldForm = await importComponent();
    render(<NewHoldForm {...BASE_PROPS} />);

    await user.type(screen.getByPlaceholderText(/search by unit/i), '5500');
    expect(await screen.findByText('5500001')).toBeInTheDocument();
  });

  it('shows "not in the system" and flag CTA for unmatched search ≥2 chars', async () => {
    const user = userEvent.setup();
    const NewHoldForm = await importComponent();
    render(<NewHoldForm {...BASE_PROPS} />);

    await user.type(screen.getByPlaceholderText(/search by unit/i), 'ZZZZ');
    expect(await screen.findByText(/not in the system/i)).toBeInTheDocument();
    expect(screen.getByText(/Flag damage on this plate/i)).toBeInTheDocument();
  });

  it('shows the already-held warning when vehicle has an active hold', async () => {
    getActiveHoldImpl = () => ({ id: 'existing-hold' });
    const NewHoldForm = await importComponent();
    render(<NewHoldForm {...BASE_PROPS} vehicleId="v-1" />);

    expect(await screen.findByText(/already has an active hold/i)).toBeInTheDocument();
  });
});

describe('NewHoldForm — submit gate', () => {
  it('keeps submit disabled when no vehicle is selected', async () => {
    const NewHoldForm = await importComponent();
    render(<NewHoldForm {...BASE_PROPS} />);

    expect(screen.getByRole('button', { name: /Flag Issue/i })).toBeDisabled();
  });

  it('keeps submit disabled when vehicle is selected but no damage type or photo', async () => {
    const NewHoldForm = await importComponent();
    render(<NewHoldForm {...BASE_PROPS} vehicleId="v-1" />);

    // Damage hold is default: requires at least one damage type + one photo.
    // Neither has been provided, so submit stays disabled.
    expect(screen.getByRole('button', { name: /Flag Issue/i })).toBeDisabled();
  });
});

describe('NewHoldForm — photo upload + compressImage', () => {
  it('calls compressImage when a photo is added via file input', async () => {
    const NewHoldForm = await importComponent();
    render(<NewHoldForm {...BASE_PROPS} vehicleId="v-1" />);

    const file = new File(['img'], 'damage.jpg', { type: 'image/jpeg' });
    addPhoto(file);

    await waitFor(() => expect(compressImageSpy).toHaveBeenCalled());
    expect(compressImageSpy.mock.calls[0][0]).toBe(file);
  });

  it('includes the compressed photo in the addHold payload on submit', async () => {
    const user = userEvent.setup();
    const NewHoldForm = await importComponent();
    render(<NewHoldForm {...BASE_PROPS} vehicleId="v-1" />);

    // Select a damage type via the stub
    await user.click(screen.getByTestId('damage-preset-stub'));

    // Add a photo
    const file = new File(['img'], 'damage.jpg', { type: 'image/jpeg' });
    addPhoto(file);

    // Wait for compressImage to resolve and photos state to update
    await waitFor(() => expect(compressImageSpy).toHaveBeenCalled());

    // Submit should now be enabled
    const submitBtn = screen.getByRole('button', { name: /Flag Issue/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    await user.click(submitBtn);

    await waitFor(() => expect(addHoldSpy).toHaveBeenCalled());
    const photos = addHoldSpy.mock.calls[0][4] as string[];
    expect(photos).toContain('data:image/jpeg;base64,STUB');
  });

  it('calls onSuccess with the vehicleId after a successful submit', async () => {
    const user = userEvent.setup();
    const NewHoldForm = await importComponent();
    render(<NewHoldForm {...BASE_PROPS} vehicleId="v-1" />);

    await user.click(screen.getByTestId('damage-preset-stub'));

    const file = new File(['img'], 'damage.jpg', { type: 'image/jpeg' });
    addPhoto(file);
    await waitFor(() => expect(compressImageSpy).toHaveBeenCalled());

    const submitBtn = screen.getByRole('button', { name: /Flag Issue/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    await user.click(submitBtn);

    await waitFor(() => expect(BASE_PROPS.onSuccess).toHaveBeenCalledWith('v-1'));
  });
});
