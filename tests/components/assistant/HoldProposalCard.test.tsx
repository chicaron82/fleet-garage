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

const updateVehicleProposal: Proposal = {
  kind: 'update_vehicle',
  vehicleId: 'v1',
  plate: 'LUR554',
  fills: [{ field: 'color', value: 'Gray' }, { field: 'year', value: 2026 }],
};

const lostItemProposal: Proposal = {
  kind: 'lost_item',
  description: 'black leather wallet',
  location: 'back_seat',
  licensePlate: 'LUR224',
  notes: 'handed in at front desk',
};

const navigateProposal: Proposal = {
  kind: 'navigate',
  destination: 'schedule-import',
  label: 'Schedule — Import from photo',
};

const memoryProposal: Proposal = {
  kind: 'memory',
  content: 'Runs mid shifts',
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

  it('renders a backfill draft and confirms to a filled-in receipt', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<HoldProposalCard proposal={updateVehicleProposal} onConfirm={onConfirm} onDismiss={vi.fn()} />);
    expect(screen.getByText('Confirm — backfill from key tag')).toBeInTheDocument();
    expect(screen.getByText('LUR554')).toBeInTheDocument();
    expect(screen.getByText(/color → Gray, year → 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Fill in'));
    await waitFor(() => expect(screen.getByText(/Filled in 2 fields on/)).toBeInTheDocument());
  });

  it('a backfill draft can be cancelled without writing', () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(<HoldProposalCard proposal={updateVehicleProposal} onConfirm={onConfirm} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders a lost-item draft and confirms to a logged receipt', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<HoldProposalCard proposal={lostItemProposal} onConfirm={onConfirm} onDismiss={vi.fn()} />);
    expect(screen.getByText('Confirm — log found item')).toBeInTheDocument();
    expect(screen.getByText('black leather wallet')).toBeInTheDocument();
    expect(screen.getByText('Back seat · Plate LUR224')).toBeInTheDocument();
    expect(screen.getByText('handed in at front desk')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Log item'));
    await waitFor(() => expect(screen.getByText(/Logged to lost & found/)).toBeInTheDocument());
  });

  it('renders a navigate offer and confirms by navigating (no write, no receipt)', () => {
    const onConfirm = vi.fn();
    render(<HoldProposalCard proposal={navigateProposal} onConfirm={onConfirm} onDismiss={vi.fn()} />);
    expect(screen.getByText('Schedule — Import from photo')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Take me there →'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('a lost-item draft can be cancelled without writing', () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(<HoldProposalCard proposal={lostItemProposal} onConfirm={onConfirm} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders a memory draft and confirms to a saved receipt', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<HoldProposalCard proposal={memoryProposal} onConfirm={onConfirm} onDismiss={vi.fn()} />);
    expect(screen.getByText('Remember this?')).toBeInTheDocument();
    expect(screen.getByText('Runs mid shifts')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Remember'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(/I'll remember that/)).toBeInTheDocument());
  });

  it('a memory draft can be cancelled without saving', () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(<HoldProposalCard proposal={memoryProposal} onConfirm={onConfirm} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a failed memory save surfaces the error and offers Retry', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Could not save that memory — check connection and try again.'));
    render(<HoldProposalCard proposal={memoryProposal} onConfirm={onConfirm} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByText('Remember'));
    await waitFor(() => expect(screen.getByText(/Could not save that memory/)).toBeInTheDocument());
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });
});
