import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HoldProposalCard } from '../../../src/components/assistant/HoldProposalCard';
import type { Proposal } from '../../../api/_lib/holdProposal';

const proposal: Proposal = {
  kind: 'hold',
  vehicle: { vehicleId: 'v1', plate: 'LFJ438', label: 'Unit 1234 · 2025 Hyundai Tucson (Gray)' },
  holdType: 'damage',
  damageDescription: 'cracked windshield',
};

const registerProposal: Proposal = {
  kind: 'register_and_hold',
  newVehicle: { unitNumber: '9001', plate: 'LUR187', make: 'Ford', model: 'Escape', year: 2024, color: 'Blue' },
  holdType: 'damage',
  damageDescription: 'bumper dent',
};

describe('HoldProposalCard', () => {
  it('shows the drafted hold details', () => {
    render(<HoldProposalCard proposal={proposal} onConfirm={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/damage hold/)).toBeInTheDocument();
    expect(screen.getByText(/Unit 1234 · 2025 Hyundai Tucson \(Gray\)/)).toBeInTheDocument();
    expect(screen.getByText('cracked windshield')).toBeInTheDocument();
  });

  it('Confirm calls onConfirm and shows the receipt', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<HoldProposalCard proposal={proposal} onConfirm={onConfirm} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText('Confirm hold'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(/Hold opened on/)).toBeInTheDocument());
    expect(screen.getByText('LFJ438')).toBeInTheDocument();
  });

  it('Cancel calls onDismiss and never writes', () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(<HoldProposalCard proposal={proposal} onConfirm={onConfirm} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a failed write surfaces the error and offers Retry', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('RLS denied'));
    render(<HoldProposalCard proposal={proposal} onConfirm={onConfirm} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText('Confirm hold'));
    await waitFor(() => expect(screen.getByText('RLS denied')).toBeInTheDocument());
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders a register-and-hold draft and confirms to a register receipt', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<HoldProposalCard proposal={registerProposal} onConfirm={onConfirm} onDismiss={vi.fn()} />);
    expect(screen.getByText('Confirm — register + hold')).toBeInTheDocument();
    expect(screen.getByText(/Unit 9001 · 2024 Ford Escape \(Blue\)/)).toBeInTheDocument();
    expect(screen.getByText('bumper dent')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Register + hold'));
    await waitFor(() => expect(screen.getByText(/Registered \+ held/)).toBeInTheDocument());
    expect(screen.getByText('LUR187')).toBeInTheDocument();
  });
});
