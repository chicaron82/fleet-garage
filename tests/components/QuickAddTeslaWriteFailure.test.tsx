import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QuickAddTeslaForm } from '../../src/components/holds/QuickAddTeslaForm';
import type { User } from '../../src/types';

// ⚠️ THE TRAP THIS PINS (line-check 2026-09-28). `updateVehicleEVAssets` does NOT throw — it swallows
// the Supabase error and returns false. This form wrapped it in try/catch and then fired
// `hapticMedium(); onDone()`, so a lost EV assessment reported a clean registration — the exact defect
// `registerFollowUps.ts` documents and handles ("a try/catch here would be dead code").

const VSA_USER: User = { id: 'u1', employeeId: 'E1', name: 'Test VSA', role: 'VSA', branchId: 'YWG' };

const addVehicle = vi.fn().mockResolvedValue('new-id');
const updateVehicleEVAssets = vi.fn().mockResolvedValue(true);
const addHold = vi.fn().mockResolvedValue('hold-id');

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: VSA_USER }) }));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ addVehicle, updateVehicleEVAssets, addHold }),
}));

/** Unit #, then plate — by position: the labels aren't wired to the inputs in this form. */
const fill = () => {
  const boxes = screen.getAllByRole('textbox');
  fireEvent.change(boxes[0], { target: { value: '5429999' } });
  fireEvent.change(boxes[1], { target: { value: 'LUR999' } });
};

beforeEach(() => { vi.clearAllMocks(); updateVehicleEVAssets.mockResolvedValue(true); });

describe('QuickAddTeslaForm — a failed EV check does not read as a clean registration', () => {
  it('⭐ says the asset check did not save when the write returns FALSE (it never throws)', async () => {
    const onDone = vi.fn();
    render(<QuickAddTeslaForm onDone={onDone} />);
    fill();
    updateVehicleEVAssets.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: /register tesla/i }));

    await waitFor(() => expect(updateVehicleEVAssets).toHaveBeenCalled());
    await screen.findByText(/the EV asset check didn't save/i);
    // The car IS registered, so it closes — but only after he has been told.
    expect(onDone).not.toHaveBeenCalled();
  });

  it('a landed write closes straight away and says nothing', async () => {
    const onDone = vi.fn();
    render(<QuickAddTeslaForm onDone={onDone} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: /register tesla/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(screen.queryByText(/didn't save/i)).toBeNull();
  });
});
