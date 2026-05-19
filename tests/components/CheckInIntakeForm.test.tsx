// Smoke tests for CheckInIntakeForm.
//
// Locks in the current behaviour BEFORE the next round of component splits
// (VehicleScanAndMatch + LostFoundItemList extraction). Each test exercises
// one user journey through the intake flow.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehicle, User, Hold } from '../../src/types';

// ── Mocks ────────────────────────────────────────────────────────────────────

const TEST_USER: User = {
  id:         'auth-user-1',
  employeeId: 'EMP100',
  name:       'Test VSA',
  role:       'VSA',
  branchId:   'YWG',
};

const VEHICLE_CLEAR: Vehicle = {
  id:              'v-clear',
  unitNumber:      '5500001',
  licensePlate:    'AAA111',
  make:            'Toyota',
  model:           'Corolla',
  year:            2024,
  color:           'White',
  status:          'CLEAR',
  branchId:        'YWG',
  isTesla:         false,
  hasMobileCable:  null,
  hasJ1772Adapter: null,
};

const VEHICLE_HELD: Vehicle = {
  ...VEHICLE_CLEAR,
  id:           'v-held',
  unitNumber:   '5500002',
  licensePlate: 'BBB222',
  status:       'HELD',
};

const TEST_VEHICLES = [VEHICLE_CLEAR, VEHICLE_HELD];

const insertSpy        = vi.fn().mockResolvedValue({ error: null });
const addHoldSpy       = vi.fn().mockResolvedValue(undefined);
const addLostFoundSpy  = vi.fn().mockResolvedValue(undefined);
const getHoldsSpy      = vi.fn().mockReturnValue([] as Hold[]);

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user:           TEST_USER,
    loading:        false,
    login:          vi.fn(),
    logout:         vi.fn(),
    activeBranch:   'YWG',
    setActiveBranch: vi.fn(),
  }),
}));

