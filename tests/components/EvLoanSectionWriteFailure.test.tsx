import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EvLoanSection } from '../../src/components/vehicle/EvLoanSection';
import type { EvAssetLoan, Vehicle } from '../../src/types';

// The one-tap Return awaited `returnEvAssetLoan` and dropped whatever happened: a return that did not
// save put the button back to idle with nothing said (line-check 2026-10-10).

const TESLA = { id: 'v-tesla', unitNumber: '5429999', licensePlate: 'LUR999' } as Vehicle;
const LOAN: EvAssetLoan = {
  id: 'loan-1', lenderVehicleId: 'v-tesla', assetType: 'cable', borrowerUnit: '5429001', status: 'out',
  notes: null, createdAt: '2026-10-01T00:00:00Z', createdBy: 'u1', returnedAt: null, returnedBy: null,
};

let evAssetLoans: EvAssetLoan[] = [LOAN];
const returnEvAssetLoan = vi.fn();

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    evAssetLoans, returnEvAssetLoan, getVehicleByUnit: () => undefined, getVehicle: () => undefined,
  }),
}));

beforeEach(() => { vi.clearAllMocks(); evAssetLoans = [LOAN]; });

describe('EvLoanSection — a return that did not save says so', () => {
  it('⭐ a thrown return shows the note and leaves the button to tap again', async () => {
    returnEvAssetLoan.mockRejectedValue(new Error('ev asset loan not returned'));
    render(<EvLoanSection vehicle={TESLA} />);
    fireEvent.click(screen.getByRole('button', { name: /Returned/ }));
    expect(await screen.findByText(/return didn't save/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Returned/ })).toBeEnabled();
  });

  it('⭐ "incomplete" says its own sentence — and the note outlives the row that produced it', async () => {
    returnEvAssetLoan.mockImplementation(async () => { evAssetLoans = []; return 'incomplete'; });
    render(<EvLoanSection vehicle={TESLA} />);
    fireEvent.click(screen.getByRole('button', { name: /Returned/ }));
    expect(await screen.findByText(/Loan closed, but the charge cable didn't mark as present/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Returned/ })).toBeNull();   // the loan is gone, the note is not
  });

  it('a clean return says nothing', async () => {
    returnEvAssetLoan.mockImplementation(async () => { evAssetLoans = []; return 'returned'; });
    const { container } = render(<EvLoanSection vehicle={TESLA} />);
    fireEvent.click(screen.getByRole('button', { name: /Returned/ }));
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
