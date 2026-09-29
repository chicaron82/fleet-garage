import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ClassChipPicker } from '../../src/components/vehicle/ClassChipPicker';

// ⚠️ `useRentalClasses` set an `error` on a failed add/remove and this — its ONLY consumer — dropped
// it, so a failed add produced no chip and no word: it reads as a missed tap, and he taps again.
// Worse, the picker then SELECTED the code the list never gained (line-check 2026-09-28).

const addClass = vi.fn();
const removeClass = vi.fn();
let hookError: string | null = null;

vi.mock('../../src/hooks/useRentalClasses', () => ({
  useRentalClasses: () => ({
    classes: [{ code: 'Q4', label: null, sortOrder: 10 }],
    loading: false,
    error: hookError,
    addClass,
    removeClass,
  }),
}));

beforeEach(() => { vi.clearAllMocks(); hookError = null; });

const addCode = (code: string) => {
  fireEvent.click(screen.getByRole('button', { name: /Other/ }));
  fireEvent.change(screen.getByLabelText('New model code'), { target: { value: code } });
  fireEvent.click(screen.getByTitle('Add'));
};

describe('ClassChipPicker — a failed class write says so', () => {
  it('⭐ shows the save note when the hook reports an error', () => {
    hookError = 'permission denied for table rental_classes';
    render(<ClassChipPicker value="Q4" onChange={vi.fn()} />);
    // FG's standard line, not the raw Postgres message.
    expect(screen.getByText(/That didn't save — tap it again\./)).toBeInTheDocument();
    expect(screen.queryByText(/permission denied/)).toBeNull();
  });

  it('says nothing when there is no error', () => {
    render(<ClassChipPicker value="Q4" onChange={vi.fn()} />);
    expect(screen.queryByText(/didn't save/)).toBeNull();
  });

  it('⭐ does NOT select a code whose write failed', async () => {
    addClass.mockResolvedValue(false);
    const onChange = vi.fn();
    render(<ClassChipPicker value="" onChange={onChange} />);
    addCode('CTMY');
    await waitFor(() => expect(addClass).toHaveBeenCalledWith('CTMY'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects the code when the add lands', async () => {
    addClass.mockResolvedValue(true);
    const onChange = vi.fn();
    render(<ClassChipPicker value="" onChange={onChange} />);
    addCode('CTMY');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('CTMY'));
  });
});