vi.mock('../../src/context/GarageContext', () => ({
  useGarage: () => ({
    vehicles:           TEST_VEHICLES,
    getVehicleByUnit:   (u: string) => TEST_VEHICLES.find(v => v.unitNumber === u) ?? null,
    getHoldsForVehicle: getHoldsSpy,
    addHold:            addHoldSpy,
    addLostFoundItem:   addLostFoundSpy,
  }),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (...args: unknown[]) => {
        insertSpy(...args);
        return Promise.resolve({ error: null });
      },
      select: () => ({
        eq: () => ({
          not: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('../../src/lib/vehicleRegistry', () => ({
  createOrEnrichRegistry: vi.fn().mockResolvedValue({ id: 'reg-1', plate: 'AAA111' }),
  lookupRegistry:         vi.fn().mockResolvedValue({ status: 'new' }),
  mergeRegistryRecords:   vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/haptics', () => ({
  hapticLight:  vi.fn(),
  hapticMedium: vi.fn(),
}));

vi.mock('../../src/lib/image', () => ({
  compressImage: vi.fn().mockResolvedValue('data:image/jpeg;base64,STUB'),
}));

// Camera scanner uses getUserMedia which jsdom doesn't ship — stub it out.
vi.mock('../../src/components/CameraBarcodeScanner', () => ({
  CameraBarcodeScanner: ({ label }: { label: string }) => (
    <button data-testid="camera-scanner-stub">{label}</button>
  ),
}));

vi.mock('../../src/components/CheckInHoldPanel', () => ({
  CheckInHoldPanel: () => <div data-testid="hold-panel" />,
}));

vi.mock('../../src/components/EVAssetCheck', () => ({
  EVAssetCheck: () => <div data-testid="ev-check" />,
}));

// Import AFTER mocks are registered (top-level vi.mock is hoisted, but the
// import has to happen here so the component sees mocked modules).
const importComponent = async () => {
  const mod = await import('../../src/components/CheckInIntakeForm');
  return mod.CheckInIntakeForm;
};

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  insertSpy.mockClear();
  addHoldSpy.mockClear();
  addLostFoundSpy.mockClear();
  getHoldsSpy.mockClear();
});

describe('CheckInIntakeForm — initial render', () => {
  it('shows the scan prompt and unit search when no vehicle is selected', async () => {
    const CheckInIntakeForm = await importComponent();
    render(<CheckInIntakeForm onFlagIssue={vi.fn()} />);

    expect(screen.getByTestId('camera-scanner-stub')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/unit # or plate/i)).toBeInTheDocument();
  });
});

describe('CheckInIntakeForm — unit search', () => {
  it('finds a vehicle by unit number and selects it on click', async () => {
    const user = userEvent.setup();
    const CheckInIntakeForm = await importComponent();
    render(<CheckInIntakeForm onFlagIssue={vi.fn()} />);

    const search = screen.getByPlaceholderText(/unit # or plate/i);
    await user.type(search, '5500001');

    const result = await screen.findByText(/Toyota/i);
    await user.click(result);

    // After selection, the scan prompt is gone and the vehicle card is shown.
    expect(screen.queryByTestId('camera-scanner-stub')).not.toBeInTheDocument();
    expect(screen.getByText(/Plate: AAA111/i)).toBeInTheDocument();
  });

  it('finds a vehicle by license plate fragment', async () => {
    const user = userEvent.setup();
    const CheckInIntakeForm = await importComponent();
    render(<CheckInIntakeForm onFlagIssue={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/unit # or plate/i), 'AAA');
    expect(await screen.findByText(/Corolla/i)).toBeInTheDocument();
  });

  it('shows the plate-arrival CTA when no vehicle matches the search', async () => {
    const user = userEvent.setup();
    const CheckInIntakeForm = await importComponent();
    render(<CheckInIntakeForm onFlagIssue={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/unit # or plate/i), 'ZZZZ');
    expect(await screen.findByText(/not in the system/i)).toBeInTheDocument();
    expect(screen.getByText(/record arrival by plate/i)).toBeInTheDocument();
  });
});

describe('CheckInIntakeForm — submit flow', () => {
  it('disables submit until both interior and exterior conditions are set', async () => {
    const user = userEvent.setup();
    const CheckInIntakeForm = await importComponent();
    render(<CheckInIntakeForm onFlagIssue={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/unit # or plate/i), '5500001');
    await user.click(await screen.findByText(/Toyota/i));

    const submit = screen.getByRole('button', { name: /Submit Check-in/i });
    expect(submit).toBeDisabled();

    // Choose Clean for interior
    const cleanButtons = screen.getAllByRole('button', { name: /^Clean$/ });
    await user.click(cleanButtons[0]);
    expect(submit).toBeDisabled();

    // Choose Good for exterior
    const goodButtons = screen.getAllByRole('button', { name: /^Good$/ });
    await user.click(goodButtons[1]);
    expect(submit).not.toBeDisabled();
  });

  it('writes a vehicle_checkins row when submit is clicked', async () => {
    const user = userEvent.setup();
    const CheckInIntakeForm = await importComponent();
    render(<CheckInIntakeForm onFlagIssue={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/unit # or plate/i), '5500001');
    await user.click(await screen.findByText(/Toyota/i));

    await user.click(screen.getAllByRole('button', { name: /^Clean$/ })[0]);
    await user.click(screen.getAllByRole('button', { name: /^Good$/ })[1]);
    await user.click(screen.getByRole('button', { name: /Submit Check-in/i }));

    await waitFor(() => {
      expect(insertSpy).toHaveBeenCalled();
    });
    const payload = insertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.vehicle_id).toBe('v-clear');
    expect(payload.interior_condition).toBe('clean');
    expect(payload.exterior_condition).toBe('good');
    expect(payload.checked_in_by_id).toBe('auth-user-1');
  });
});

describe('CheckInIntakeForm — HELD vehicle gate', () => {
  it('shows the on-hold warning and disables submit for HELD vehicles', async () => {
    const user = userEvent.setup();
    const CheckInIntakeForm = await importComponent();
    render(<CheckInIntakeForm onFlagIssue={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/unit # or plate/i), '5500002');
    await user.click(await screen.findByText(/BBB222/i));

    expect(screen.getByText(/Vehicle is currently on hold/i)).toBeInTheDocument();

    // Even after both conditions are set, submit stays disabled
    await user.click(screen.getAllByRole('button', { name: /^Clean$/ })[0]);
    await user.click(screen.getAllByRole('button', { name: /^Good$/ })[1]);
    expect(screen.getByRole('button', { name: /Submit Check-in/i })).toBeDisabled();
  });
});

describe('CheckInIntakeForm — reset', () => {
  it('returns to scan view when "Clear" is clicked', async () => {
    const user = userEvent.setup();
    const CheckInIntakeForm = await importComponent();
    render(<CheckInIntakeForm onFlagIssue={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/unit # or plate/i), '5500001');
    await user.click(await screen.findByText(/Toyota/i));
    expect(screen.queryByTestId('camera-scanner-stub')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Clear$/ }));
    expect(screen.getByTestId('camera-scanner-stub')).toBeInTheDocument();
  });
});

describe('CheckInIntakeForm — found items', () => {
  it('opens the items-found section and adds an empty item row', async () => {
    const user = userEvent.setup();
    const CheckInIntakeForm = await importComponent();
    render(<CheckInIntakeForm onFlagIssue={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/unit # or plate/i), '5500001');
    await user.click(await screen.findByText(/Toyota/i));

    await user.click(screen.getByRole('button', { name: /Log Found Item/i }));

    expect(screen.getByText(/Items Found/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Wooden rod, jacket, luggage/i)).toBeInTheDocument();
  });

  it('logs found items to lost-and-found alongside the checkin write', async () => {
    const user = userEvent.setup();
    const CheckInIntakeForm = await importComponent();
    render(<CheckInIntakeForm onFlagIssue={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/unit # or plate/i), '5500001');
    await user.click(await screen.findByText(/Toyota/i));
    await user.click(screen.getAllByRole('button', { name: /^Clean$/ })[0]);
    await user.click(screen.getAllByRole('button', { name: /^Good$/ })[1]);

    await user.click(screen.getByRole('button', { name: /Log Found Item/i }));
    await user.type(screen.getByPlaceholderText(/Wooden rod, jacket, luggage/i), 'Leather jacket');

    await user.click(screen.getByRole('button', { name: /Submit Check-in/i }));

    await waitFor(() => {
      expect(addLostFoundSpy).toHaveBeenCalled();
    });
    const payload = addLostFoundSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.description).toBe('Leather jacket');
    expect(payload.unitNumber).toBe('5500001');
  });
});
