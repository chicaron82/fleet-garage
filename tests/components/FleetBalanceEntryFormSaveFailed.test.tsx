// A fleet balance that didn't save must SAY so (docs/October/ticket-a-balance-that-did-not-save-says-nothing.md).
// 2026-10-09: he entered the day's numbers at the airport, the signal dropped, and the form went
// from "Saving..." back to "Log Numbers" with no message. No row existed; he learned hours later.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FleetBalanceEntryForm } from '../../src/components/vehicle/FleetBalanceEntryForm';

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Test VSA', role: 'VSA' } }),
}));
vi.mock('../../src/hooks/useUserResolver', () => ({
  useUserResolver: () => ({ getName: () => 'Test VSA' }),
}));

function fill(out: string, in_: string) {
  const [outInput, inInput] = screen.getAllByRole('spinbutton') as HTMLInputElement[];
  fireEvent.change(outInput, { target: { value: out } });
  fireEvent.change(inInput, { target: { value: in_ } });
  return { outInput, inInput };
}

describe('FleetBalanceEntryForm — a failed save', () => {
  it('says it did not save and keeps the numbers', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(<FleetBalanceEntryForm onSubmit={onSubmit} />);
    // Control: nothing is claimed before a save was even tried.
    expect(screen.queryByRole('alert')).toBeNull();

    const { outInput, inInput } = fill('100', '125');
    fireEvent.click(screen.getByRole('button', { name: 'Log Numbers' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/didn't save/i);
    expect(onSubmit).toHaveBeenCalledWith(100, 125);
    expect(outInput.value).toBe('100');
    expect(inInput.value).toBe('125');
  });

  it('says nothing when the save lands', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<FleetBalanceEntryForm onSubmit={onSubmit} />);
    fill('100', '125');
    fireEvent.click(screen.getByRole('button', { name: 'Log Numbers' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log Numbers' })).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears the message when the retry lands', async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<FleetBalanceEntryForm onSubmit={onSubmit} />);
    fill('100', '125');
    fireEvent.click(screen.getByRole('button', { name: 'Log Numbers' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Log Numbers' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
