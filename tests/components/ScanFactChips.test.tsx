import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanFactChips } from '../../src/components/scan-router/ScanFactChips';
import type { Vehicle } from '../../src/types';

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

// Aaron, 2026-10-10: *"Show key count as a tap to edit like the vehicle record. I accidentally
// changed the count on some cars when scrolling. Show me if it has winter tires."*
// docs/October/ticket-scan-card-header-chips.md

const car = (over: Partial<Vehicle> = {}) => ({
  id: 'v1', licensePlate: 'LZM532', unitNumber: '5423132', keyCount: 4, isTesla: false,
  ...over,
} as unknown as Vehicle);

const show = (vehicle: Vehicle, recordKeyCount = vi.fn().mockResolvedValue(undefined), scanNonce = 1) => ({
  recordKeyCount,
  ...render(<ScanFactChips vehicle={vehicle} scanNonce={scanNonce} recordKeyCount={recordKeyCount} />),
});

describe('ScanFactChips — the key count', () => {
  // ⭐⭐ THE POINT OF THE TICKET. The row used to be four always-live write buttons; a thumb
  // scrolling past changed counts. Closed, there is no number to hit.
  it('⚠️ shows the count with NO number buttons until he asks', () => {
    show(car());
    expect(screen.getByRole('button', { name: /🔑 4/ })).toBeInTheDocument();
    for (const n of ['1', '2', '3', '4']) {
      expect(screen.queryByRole('button', { name: n })).not.toBeInTheDocument();
    }
  });

  it('the first tap opens the picker and writes nothing', async () => {
    const user = userEvent.setup();
    const { recordKeyCount } = show(car());
    await user.click(screen.getByRole('button', { name: /🔑 4/ }));
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();   // control: it opened
    expect(recordKeyCount).not.toHaveBeenCalled();
  });

  it('a pick writes that count to THIS car, then closes', async () => {
    const user = userEvent.setup();
    const { recordKeyCount } = show(car());
    await user.click(screen.getByRole('button', { name: /🔑 4/ }));
    await user.click(screen.getByRole('button', { name: '2' }));
    expect(recordKeyCount).toHaveBeenCalledExactlyOnceWith('v1', 2);
    await waitFor(() => expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument());
  });

  // `recordKeyCount` THROWS on a failed write. The picker must stay open and say so.
  it('⚠️ a write that failed keeps the picker open and says it did not save', async () => {
    const user = userEvent.setup();
    show(car(), vi.fn().mockRejectedValue(new Error('offline')));
    await user.click(screen.getByRole('button', { name: /🔑 4/ }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/didn't save/i));
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
  });

  // The sheet is re-used for the next car: its picker must not arrive already open.
  it('a new scan closes an open picker', async () => {
    const user = userEvent.setup();
    const recordKeyCount = vi.fn().mockResolvedValue(undefined);
    const { rerender } = show(car(), recordKeyCount, 1);
    await user.click(screen.getByRole('button', { name: /🔑 4/ }));
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();   // control
    rerender(<ScanFactChips vehicle={car()} scanNonce={2} recordKeyCount={recordKeyCount} />);
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });
});

describe('ScanFactChips — tires are SHOWN, never flipped here', () => {
  it('❄️ says winter tires, with when they were seen', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    show(car({ winterTires: true, winterTiresAt: tenDaysAgo }));
    expect(screen.getByText(/❄️ Winter tires/)).toHaveTextContent('10d ago');
  });

  it('☀️ on a car with no winters marked — and no claim of winters', () => {
    show(car({ winterTires: null }));
    expect(screen.getByLabelText('No winter tires marked')).toHaveTextContent('☀️');
    expect(screen.queryByText(/Winter tires/)).not.toBeInTheDocument();
  });

  // His ruling: a one-tap flip on a scroll path is the same accident as the key row.
  it('⚠️ is not a button in either state — the only button closed is the key chip', () => {
    const { unmount } = show(car({ winterTires: true, winterTiresAt: null }));
    expect(screen.getAllByRole('button')).toHaveLength(1);
    unmount();
    show(car({ winterTires: false }));
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
