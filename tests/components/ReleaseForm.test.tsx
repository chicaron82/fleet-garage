import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehicle, User, Hold } from '../../src/types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MANAGER: User = {
  id: 'mgr-1', employeeId: 'M001', name: 'Jane Manager', role: 'Branch Manager', branchId: 'YWG',
};

const VEHICLE: Vehicle = {
  id: 'v-1', unitNumber: '1234567', licensePlate: 'HLD111',
  make: 'Toyota', model: 'Camry', year: 2023, color: 'Black',
  status: 'HELD', branchId: 'YWG',
  isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
};

const HOLD: Hold = {
  id: 'hold-1', vehicleId: 'v-1', status: 'ACTIVE',
  holdType: 'damage', holdTypes: ['damage'],
  damageDescription: 'Front bumper scratched near the headlight.',
  flaggedById: 'user-1', flaggedByName: 'Test VSA',
  flaggedAt: '2026-05-01T10:00:00.000Z',
};

// ── Mocks ────────────────────────────────────────────────────────────────────

const addReleaseSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: MANAGER }),
}));

vi.mock('../../src/context/GarageContext', () => ({
  useGarage: () => ({
    holds:      [HOLD],
    vehicles:   [VEHICLE],
    addRelease: addReleaseSpy,
  }),
}));

vi.mock('../../src/lib/haptics', () => ({
  hapticLight:  vi.fn(),
  hapticMedium: vi.fn(),
  hapticHeavy:  vi.fn(),
}));

const importComponent = async () => {
  const mod = await import('../../src/components/holds/ReleaseForm');
  return mod.ReleaseForm;
};

const DEFAULT_PROPS = {
  holdId:    'hold-1',
  vehicleId: 'v-1',
  onClose:   vi.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function selectReasonAndAdvance(user: ReturnType<typeof userEvent.setup>) {
  const select = screen.getByRole('combobox');
  await user.selectOptions(select, screen.getAllByRole('option')[1]);
  await user.click(screen.getByRole('button', { name: /Approve Release/i }));
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  addReleaseSpy.mockClear();
  DEFAULT_PROPS.onClose = vi.fn();
});

describe('ReleaseForm — initial render', () => {
  it('shows the exception release form by default', async () => {
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    expect(screen.getByRole('heading', { name: /Approve Release/i })).toBeInTheDocument();
    expect(screen.getByText(/Vehicle will move to Out on Exception status/i)).toBeInTheDocument();
  });

  it('disables the submit button until a reason is selected', async () => {
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    expect(screen.getByRole('button', { name: /Approve Release/i })).toBeDisabled();
  });

  it('shows the approving manager name and role', async () => {
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    expect(screen.getByText(/Jane Manager/)).toBeInTheDocument();
    expect(screen.getByText(/Branch Manager/)).toBeInTheDocument();
  });
});

describe('ReleaseForm — exception path', () => {
  it('enables submit once a reason is selected', async () => {
    const user = userEvent.setup();
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    await user.selectOptions(screen.getByRole('combobox'), screen.getAllByRole('option')[1]);
    expect(screen.getByRole('button', { name: /Approve Release/i })).not.toBeDisabled();
  });

  it('advances to the confirmation screen on submit', async () => {
    const user = userEvent.setup();
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    await selectReasonAndAdvance(user);

    expect(await screen.findByText(/Confirm Release/i)).toBeInTheDocument();
    expect(screen.getByText('1234567 · HLD111')).toBeInTheDocument();
    expect(screen.getByText(/Front bumper scratched/i)).toBeInTheDocument();
  });

  it('calls addRelease with EXCEPTION type and correct payload on confirm', async () => {
    const user = userEvent.setup();
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    await selectReasonAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: /Confirm.*Release Vehicle/i }));

    await waitFor(() => expect(addReleaseSpy).toHaveBeenCalledOnce());
    const [holdId, payload] = addReleaseSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(holdId).toBe('hold-1');
    expect(payload.releaseType).toBe('EXCEPTION');
    expect(payload.releaseMethod).toBe('standard');
    expect(payload.approvedById).toBe('mgr-1');
    expect(typeof payload.reason).toBe('string');
  });

  it('calls onClose after addRelease resolves', async () => {
    const user = userEvent.setup();
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    await selectReasonAndAdvance(user);
    await user.click(await screen.findByRole('button', { name: /Confirm.*Release Vehicle/i }));

    await waitFor(() => expect(DEFAULT_PROPS.onClose).toHaveBeenCalled());
  });
});

describe('ReleaseForm — mechanical path', () => {
  it('switches to mechanical reasons when Mechanical tab is selected', async () => {
    const user = userEvent.setup();
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /Mechanical/i }));

    expect(screen.getByText(/Mechanical hold — short term, must return for service/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /PM due.*2 days/i })).toBeInTheDocument();
  });

  it('calls addRelease with MECHANICAL_RELEASE type on confirm', async () => {
    const user = userEvent.setup();
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /Mechanical/i }));
    await user.selectOptions(screen.getByRole('combobox'), screen.getAllByRole('option')[1]);
    await user.click(screen.getByRole('button', { name: /Approve Release/i }));
    await user.click(await screen.findByRole('button', { name: /Confirm.*Release Vehicle/i }));

    await waitFor(() => expect(addReleaseSpy).toHaveBeenCalledOnce());
    const [, payload] = addReleaseSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.releaseType).toBe('MECHANICAL_RELEASE');
  });
});

describe('ReleaseForm — pre-existing path', () => {
  it('switches to pre-existing reasons and hides expected return date', async () => {
    const user = userEvent.setup();
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /Pre-existing/i }));

    expect(screen.getByText(/Vehicle will be marked Pre-existing/i)).toBeInTheDocument();
    expect(screen.queryByText(/Expected Return Date/i)).not.toBeInTheDocument();
  });

  it('shows pre-existing reasons in the dropdown', async () => {
    const user = userEvent.setup();
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /Pre-existing/i }));

    expect(screen.getByRole('option', { name: /Known damage.*cleared for regular rental/i })).toBeInTheDocument();
  });

  it('calls addRelease with PRE_EXISTING type on confirm', async () => {
    const user = userEvent.setup();
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /Pre-existing/i }));
    await user.selectOptions(screen.getByRole('combobox'), screen.getAllByRole('option')[1]);
    await user.click(screen.getByRole('button', { name: /Approve Release/i }));
    await user.click(await screen.findByRole('button', { name: /Confirm.*Release Vehicle/i }));

    await waitFor(() => expect(addReleaseSpy).toHaveBeenCalledOnce());
    const [, payload] = addReleaseSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.releaseType).toBe('PRE_EXISTING');
  });
});

describe('ReleaseForm — cancel & streak', () => {
  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} />);

    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(DEFAULT_PROPS.onClose).toHaveBeenCalled();
  });

  it('shows the streak warning banner when streak ≥ 2', async () => {
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} streak={2} />);

    expect(screen.getByText(/Released 2× without repair/i)).toBeInTheDocument();
  });

  it('shows the elevated streak banner (🔴) when streak ≥ 3', async () => {
    const ReleaseForm = await importComponent();
    render(<ReleaseForm {...DEFAULT_PROPS} streak={3} />);

    expect(screen.getByText(/Released 3× without repair/i)).toBeInTheDocument();
    expect(screen.getByText(/isn't getting fixed/i)).toBeInTheDocument();
  });
});
