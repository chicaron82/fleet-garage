import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShiftBreakChips } from '../../src/components/schedule/ShiftBreakChips';

// The break picker on the actual-hours sheet (Aaron, 2026-10-22: "a shortened break of 15m instead of 30m").
describe('ShiftBreakChips', () => {
  it('untouched, it says the standard applies and no chip is on', () => {
    render(<ShiftBreakChips breakMinutes={null} onChange={vi.fn()} />);
    expect(screen.getByText(/standard 30m/)).toBeInTheDocument();
    for (const name of ['None', '15m', '30m', '45m', '60m']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('a tap logs that break', async () => {
    const onChange = vi.fn();
    render(<ShiftBreakChips breakMinutes={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '15m' }));
    expect(onChange).toHaveBeenCalledWith(15);
    await userEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('tapping the chip that is on goes back to the standard', async () => {
    const onChange = vi.fn();
    render(<ShiftBreakChips breakMinutes={15} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '15m' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: '15m' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('Other takes any minutes, clamped to 0–240', async () => {
    const onChange = vi.fn();
    render(<ShiftBreakChips breakMinutes={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Other' }));
    const input = screen.getByLabelText('Break minutes');
    await userEvent.type(input, '2');
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('a custom value already logged opens with Other showing it', () => {
    render(<ShiftBreakChips breakMinutes={20} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Break minutes')).toHaveValue(20);
  });
});
