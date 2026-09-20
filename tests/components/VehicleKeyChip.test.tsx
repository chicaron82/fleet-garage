import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehicleKeyChip } from '../../src/components/vehicle/VehicleKeyChip';

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

// ⭐⭐ THE CLOSE WAS THE LIE (2026-09-19, docs/September/ticket-writes-that-vanish-into-void.md).
// `VehicleRecordFacts.setCount` shut the picker FIRST and fired `recordKeyCount` into a `void` —
// and that writer THROWS on a failed write, which no error boundary catches. So a count that never
// reached the database looked exactly like one that did: the picker closed, the chip kept its old
// value, and nothing said why. The picker now closes on the WRITE, not on the tap.

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /🔑/ }));
};

describe('VehicleKeyChip', () => {
  it('a saved count closes the picker', async () => {
    const user = userEvent.setup();
    render(<VehicleKeyChip isTesla={false} keyCount={null} onPick={async () => true} />);
    await open(user);
    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument());
  });

  // ⚠️ THE REGRESSION GUARD. A failed write must leave him looking at the picker he just used —
  // the state of the screen has to match the state of the record.
  it('⚠️ a write that did NOT land keeps the picker open', async () => {
    const user = userEvent.setup();
    render(<VehicleKeyChip isTesla={false} keyCount={null} onPick={async () => false} />);
    await open(user);
    await user.click(screen.getByRole('button', { name: '3' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument());
  });

  it('passes the number he tapped, once', async () => {
    const onPick = vi.fn(async () => true);
    const user = userEvent.setup();
    render(<VehicleKeyChip isTesla={false} keyCount={1} onPick={onPick} />);
    await open(user);
    await user.click(screen.getByRole('button', { name: '4' }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith(4);
  });

  // A Tesla carries exactly one keycard — 2/3/4 are questions with no true answer, and the row is
  // tapped with gloves on. Carried over from the strip; the extraction must not lose it.
  it('⭐ a Tesla offers only the single keycard', async () => {
    const user = userEvent.setup();
    render(<VehicleKeyChip isTesla keyCount={null} onPick={async () => true} />);
    await user.click(screen.getByRole('button', { name: /⚡/ }));
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument();
  });

  it('✕ closes without writing', async () => {
    const onPick = vi.fn(async () => true);
    const user = userEvent.setup();
    render(<VehicleKeyChip isTesla={false} keyCount={2} onPick={onPick} />);
    await open(user);
    await user.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '✕' })).not.toBeInTheDocument());
    expect(onPick).not.toHaveBeenCalled();
  });
});
