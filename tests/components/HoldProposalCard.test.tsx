import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HoldProposalCard } from '../../src/components/assistant/HoldProposalCard';
import type { Proposal } from '../../api/_lib/holdProposal';

// The resurrection bug (docs/bug-misc-effie-confirmed-card-resurrects.md): the card's
// done/receipt state was card-LOCAL, so closing the chat panel (unmount) and reopening
// remounted an already-confirmed proposal as a fresh, re-tappable confirm card — one tap
// away from a duplicate write. Resolution now lives on the chat message and is passed in
// via the `done` prop; these tests lock that a done card is a receipt, never a button.

// ── Fixtures ─────────────────────────────────────────────────────────────────

const REGISTER: Proposal = {
  kind: 'register_vehicle',
  newVehicle: { unitNumber: '5423827', plate: 'LZM554', make: 'Kia', model: 'Seltos', year: 2026, color: 'Gray' },
  isTesla: false,
};

const HOLD: Proposal = {
  kind: 'hold',
  vehicle: { vehicleId: 'v-1', plate: 'LUR187', label: 'Unit 1234 · Toyota Corolla' },
  holdType: 'Body',
  damageDescription: 'Scratch on the rear door',
};

const noop = { onDismiss: vi.fn(), onConfirm: vi.fn().mockResolvedValue(undefined) };

// ── done: the remount case (panel closed → reopened after a confirm) ─────────

describe('HoldProposalCard — done (already-executed proposal remounts)', () => {
  it('renders the receipt, not a confirmable card (register)', () => {
    render(<HoldProposalCard proposal={REGISTER} done {...noop} />);
    expect(screen.getByText(/Registered/)).toBeInTheDocument();
    expect(screen.getByText('LZM554')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /register/i })).not.toBeInTheDocument();
  });

  it('renders the receipt, not a confirmable card (hold)', () => {
    render(<HoldProposalCard proposal={HOLD} done {...noop} />);
    expect(screen.getByText(/Hold opened on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm hold/i })).not.toBeInTheDocument();
  });

  it('a done card cannot fire the write again', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<HoldProposalCard proposal={REGISTER} done onDismiss={vi.fn()} onConfirm={onConfirm} />);
    // No confirm affordance exists at all — nothing to tap.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// ── not done: the normal first-mount flow still works ────────────────────────

describe('HoldProposalCard — fresh proposal', () => {
  it('renders the confirm card with its actions', () => {
    render(<HoldProposalCard proposal={REGISTER} {...noop} />);
    expect(screen.getByText(/Confirm — register/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();
  });

  it('tap-confirm success turns the card into the receipt', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<HoldProposalCard proposal={REGISTER} onDismiss={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(screen.getByText(/Registered/)).toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /register/i })).not.toBeInTheDocument();
  });

  it('a failed confirm shows the error and allows retry (proposal NOT marked done)', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Could not register — try again.'));
    render(<HoldProposalCard proposal={REGISTER} onDismiss={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(screen.getByText(/Could not register/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
