import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanIdentityHeader } from '../../src/components/scan-router/ScanIdentityHeader';
import type { Vehicle } from '../../src/types';

// Aaron, 2026-10-10: *"Tapping the car info on top opens the record instead of scrolling down to
// tap 'view unit'."* docs/October/ticket-scan-card-header-chips.md

const elantra = {
  id: 'v1', licensePlate: 'LZM532', unitNumber: '5423132', make: 'Hyundai', model: 'Elantra', year: 2026,
  color: 'Blue', status: 'CLEAR', branchId: 'YWG',
} as unknown as Vehicle;

describe('ScanIdentityHeader', () => {
  it('⭐ the whole identity block is one button that opens the record', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<ScanIdentityHeader plateLine="LZM532 · Unit 5423132" vehicle={elantra} liveHolds={0} onOpen={onOpen} />);
    const header = screen.getByRole('button', { name: /LZM532 · Unit 5423132/ });
    // It carries the name and the status too — he taps what he is reading, wherever on it.
    expect(header).toHaveTextContent(/Elantra/);
    expect(header).toHaveTextContent(/Clear/);
    await user.click(header);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  // An unresolved read has no record to open; a button that goes nowhere is worse than none.
  it('no car resolved → the plate that was read, and nothing to tap', () => {
    render(<ScanIdentityHeader plateLine="ABC123" vehicle={null} liveHolds={0} onOpen={vi.fn()} />);
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('a host that gives no opener gets plain text', () => {
    render(<ScanIdentityHeader plateLine="LZM532 · Unit 5423132" vehicle={elantra} liveHolds={0} />);
    expect(screen.getByText('LZM532 · Unit 5423132')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
