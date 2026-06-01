import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '../../src/types';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('../../src/lib/image', () => ({ compressImage: vi.fn().mockResolvedValue('data:image/jpeg;base64,xxx') }));

const importComponent = async () => {
  const mod = await import('../../src/components/holds/NewIssueReHoldForm');
  return mod.NewIssueReHoldForm;
};

const USER: User = { id: 'u-1', employeeId: 'E1', name: 'Test VSA', role: 'VSA', branchId: 'YWG' };

const baseProps = () => ({
  user: USER,
  submitting: false,
  onCancel: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
  getName: () => 'Test VSA',
});

beforeEach(() => vi.clearAllMocks());

// ── Initial render + gating ─────────────────────────────────────────────────

describe('NewIssueReHoldForm — initial state', () => {
  it('defaults to the damage hold type with submit disabled (no damage type, no photo)', async () => {
    const Form = await importComponent();
    render(<Form {...baseProps()} />);
    expect(screen.getByText('Damage Type *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Re-hold/i })).toBeDisabled();
  });

  it('shows the photo-required warning when no bypass is active', async () => {
    const Form = await importComponent();
    render(<Form {...baseProps()} />);
    expect(screen.getByText(/At least one photo required/i)).toBeInTheDocument();
  });
});

// ── Hold-type switching ────────────────────────────────────────────────────────

describe('NewIssueReHoldForm — hold type switch', () => {
  it('switching to detail reveals the description field and hides damage presets', async () => {
    const user = userEvent.setup();
    const Form = await importComponent();
    render(<Form {...baseProps()} />);

    await user.click(screen.getByRole('button', { name: '🧹 Detail' }));
    expect(screen.queryByText('Damage Type *')).not.toBeInTheDocument();
    expect(screen.getByText(/Odour \/ smoke \/ vape/i)).toBeInTheDocument();
  });
});

// ── Bypass submit paths (no photo needed) — pins handleLocalSubmit description matrix ──

describe('NewIssueReHoldForm — bypass submit payloads', () => {
  it('exception "no new damage" → submits a no-new-damage description with no photos', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const Form = await importComponent();
    render(<Form {...props} reHoldContext="exception" />);

    await user.click(screen.getByRole('checkbox', { name: /No new damage found/i }));
    const submit = screen.getByRole('button', { name: /Confirm Re-hold/i });
    expect(submit).not.toBeDisabled();
    await user.click(submit);

    expect(props.onSubmit).toHaveBeenCalledWith('No new damage — returned to hold', '', [], ['damage']);
  });

  it('auction "sale car returning" → submits a sale-car description', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const Form = await importComponent();
    render(<Form {...props} reHoldContext="auction" />);

    await user.click(screen.getByRole('checkbox', { name: /Sale car returning/i }));
    await user.click(screen.getByRole('button', { name: /Confirm Re-hold/i }));

    expect(props.onSubmit).toHaveBeenCalledWith('Sale car — returned from short-term circulation', '', [], ['damage']);
  });

  it('detail + odour bypass → "Odour/smoke/vape", holdTypes [detail]', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const Form = await importComponent();
    render(<Form {...props} />);

    await user.click(screen.getByRole('button', { name: '🧹 Detail' }));
    await user.click(screen.getByRole('checkbox', { name: /Odour \/ smoke \/ vape/i }));
    await user.click(screen.getByRole('button', { name: /Confirm Re-hold/i }));

    expect(props.onSubmit).toHaveBeenCalledWith('Odour/smoke/vape', '', [], ['detail']);
  });

  it('mechanical + PM bypass → "PM due", holdTypes [mechanical]', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const Form = await importComponent();
    render(<Form {...props} />);

    await user.click(screen.getByRole('button', { name: '⚙️ Mechanical' }));
    await user.click(screen.getByRole('checkbox', { name: /PM due/i }));
    await user.click(screen.getByRole('button', { name: /Confirm Re-hold/i }));

    expect(props.onSubmit).toHaveBeenCalledWith('PM due', '', [], ['mechanical']);
  });
});

describe('NewIssueReHoldForm — cancel', () => {
  it('calls onCancel', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const Form = await importComponent();
    render(<Form {...props} />);
    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(props.onCancel).toHaveBeenCalled();
  });
});
